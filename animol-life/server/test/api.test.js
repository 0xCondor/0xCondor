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
    assert.equal(body.catalog.source, 'sample');
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
    const stored = JSON.parse(await fs.readFile(path.join(t.dataDir, 'orders.json'), 'utf8'));
    assert.equal(stored.length, 1);
    assert.equal(stored[0].orderId, orderId);
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
    assert.match(body.reply, /ricevuto/);
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

describe('Animol Plus', () => {
  test('subscribe in demo restituisce un url', async () => {
    for (const plan of ['monthly', 'yearly']) {
      const res = await t.post('/api/plus/subscribe', { plan });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(body.url.includes(plan));
      assert.equal(body.demo, true);
      assert.equal(body.trialDays, 14);
    }
    assert.equal((await t.post('/api/plus/subscribe', { plan: 'weekly' })).status, 400);
  });

  test('membro Plus: spedizione gratuita e -5% sugli ordini, poi disdetta via link email', async () => {
    const email = 'plus@example.it';
    await t.post('/api/plus/subscribe', { plan: 'monthly', email });
    const order = await (await t.post('/api/orders', { customer: { ...CUSTOMER, email }, items: [{ id: 'fieno-coniglio-1kg', qty: 2 }] })).json();
    assert.equal(order.shipping, 0);
    assert.equal(order.total, 9.31); // 9,80 - 5%

    const res = await t.post('/api/plus/cancel', { email });
    assert.equal(res.status, 202);
    const mail = outbox.findLast((m) => m.tag === 'plus-cancel');
    const link = new URL(mail.text.match(/https?:\/\/\S+/)[0]);
    assert.equal((await t.get(link.pathname + link.search)).status, 200);
    const plus = JSON.parse(await fs.readFile(path.join(t.dataDir, 'plus.json'), 'utf8'));
    assert.equal(plus.members.find((m) => m.email === email).status, 'canceled');

    const unknown = await t.post('/api/plus/cancel', { email: 'sconosciuto@example.it' });
    assert.equal(unknown.status, 202, 'risposta identica per non rivelare gli iscritti');
    assert.equal((await t.post('/api/plus/cancel', {})).status, 400);
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
