import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startTestServer, CUSTOMER, ADMIN, createAgent } from './helpers.js';
import { outbox } from '../src/email.js';
import { omnibusLowestCents, openRepo } from '../src/repo.js';
import { bootstrapAdmin, toCsv, validateProduct } from '../src/admin.js';
import { loadConfig } from '../src/config.js';

const DAY = 86_400_000;
let t;
let admin;
before(async () => {
  t = await startTestServer();
  admin = await t.adminAgent();
});
after(async () => { await t.close(); });

describe('accesso amministratore', () => {
  test('API admin senza sessione admin -> 401; un cliente non è un admin', async () => {
    assert.equal((await t.get('/api/admin/dashboard')).status, 401);
    const customer = await t.registerUser('cliente-admin@example.it');
    assert.equal((await customer.get('/api/admin/dashboard')).status, 401);
    const asAdmin = await customer.post('/api/admin/login', { email: 'cliente-admin@example.it', password: 'Passw0rd-Lunga!' });
    assert.equal(asAdmin.status, 401, 'il ruolo cliente non può entrare nel pannello');
    assert.equal((await createAgent(t.base, 'admin').post('/api/admin/login', { ...ADMIN, password: 'sbagliata-davvero' })).status, 401);
  });

  test('cookie admin separato, SameSite=Strict, X-Robots-Tag noindex', async () => {
    const a = createAgent(t.base, 'admin');
    const res = await a.post('/api/admin/login', ADMIN);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('al_admin='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal((await a.get('/api/auth/me').then((r) => r.json())).user, null, 'la sessione admin non è una sessione cliente');
  });

  test('modifiche senza token CSRF -> 403', async () => {
    const res = await admin.post('/api/admin/coupons', { code: 'SENZACSRF', percent: 5 }, { 'x-csrf-token': 'x' });
    assert.equal(res.status, 403);
  });

  test('bootstrap al primo avvio: password casuale mostrata una sola volta', async () => {
    const dir = await fs.mkdtemp(path.join(t.dataDir, 'boot-'));
    const repo = openRepo(dir);
    const cfg = loadConfig({ NODE_ENV: 'test', SCRYPT_COST: '1024' }, { dataDir: dir });
    const logs = [];
    const r1 = await bootstrapAdmin({ cfg, repo }, { log: (m) => logs.push(m) });
    assert.equal(r1.generated, true);
    const pwLine = logs.find((l) => /password:/.test(l));
    assert.ok(pwLine && pwLine.split('password:')[1].trim().length >= 16);
    logs.length = 0;
    const r2 = await bootstrapAdmin({ cfg, repo }, { log: (m) => logs.push(m) });
    assert.equal(r2.created, false);
    assert.equal(logs.length, 0, 'al secondo avvio non stampa nulla');
    repo.close();
  });
});

describe('prodotti, storico prezzi e Omnibus', () => {
  test('omnibusLowestCents: riferimento ai 30 giorni prima dell\'inizio dello sconto', () => {
    const now = Date.now();
    const h = [
      { price_cents: 2000, sale_cents: null, at: now - 60 * DAY },
      { price_cents: 1800, sale_cents: null, at: now - 40 * DAY }, // fuori finestra? no: in vigore fino a -25
      { price_cents: 2200, sale_cents: null, at: now - 25 * DAY },
      { price_cents: 2200, sale_cents: 1500, at: now - 5 * DAY }, // inizio sconto
      { price_cents: 2200, sale_cents: 1400, at: now - 2 * DAY }, // riduzione progressiva
    ];
    // finestra [-35, -5): 1800 (in vigore fino a -25) e 2200 -> 1800
    assert.equal(omnibusLowestCents(h, now), 1800);
    // senza sconto: minimo degli ultimi 30 giorni, incluso il prezzo attuale
    const h2 = [{ price_cents: 1000, sale_cents: null, at: now - 50 * DAY }, { price_cents: 1200, sale_cents: null, at: now - 35 * DAY }];
    assert.equal(omnibusLowestCents(h2, now), 1200, 'il prezzo di 1000 è fuori dagli ultimi 30 giorni');
    const h3 = [{ price_cents: 1000, sale_cents: null, at: now - 50 * DAY }, { price_cents: 1200, sale_cents: null, at: now - 10 * DAY }];
    assert.equal(omnibusLowestCents(h3, now), 1000);
    // sconto senza storico precedente: prezzo pieno
    assert.equal(omnibusLowestCents([{ price_cents: 900, sale_cents: 700, at: now }], now), 900);
  });

  test('il seed conserva i lowestPrice30d pubblicati', async () => {
    const p = (await (await t.get('/api/products')).json()).products.find((x) => x.id === 'crocchette-cane-adulto-salmone');
    assert.equal(p.salePrice, 34.9);
    assert.equal(p.lowestPrice30d, 34.9);
    assert.equal(p.variants.find((v) => v.label === '12 kg').lowestPrice30d, 39.9);
  });

  test('crea prodotto -> visibile nel negozio e in products.json; validazioni', async () => {
    const bad = [
      { name: 'X', category: 'cani', price: 10 },
      { name: 'Prodotto', category: 'draghi', price: 10 },
      { name: 'Prodotto', category: 'cani', price: -1 },
      { name: 'Prodotto', category: 'cani', price: 10.123 },
      { name: 'Prodotto', category: 'cani', price: 10, salePrice: 12 },
      { name: 'Prodotto', category: 'cani', price: 10, variants: [{ label: 'A', price: 5 }, { label: 'A', price: 6 }] },
      { name: 'Prodotto', category: 'cani', price: 10, specs: { ['__proto__']: 'x' } },
      { name: 'Prodotto', category: 'cani', price: 10, id: '../../etc' },
      { name: 'Prodotto', category: 'cani', price: 10, stock: -3 },
    ];
    for (const b of bad) {
      const body = b.specs ? JSON.parse(JSON.stringify(b).replace('"specs":{}', '"specs":{"__proto__":"x"}')) : b;
      assert.equal((await admin.post('/api/admin/products', body)).status, 400, JSON.stringify(b));
    }
    const res = await admin.post('/api/admin/products', {
      name: 'Tiragraffi Torre Deluxe', brand: 'FelixHome', category: 'gatti', price: 59.9, description: 'Torre con tre ripiani.',
      specs: { Altezza: '120 cm' }, variants: [{ label: 'Beige', price: 59.9 }, { label: 'Grigio', price: 64.9, salePrice: 59.9 }], stock: 3,
    });
    assert.equal(res.status, 201);
    const { product } = await res.json();
    assert.equal(product.id, 'tiragraffi-torre-deluxe');
    const shop = (await (await t.get('/api/products')).json()).products;
    assert.ok(shop.some((p) => p.id === product.id && p.stock === 3));
    const exported = JSON.parse(await fs.readFile(path.join(t.publicDir, 'products.json'), 'utf8'));
    assert.ok(exported.some((p) => p.id === product.id));
    assert.equal((await admin.post('/api/admin/products', { name: 'Tiragraffi Torre Deluxe', category: 'gatti', price: 10 })).status, 400, 'id duplicato');
    // ordinabile, con scorte scalate e controllate
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: product.id, variant: 'Grigio', qty: 2 }], paymentMethod: 'cod' })).json();
    assert.equal(o.total, 119.8);
    const tooMany = await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: product.id, variant: 'Beige', qty: 2 }], paymentMethod: 'cod' });
    assert.equal(tooMany.status, 400);
    assert.match((await tooMany.json()).message, /Disponibilità insufficiente/);
  });

  test('cambio prezzo: storico registrato e lowestPrice30d calcolato automaticamente', async () => {
    const id = 'gabbia-criceto-deluxe'; // 49,90 -> 44,90 nel seed
    let res = await admin.put(`/api/admin/products/${id}`, { price: 49.9, salePrice: 39.9 });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).priceChanges, ['']);
    const p = (await (await t.get('/api/products')).json()).products.find((x) => x.id === id);
    assert.equal(p.salePrice, 39.9);
    assert.equal(p.lowestPrice30d, 44.9, 'riduzione progressiva: riferimento invariato');
    res = await admin.put(`/api/admin/products/${id}`, { salePrice: null, price: 52 });
    const p2 = (await (await t.get('/api/products')).json()).products.find((x) => x.id === id);
    assert.equal(p2.salePrice, null);
    assert.equal(p2.lowestPrice30d, 39.9, 'senza sconto: minimo degli ultimi 30 giorni');
    const hist = (await (await admin.get(`/api/admin/products/${id}`)).json()).priceHistory.filter((h) => h.variant === null);
    assert.deepEqual(hist.slice(-2).map((h) => [h.price, h.salePrice]), [[49.9, 39.9], [52, null]]);
    // gli ordini usano subito il nuovo prezzo
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: [{ id, qty: 1 }], paymentMethod: 'cod' })).json();
    assert.equal(o.subtotal, 52);
  });

  test('disattivazione: sparisce dal negozio e non è più ordinabile', async () => {
    assert.equal((await admin.del('/api/admin/products/miscela-canarini-1kg')).status, 200);
    assert.ok(!(await (await t.get('/api/products')).json()).products.some((p) => p.id === 'miscela-canarini-1kg'));
    assert.equal((await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: 'miscela-canarini-1kg', qty: 1 }] })).status, 400);
    const all = (await (await admin.get('/api/admin/products')).json()).products;
    assert.equal(all.find((p) => p.id === 'miscela-canarini-1kg').active, false);
  });

  test('descrizione IA: fallback senza chiave e Claude con client finto', async () => {
    const r = await (await admin.post('/api/admin/products/ai-description', { name: 'Cuccia Morbida', brand: 'Dormi', category: 'cani', specs: { Misura: 'L' } })).json();
    assert.equal(r.mode, 'template');
    assert.match(r.description, /Cuccia Morbida di Dormi/);
    let params;
    const client = { beta: { messages: { async create(p) { params = p; return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ description: 'Una cuccia morbida.' }) }] }; } } } };
    const s = await startTestServer({ anthropicClient: client });
    try {
      const a = await s.adminAgent();
      const out = await (await a.post('/api/admin/products/ai-description', { name: 'Cuccia Morbida', category: 'cani' })).json();
      assert.deepEqual([out.mode, out.description], ['claude', 'Una cuccia morbida.']);
      assert.equal(params.model, 'claude-opus-5-5');
      assert.equal(params.output_config.format.type, 'json_schema');
      assert.equal(params.fallbacks, 'default');
    } finally { await s.close(); }
  });

  test('validateProduct conserva i campi non modificati', () => {
    const existing = { id: 'x-y', name: 'Nome', brand: 'B', category: 'cani', price: 10, salePrice: null, rating: 4, reviews: 2, sold: 9, description: 'd', specs: { a: 'b' }, variants: [], stock: null, active: true };
    const p = validateProduct({ price: 12 }, existing);
    assert.deepEqual([p.name, p.price, p.sold, p.specs.a], ['Nome', 12, 9, 'b']);
  });
});

describe('ordini lato admin', () => {
  test('pagato -> spedito con tracking -> consegnato, con notifica al cliente; rimborso', async () => {
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], paymentMethod: 'card' })).json();
    const st = (body) => admin.post(`/api/admin/orders/${o.orderId}/status`, body);
    assert.equal((await st({ action: 'shipped', tracking: { carrier: 'BRT', code: 'ABC123' } })).status, 400, 'non ancora pagato');
    assert.equal((await st({ action: 'boh' })).status, 400);
    assert.equal((await st({ action: 'paid' })).status, 200);
    assert.equal((await st({ action: 'shipped' })).status, 400, 'tracking obbligatorio');
    assert.equal((await st({ action: 'shipped', tracking: { carrier: 'BRT', code: 'ABC 123' } })).status, 400);
    assert.equal((await st({ action: 'shipped', tracking: { carrier: 'BRT', code: 'ABC123', url: 'javascript:alert(1)' } })).status, 400);
    const shipped = await (await st({ action: 'shipped', tracking: { carrier: 'BRT', code: 'ABC123', url: 'https://vas.brt.it/vas/sped_det_show.htm?brtCode=ABC123' } })).json();
    assert.equal(shipped.order.status, 'spedito');
    assert.ok(outbox.some((m) => m.tag === 'order-shipped' && /ABC123/.test(m.text)));
    const pub = await (await t.post('/api/order-status', { orderId: o.orderId, email: CUSTOMER.email })).json();
    assert.equal(pub.tracking.code, 'ABC123');
    assert.equal((await (await st({ action: 'delivered' })).json()).order.status, 'consegnato');
    const ref = await (await st({ action: 'refunded' })).json();
    assert.deepEqual([ref.order.status, ref.order.paymentStatus], ['rimborsato', 'refunded']);
    assert.equal((await st({ action: 'shipped', tracking: { carrier: 'BRT', code: 'X1234' } })).status, 400, 'ordine chiuso');
    const list = await (await admin.get(`/api/admin/orders?q=${o.orderId}`)).json();
    assert.equal(list.total, 1);
  });

  test('annullamento ripristina le scorte', async () => {
    await admin.put('/api/admin/products/lettiera-agglomerante-10l', { stock: 5 });
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: 'lettiera-agglomerante-10l', variant: '10 L', qty: 3 }], paymentMethod: 'cod' })).json();
    assert.equal(t.app.locals.repo.products.get('lettiera-agglomerante-10l').stock, 2);
    await admin.post(`/api/admin/orders/${o.orderId}/status`, { action: 'canceled', notify: false });
    assert.equal(t.app.locals.repo.products.get('lettiera-agglomerante-10l').stock, 5);
  });

  test('dashboard con vendite, scontrino medio e membri Plus', async () => {
    const a = await t.registerUser('dash@example.it');
    await a.post('/api/plus/subscribe', { plan: 'monthly' });
    const d = await (await admin.get('/api/admin/dashboard')).json();
    assert.ok(d.last30.orders >= 1);
    assert.ok(d.today.salesCents > 0);
    assert.equal(d.last30.aovCents, Math.round(d.last30.salesCents / d.last30.orders));
    assert.ok(d.plus.active >= 1);
    const members = (await (await admin.get('/api/admin/plus-members')).json()).members;
    assert.ok(members.some((m) => m.email === 'dash@example.it' && m.status === 'trialing'));
  });
});

describe('coupon, newsletter, registro', () => {
  test('CRUD coupon e uso nel checkout', async () => {
    assert.equal((await admin.post('/api/admin/coupons', { code: 'x', percent: 5 })).status, 400);
    assert.equal((await admin.post('/api/admin/coupons', { code: 'ESTATE20', percent: 90 })).status, 400);
    assert.equal((await admin.post('/api/admin/coupons', { code: 'estate20', percent: 20, description: 'Estate', maxUses: 1 })).status, 201);
    const v = await (await t.post('/api/coupons/validate', { code: 'estate20' })).json();
    assert.equal(v.valid, true);
    assert.equal(v.percent, 20);
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, coupon: 'ESTATE20', items: [{ id: 'fieno-coniglio-1kg', qty: 10 }], paymentMethod: 'cod' })).json();
    assert.equal(o.discount, 9.8);
    assert.equal((await t.post('/api/orders', { customer: CUSTOMER, coupon: 'ESTATE20', items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] })).status, 400, 'utilizzi esauriti');
    assert.equal((await admin.put('/api/admin/coupons/ANIMOL10', { percent: 10, active: false })).status, 200);
    assert.equal((await (await t.post('/api/coupons/validate', { code: 'ANIMOL10' })).json()).valid, false);
    assert.equal((await admin.del('/api/admin/coupons/ESTATE20')).status, 200);
    assert.equal((await admin.del('/api/admin/coupons/ESTATE20')).status, 404);
  });

  test('export CSV newsletter (solo confermati) con protezione formula injection', async () => {
    await t.post('/api/newsletter', { email: 'confermato@example.it', consent: true });
    const link = new URL(outbox.findLast((m) => m.tag === 'newsletter-confirm').text.match(/https?:\/\/\S+/)[0]);
    await t.get(link.pathname + link.search);
    await t.post('/api/newsletter', { email: 'pendente@example.it', consent: true });
    const res = await admin.get('/api/admin/newsletter.csv');
    assert.match(res.headers.get('content-type'), /text\/csv/);
    const csv = await res.text();
    assert.match(csv, /confermato@example\.it/);
    assert.doesNotMatch(csv, /pendente@example\.it/);
    assert.match(toCsv([{ a: '=HYPERLINK("x")' }], [{ key: 'a', label: 'a' }]), /"'=HYPERLINK\(""x""\)"/);
  });

  test('registro delle azioni admin', async () => {
    const entries = (await (await admin.get('/api/admin/audit')).json()).entries;
    const actions = new Set(entries.map((e) => e.action));
    for (const a of ['admin.login', 'product.create', 'product.update', 'coupon.create', 'order.shipped', 'newsletter.export']) assert.ok(actions.has(a), a);
    assert.ok(entries.every((e) => !JSON.stringify(e).includes('scrypt')));
  });
});

describe('contatti B2B (/api/leads e /vendita/)', () => {
  const LEAD = { name: 'Giulia Bianchi', shop: 'Pet Corner', type: 'negozio', city: 'Torino', phone: '+39 011 1234567', email: 'giulia@petcorner.it', interest: 'rivendita', message: 'Vorrei il listino', privacyAccepted: true, marketingConsent: true, consentVersion: '2026-11', source: 'vendita-landing', website: '' };

  test('validazione, salvataggio con consenso, notifica e lista/CSV nel pannello', async () => {
    assert.equal((await t.post('/api/leads', { ...LEAD, privacyAccepted: false })).status, 400);
    assert.equal((await t.post('/api/leads', { ...LEAD, email: 'no' })).status, 400);
    assert.equal((await t.post('/api/leads', { ...LEAD, message: 'x'.repeat(2001) })).status, 400);
    assert.equal((await t.post('/api/leads', { ...LEAD, phone: '<script>' })).status, 400);
    const res = await t.post('/api/leads', LEAD);
    assert.equal(res.status, 201);
    assert.deepEqual(await res.json(), { ok: true });
    assert.ok(outbox.some((m) => m.tag === 'lead-b2b' && m.to === ADMIN.email && /Pet Corner/.test(m.subject)));
    const leads = (await (await admin.get('/api/admin/leads')).json()).leads;
    const l = leads.find((x) => x.email === 'giulia@petcorner.it');
    assert.equal(l.consentVersion, '2026-11');
    assert.equal(l.marketingConsent, true);
    assert.ok(l.privacyAcceptedAt && l.marketingConsentAt);
    const csv = await (await admin.get('/api/admin/leads.csv')).text();
    assert.match(csv, /Pet Corner/);
    assert.equal((await t.get('/api/admin/leads')).status, 401);
  });

  test('honeypot compilato: risposta di successo, nulla salvato', async () => {
    const before = t.app.locals.repo.leads.count();
    const res = await t.post('/api/leads', { ...LEAD, email: 'bot@spam.example', website: 'http://spam.example' });
    assert.equal(res.status, 202);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(t.app.locals.repo.leads.count(), before);
  });

  test('rate limit per IP', async () => {
    const s = await startTestServer({ env: { RATE_LIMIT_LEADS: '2' } });
    try {
      const codes = [];
      for (let i = 0; i < 3; i += 1) codes.push((await s.post('/api/leads', { ...LEAD, email: `l${i}@example.it` })).status);
      assert.deepEqual(codes, [201, 201, 429]);
    } finally { await s.close(); }
  });

  test('/vendita/ servita staticamente', async () => {
    const dir = path.join(t.dataDir, 'vendita-test');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), '<!doctype html><title>Vendita</title><h1>Diventa rivenditore</h1>');
    const s = await startTestServer({ overrides: { venditaDir: dir } });
    try {
      const res = await s.get('/vendita/');
      assert.equal(res.status, 200);
      assert.match(await res.text(), /Diventa rivenditore/);
      assert.ok(res.headers.get('content-security-policy'));
    } finally { await s.close(); }
  });
});
