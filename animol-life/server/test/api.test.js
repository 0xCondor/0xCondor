import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startTestServer, CUSTOMER } from './helpers.js';
import { outbox } from '../src/email.js';

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

describe('health e sicurezza', () => {
  test('GET /api/health', async () => {
    const res = await t.get('/api/health');
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.status, 'ok');
    assert.equal(body.integrations.ai, 'fallback');
    assert.equal(body.integrations.stripe, false);
    assert.equal(body.catalog.source, 'database');
    assert.equal(body.catalog.seed, 'sample');
    assert.equal(body.integrations.demoPayments, true);
    assert.ok(body.catalog.count > 0);
  });

  test('header di sicurezza e niente x-powered-by', async () => {
    const res = await t.get('/api/health');
    assert.ok(res.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
    assert.equal(res.headers.get('x-powered-by'), null);
  });

  test('serve i file statici di public/', async () => {
    const res = await t.get('/');
    assert.equal(res.status, 200);
    assert.match(await res.text(), /Animol Life/);
  });

  test('corpo troppo grande -> 413, JSON invalido -> 400, endpoint inesistente -> 404', async () => {
    const big = await t.post('/api/assistant', { messages: [{ role: 'user', content: 'x'.repeat(40_000) }] });
    assert.equal(big.status, 413);
    const bad = await t.post('/api/assistant', '{"messages": [');
    assert.equal(bad.status, 400);
    const nf = await t.get('/api/nope');
    assert.equal(nf.status, 404);
  });
});

describe('POST /api/assistant (fallback senza chiave)', () => {
  test('dichiara di essere un\'IA al primo messaggio e propone prodotti', async () => {
    const res = await t.post('/api/assistant', { messages: [{ role: 'user', content: 'Cerco crocchette per il mio cane' }], cart: [] });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.match(body.reply, /intelligenza artificiale/i);
    assert.ok(Array.isArray(body.products) && body.products.includes('crocchette-cane-adulto-salmone'));
  });

  test('non fa diagnosi: rimanda al veterinario', async () => {
    const res = await t.post('/api/assistant', {
      messages: [
        { role: 'user', content: 'ciao' },
        { role: 'assistant', content: 'Ciao! Come posso aiutarti?' },
        { role: 'user', content: 'Il mio gatto vomita da due giorni, cosa gli do?' },
      ],
    });
    const body = await res.json();
    assert.match(body.reply, /veterinari/i);
    assert.equal(body.products, undefined);
  });

  test('politiche: spedizione con carrello, resi, coupon, Plus', async () => {
    const ship = await (await t.post('/api/assistant', {
      messages: [{ role: 'user', content: 'Quanto costa la spedizione?' }],
      cart: [{ id: 'fieno-coniglio-1kg', qty: 1 }],
    })).json();
    assert.match(ship.reply, /49/);
    assert.match(ship.reply, /mancano/);
    const ret = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: 'Come funziona il reso?' }] })).json();
    assert.match(ret.reply, /14 giorni/);
    const cp = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: 'Avete un codice sconto?' }] })).json();
    assert.match(cp.reply, /ANIMOL10/);
    assert.match(cp.reply, /CUCCIOLO5/);
    const plus = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: 'Cos\'è l\'abbonamento Plus?' }] })).json();
    assert.match(plus.reply, /5,99/);
  });

  test('validazione input', async () => {
    for (const body of [{}, { messages: [] }, { messages: [{ role: 'system', content: 'x' }] }, { messages: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] }]) {
      const res = await t.post('/api/assistant', body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
  });

  test('cronologia lunga viene accorciata senza errori', async () => {
    const messages = [];
    for (let i = 0; i < 60; i++) messages.push({ role: i % 2 ? 'assistant' : 'user', content: `messaggio ${i} gatto` });
    messages.push({ role: 'user', content: 'lettiera per gatto' });
    const res = await t.post('/api/assistant', { messages });
    assert.equal(res.status, 200);
  });
});

describe('ordini', () => {
  let orderId;

  test('ricalcola i totali dal catalogo ignorando i prezzi del client', async () => {
    const res = await t.post('/api/orders', {
      customer: CUSTOMER,
      items: [
        { id: 'crocchette-cane-adulto-salmone', variant: '12 kg', qty: 1, price: 0.01 },
        { id: 'umido-gatto-tonno-12x85', qty: 2, price: 0.01 },
      ],
      total: 1,
    });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.match(body.orderId, /^AL-\d{4}-[A-Z0-9]{6}$/);
    assert.equal(body.orderId.slice(3, 7), String(new Date().getUTCFullYear()));
    assert.equal(body.total, 54.7); // 34,90 + 2 x 9,90, spedizione gratuita sopra 49 €
    assert.equal(body.shipping, 0);
    orderId = body.orderId;
    assert.equal(body.paymentStatus, 'pending');
    assert.equal(body.paymentProvider, 'demo');
    assert.match(body.paymentUrl, /^\/pagamento\/demo\.html\?order=AL-/);
    const stored = t.app.locals.repo.orders.all();
    assert.equal(stored.length, 1);
    assert.equal(stored[0].orderId, orderId);
    assert.equal(stored[0].totalCents, 5470);
    assert.equal(stored[0].userId, null, 'ordine da ospite');
    assert.ok(outbox.some((m) => m.tag === 'order-confirmation' && m.subject.includes(orderId)));
  });

  test('coupon e spedizione sotto soglia', async () => {
    const withCoupon = await (await t.post('/api/orders', { customer: CUSTOMER, coupon: 'animol10', items: [{ id: 'crocchette-cane-adulto-salmone', variant: '12 kg', qty: 1 }, { id: 'umido-gatto-tonno-12x85', qty: 2 }] })).json();
    assert.equal(withCoupon.total, 49.23);
    const small = await (await t.post('/api/orders', { customer: { ...CUSTOMER, email: 'anna@example.it' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] })).json();
    assert.equal(small.total, 9.8);
    assert.equal(small.shipping, 4.9);
  });

  test('errori di validazione', async () => {
    const cases = [
      { customer: { ...CUSTOMER, cap: '2012' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] },
      { customer: { ...CUSTOMER, cap: '2012a' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] },
      { customer: { ...CUSTOMER, email: 'non-una-email' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] },
      { customer: CUSTOMER, items: [] },
      { customer: CUSTOMER, items: [{ id: 'non-esiste', qty: 1 }] },
      { customer: CUSTOMER, items: [{ id: 'fieno-coniglio-1kg', qty: 0 }] },
      { customer: CUSTOMER, items: [{ id: 'fieno-coniglio-1kg', qty: 1.5 }] },
      { customer: CUSTOMER, items: [{ id: 'crocchette-cane-adulto-salmone', variant: '99 kg', qty: 1 }] },
      { customer: CUSTOMER, coupon: 'FALSO', items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] },
    ];
    for (const c of cases) {
      const res = await t.post('/api/orders', c);
      assert.equal(res.status, 400, JSON.stringify(c));
      const body = await res.json();
      assert.equal(body.error, 'validation_error');
    }
  });

  test('POST /api/order-status: stato senza dati personali, dettagli solo con email', async () => {
    const res = await t.post('/api/order-status', { orderId });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.orderId, orderId);
    assert.equal(body.status, 'ricevuto');
    assert.equal(body.items, undefined);
    const full = await (await t.post('/api/order-status', { orderId: orderId.toLowerCase().replace(/-/g, ' '), email: CUSTOMER.email })).json();
    assert.equal(full.total, 54.7);
    assert.equal(full.items.length, 2);
    assert.equal((await t.post('/api/order-status', { orderId: 'AL-2026-ZZZZZZ' })).status, 404);
    assert.equal((await t.post('/api/order-status', { orderId: 'boh' })).status, 400);
  });

  test('assistente: stato ordine via chat', async () => {
    const body = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: `Dov'è il mio ordine ${orderId}?` }] })).json();
    assert.match(body.reply, new RegExp(orderId));
    assert.match(body.reply, /ricevuto|in attesa di pagamento/);
  });

  test('POST /api/cart/quote e /api/carts', async () => {
    const q = await (await t.post('/api/cart/quote', { items: [{ id: 'fieno-coniglio-1kg', qty: 2 }], coupon: 'CUCCIOLO5' })).json();
    assert.equal(q.subtotal, 9.8);
    assert.equal(q.discount, 0.49);
    assert.equal(q.total, 14.21);
    assert.equal((await t.post('/api/carts', { email: 'x@example.it', items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] })).status, 400);
    assert.equal((await t.post('/api/carts', { email: 'x@example.it', consent: true, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] })).status, 200);
  });
});

describe('newsletter (doppio opt-in)', () => {
  test('richiede consenso esplicito ed email valida', async () => {
    assert.equal((await t.post('/api/newsletter', { email: 'a@example.it' })).status, 400);
    assert.equal((await t.post('/api/newsletter', { email: 'a@example.it', consent: 'true' })).status, 400);
    assert.equal((await t.post('/api/newsletter', { email: 'nope', consent: true })).status, 400);
  });

  test('flusso completo: iscrizione -> email -> conferma -> disiscrizione', async () => {
    const res = await t.post('/api/newsletter', { email: 'Lucia@Example.it', consent: true });
    assert.equal(res.status, 202);
    assert.equal((await res.json()).ok, true);
    const mail = outbox.findLast((m) => m.tag === 'newsletter-confirm');
    assert.equal(mail.to, 'lucia@example.it');
    const link = new URL(mail.text.match(/https?:\/\/\S+/)[0]);
    let list = JSON.parse(await fs.readFile(path.join(t.dataDir, 'newsletter.json'), 'utf8'));
    assert.equal(list[0].status, 'pending');
    assert.ok(!JSON.stringify(list).includes(link.searchParams.get('token')), 'il token non è salvato in chiaro');

    const conf = await t.get(link.pathname + link.search);
    assert.equal(conf.status, 200);
    list = JSON.parse(await fs.readFile(path.join(t.dataDir, 'newsletter.json'), 'utf8'));
    assert.equal(list[0].status, 'confirmed');
    assert.equal((await t.get(link.pathname + link.search)).status, 400, 'token monouso');
    assert.equal((await t.get('/api/newsletter/confirm?token=abcdefghijklmnopqrstuvwxyz')).status, 400);
  });
});

describe('Animol Plus (legato all\'account)', () => {
  test('senza accesso: subscribe e cancel rispondono 401', async () => {
    assert.equal((await t.post('/api/plus/subscribe', { plan: 'monthly', email: 'chiunque@example.it' })).status, 401);
    assert.equal((await t.post('/api/plus/cancel', { email: 'chiunque@example.it' })).status, 401);
  });

  test('subscribe in demo con account: restituisce url e stato Plus', async () => {
    const a = await t.registerUser('plus-url@example.it');
    assert.equal((await a.post('/api/plus/subscribe', { plan: 'weekly' })).status, 400);
    const res = await a.post('/api/plus/subscribe', { plan: 'monthly' });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.url.includes('monthly'));
    assert.equal(body.demo, true);
    assert.equal(body.trialDays, 14);
    assert.equal(body.plus.active, true);
    const me = await (await a.get('/api/auth/me')).json();
    assert.equal(me.plus.status, 'trialing');
    assert.equal((await a.post('/api/plus/subscribe', { plan: 'yearly' })).status, 400, 'niente doppio abbonamento');
  });

  test('i vantaggi valgono per gli ordini dell\'account, NON per chi usa la sua email da ospite', async () => {
    const email = 'plusdemo@example.it';
    const a = await t.registerUser(email);
    await a.post('/api/plus/subscribe', { plan: 'yearly' });
    const order = await (await a.post('/api/orders', { customer: { ...CUSTOMER, email }, items: [{ id: 'fieno-coniglio-1kg', qty: 2 }] })).json();
    assert.equal(order.plusApplied, true);
    assert.equal(order.account, true);
    assert.equal(order.total, 9.31);
    // Debolezza segnalata dal QA: prima bastava conoscere l'email di un membro.
    const guest = await (await t.post('/api/orders', { customer: { ...CUSTOMER, email }, items: [{ id: 'fieno-coniglio-1kg', qty: 2 }] })).json();
    assert.equal(guest.plusApplied, false);
    assert.equal(guest.total, 14.7);
    // e un estraneo non può disdire l'abbonamento altrui
    const other = await t.registerUser('altro@example.it');
    assert.equal((await other.post('/api/plus/cancel', { email })).status, 400);
    assert.equal((await (await a.get('/api/auth/me')).json()).plus.active, true);

    const res = await a.post('/api/plus/cancel', {});
    assert.equal(res.status, 202);
    assert.equal((await res.json()).canceled, true);
    assert.ok(outbox.some((m) => m.tag === 'plus-canceled' && m.to === email));
    const after = await (await a.post('/api/orders', { customer: { ...CUSTOMER, email }, items: [{ id: 'fieno-coniglio-1kg', qty: 2 }] })).json();
    assert.equal(after.plusApplied, false);
    assert.equal(after.total, 14.7); // 9,80 + 4,90
    assert.equal((await (await a.get('/api/auth/me')).json()).plus, null);
  });

  test('cancel senza token CSRF -> 403', async () => {
    const a = await t.registerUser('plus-csrf@example.it');
    await a.post('/api/plus/subscribe', { plan: 'monthly' });
    const res = await a.post('/api/plus/cancel', {}, { 'x-csrf-token': 'sbagliato' });
    assert.equal(res.status, 403);
    assert.equal((await (await a.get('/api/auth/me')).json()).plus.active, true);
  });

  test('GET /api/plus/lives', async () => {
    const body = await (await t.get('/api/plus/lives')).json();
    assert.equal(body.provider, 'demo');
    assert.ok(body.lives.length >= 3);
    for (const l of body.lives) {
      for (const k of ['id', 'title', 'host', 'startsAt', 'topic', 'productIds']) assert.ok(k in l, k);
      assert.ok(Date.parse(l.startsAt) > Date.now());
    }
  });

  test('webhook Stripe senza configurazione -> 503', async () => {
    const res = await t.post('/api/stripe/webhook', '{}');
    assert.equal(res.status, 503);
  });
});

describe('metodi di spedizione (allineati alla pagina)', () => {
  const small = [{ id: 'fieno-coniglio-1kg', qty: 1 }]; // 4,90
  const big = [{ id: 'crocchette-cane-adulto-salmone', variant: '12 kg', qty: 2 }]; // 69,80
  const order = async (items, extra = {}, email = 'ship@example.it') => t.post('/api/orders', { customer: { ...CUSTOMER, email }, items, ...extra });

  test('standard, express e point sotto e sopra soglia', async () => {
    const cases = [
      [small, 'standard', 4.9, 9.8], [small, 'express', 9.9, 14.8], [small, 'point', 2.9, 7.8],
      [big, 'standard', 0, 69.8], [big, 'express', 9.9, 79.7], [big, 'point', 0, 69.8],
    ];
    for (const [items, shippingMethod, ship, total] of cases) {
      const b = await (await order(items, { shippingMethod })).json();
      assert.equal(b.shippingMethod, shippingMethod);
      assert.equal(b.shipping, ship, shippingMethod);
      assert.equal(b.total, total, shippingMethod);
    }
    const def = await (await order(small)).json();
    assert.equal(def.shippingMethod, 'standard');
    const nested = await (await order(small, { shipping: { method: 'point' } })).json();
    assert.equal(nested.shipping, 2.9);
  });

  test('soglia calcolata dopo gli sconti; metodo non valido -> 400', async () => {
    // 5 x 9,90 = 49,50 -> con ANIMOL10 44,55: sotto soglia anche se il subtotale supera 49 €
    const b = await (await order([{ id: 'umido-gatto-tonno-12x85', qty: 5 }], { coupon: 'ANIMOL10', shippingMethod: 'point' })).json();
    assert.equal(b.subtotal, 49.5);
    assert.equal(b.shipping, 2.9); // 44,55 dopo il coupon
    assert.equal(b.total, 47.45);
    const bad = await order(small, { shippingMethod: 'drone' });
    assert.equal(bad.status, 400);
    assert.equal((await bad.json()).field, 'shippingMethod');
  });

  test('Plus: standard e point gratis, express sempre 9,90; coupon e Plus sul subtotale', async () => {
    const email = 'plusship@example.it';
    const a = await t.registerUser(email);
    await a.post('/api/plus/subscribe', { plan: 'monthly' });
    const order = (items, extra = {}) => a.post('/api/orders', { customer: { ...CUSTOMER, email }, items, ...extra });
    const std = await (await order(small, { shippingMethod: 'standard' })).json();
    const pt = await (await order(small, { shippingMethod: 'point' })).json();
    const ex = await (await order(small, { shippingMethod: 'express' })).json();
    assert.deepEqual([std.shipping, pt.shipping, ex.shipping], [0, 0, 9.9]);
    assert.equal(ex.total, 14.55); // 4,90 - 0,25 + 9,90
    const both = await (await order([{ id: 'umido-gatto-tonno-12x85', qty: 10 }], { coupon: 'CUCCIOLO5' })).json();
    assert.equal(both.discount, 9.9); // 5% + 5% di 99,00
    assert.equal(both.total, 89.1);
  });

  test('contrassegno: mai supplementi con ogni spedizione, massimo 500 €', async () => {
    for (const shippingMethod of ['standard', 'express', 'point']) {
      const card = await (await order(small, { shippingMethod, paymentMethod: 'card' })).json();
      const paypal = await (await order(small, { shippingMethod, paymentMethod: 'paypal' })).json();
      const cod = await (await order(small, { shippingMethod, paymentMethod: 'cod' })).json();
      assert.equal(cod.total, card.total);
      assert.equal(paypal.total, card.total);
      assert.equal(cod.paymentMethod, 'cod');
    }
    const many = [{ id: 'gabbia-criceto-deluxe', qty: 2 }, { id: 'crocchette-cane-adulto-salmone', variant: '12 kg', qty: 20 }]; // 787,80
    const res = await order(many, { paymentMethod: 'cod' });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).field, 'paymentMethod');
    assert.equal((await order(many, { paymentMethod: 'card' })).status, 201);
  });

  test('quote con shippingMethod', async () => {
    const q = await (await t.post('/api/cart/quote', { items: small, shippingMethod: 'express' })).json();
    assert.equal(q.shipping, 9.9);
    assert.equal(q.total, 14.8);
  });
});

describe('requisiti legali', () => {
  test('contrassegno senza supplemento (art. 62 Cod. Consumo)', async () => {
    const items = [{ id: 'fieno-coniglio-1kg', qty: 1 }];
    const card = await (await t.post('/api/orders', { customer: CUSTOMER, items, paymentMethod: 'card' })).json();
    const cod = await (await t.post('/api/orders', { customer: CUSTOMER, items, paymentMethod: 'cod' })).json();
    assert.equal(cod.total, card.total);
    assert.equal(cod.total, 9.8);
  });

  test('domande sull\'IA: link alla pagina di trasparenza', async () => {
    const body = await (await t.post('/api/assistant', {
      messages: [{ role: 'user', content: 'ciao' }, { role: 'assistant', content: 'Ciao!' }, { role: 'user', content: 'Sei un\'intelligenza artificiale?' }],
    })).json();
    assert.match(body.reply, /\/legal\/ai-trasparenza\.html/);
  });

  test('mai dati di carta in chat', async () => {
    const body = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: 'pago con questa: 4111 1111 1111 1111 scad 12/28' }] })).json();
    assert.match(body.reply, /non condividere mai i dati della carta/);
  });
});
