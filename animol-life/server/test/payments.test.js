import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import { startTestServer, CUSTOMER } from './helpers.js';
import { outbox } from '../src/email.js';
import { resetPaypalToken } from '../src/payments.js';

const servers = [];
after(async () => { await Promise.all(servers.map((s) => s.close())); });
const start = async (opts) => { const s = await startTestServer(opts); servers.push(s); return s; };
const ITEMS = [{ id: 'fieno-coniglio-1kg', qty: 2 }]; // 9,80 + 4,90 = 14,70

describe('pagamento demo (nessuna chiave)', () => {
  test('carta: ordine pending -> pagina DEMO -> pagato; token obbligatorio e monouso', async () => {
    const t = await start();
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'card', total: 0.01 })).json();
    assert.equal(o.paymentStatus, 'pending');
    assert.equal(o.total, 14.7, 'il totale inviato dal client viene ignorato');
    const url = new URL(o.paymentUrl, t.base);
    const token = url.searchParams.get('token');
    assert.equal(url.pathname, '/pagamento/demo.html');
    // senza token o con token sbagliato: 404 (nessuna informazione sull'ordine)
    assert.equal((await t.get(`/api/payments/demo/${o.orderId}`)).status, 404);
    assert.equal((await t.get(`/api/payments/demo/${o.orderId}?token=${'a'.repeat(32)}`)).status, 404);
    assert.equal((await t.post(`/api/payments/demo/${o.orderId}`, { token: 'a'.repeat(32), outcome: 'success' })).status, 404);
    const info = await (await t.get(`/api/payments/demo/${o.orderId}?token=${token}`)).json();
    assert.deepEqual([info.demo, info.total, info.paymentStatus], [true, 14.7, 'pending']);
    const cancel = await (await t.post(`/api/payments/demo/${o.orderId}`, { token, outcome: 'cancel' })).json();
    assert.match(cancel.redirect, /esito=annullato/);
    const pay = await (await t.post(`/api/payments/demo/${o.orderId}`, { token, outcome: 'success' })).json();
    assert.equal(pay.paymentStatus, 'paid');
    assert.match(pay.redirect, /esito=ok/);
    assert.equal((await t.post(`/api/payments/demo/${o.orderId}`, { token, outcome: 'success' })).status, 404, 'token monouso');
    const st = await (await t.post('/api/order-status', { orderId: o.orderId })).json();
    assert.equal(st.paymentStatus, 'paid');
    assert.ok(outbox.some((m) => m.tag === 'order-paid' && m.subject.includes(o.orderId)));
  });

  test('contrassegno: nessun pagamento online e nessun supplemento', async () => {
    const t = await start();
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'cod' })).json();
    assert.equal(o.paymentStatus, 'cod');
    assert.equal(o.paymentUrl, null);
    assert.equal(o.total, 14.7);
  });

  test('"Paga ora" dall\'area personale crea un nuovo link demo per l\'ordine in attesa', async () => {
    const t = await start();
    const a = await t.registerUser('paga@example.it');
    const o = await (await a.post('/api/orders', { customer: { ...CUSTOMER, email: 'paga@example.it' }, items: ITEMS, paymentMethod: 'paypal' })).json();
    const list = (await (await a.get('/api/account/orders')).json()).orders;
    assert.equal(list[0].canPay, true);
    const again = await (await a.post(`/api/account/orders/${o.orderId}/pay`, {})).json();
    assert.match(again.paymentUrl, /^\/pagamento\/demo\.html\?order=/);
    const oldToken = new URL(o.paymentUrl, t.base).searchParams.get('token');
    assert.equal((await t.get(`/api/payments/demo/${o.orderId}?token=${oldToken}`)).status, 404, 'il link precedente non vale più');
  });

  test('in produzione senza chiavi: niente pagamento simulato, carta rifiutata, contrassegno ok', async () => {
    const t = await start({ env: { NODE_ENV: 'production' } });
    const card = await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'card' });
    assert.equal(card.status, 400);
    assert.equal((await card.json()).field, 'paymentMethod');
    assert.equal((await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'cod' })).status, 201);
    const cfg = await (await t.get('/api/payments/config')).json();
    assert.equal(cfg.demo, false);
  });
});

describe('Stripe Checkout + webhook firmato', () => {
  const SECRET = 'whsec_test_animol';
  function fakeStripe() {
    const real = new Stripe('sk_test_fake_key_for_tests');
    const created = [];
    const refunds = [];
    return {
      created, refunds,
      webhooks: real.webhooks,
      checkout: { sessions: { create: async (params, opts) => { created.push({ params, opts }); return { id: `cs_test_${created.length}`, url: `https://checkout.stripe.com/c/pay/cs_test_${created.length}` }; } } },
      refunds: Object.assign(refunds, { create: async (p) => { refunds.push(p); return { id: 're_test_1' }; } }),
    };
  }
  const sign = (payload) => Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  const event = (id, type, object) => JSON.stringify({ id, object: 'event', type, data: { object } });

  test('sessione con importo del server; il webhook firmato segna pagato; firma errata -> 400; idempotente', async () => {
    const stripe = fakeStripe();
    const t = await start({ env: { STRIPE_WEBHOOK_SECRET: SECRET }, overrides: { stripeClient: stripe } });
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'card', total: 1 })).json();
    assert.equal(o.paymentProvider, 'stripe');
    assert.match(o.paymentUrl, /^https:\/\/checkout\.stripe\.com\//);
    const { params, opts } = stripe.created[0];
    assert.equal(params.mode, 'payment');
    assert.equal(params.line_items[0].price_data.unit_amount, 1470);
    assert.equal(params.metadata.orderId, o.orderId);
    assert.match(params.success_url, /\/pagamento\/esito\.html\?order=.*esito=ok/);
    assert.ok(opts.idempotencyKey);

    const session = { id: 'cs_test_1', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 1470, currency: 'eur', payment_intent: 'pi_123', metadata: { orderId: o.orderId } };
    const payload = event('evt_1', 'checkout.session.completed', session);
    const forged = await t.post('/api/stripe/webhook', payload, { 'stripe-signature': 't=1,v1=deadbeef' });
    assert.equal(forged.status, 400);
    const unsigned = await t.post('/api/stripe/webhook', payload);
    assert.equal(unsigned.status, 400);
    assert.equal(t.app.locals.repo.orders.get(o.orderId).paymentStatus, 'pending');

    const ok = await t.post('/api/stripe/webhook', payload, { 'stripe-signature': sign(payload) });
    assert.equal(ok.status, 200);
    const paid = t.app.locals.repo.orders.get(o.orderId);
    assert.equal(paid.paymentStatus, 'paid');
    assert.equal(paid.payment.intent, 'pi_123');
    const dup = await (await t.post('/api/stripe/webhook', payload, { 'stripe-signature': sign(payload) })).json();
    assert.equal(dup.duplicate, true);
  });

  test('importo diverso o sessione di un altro ordine: non viene segnato pagato', async () => {
    const stripe = fakeStripe();
    const t = await start({ env: { STRIPE_WEBHOOK_SECRET: SECRET }, overrides: { stripeClient: stripe } });
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'card' })).json();
    const wrongAmount = event('evt_a', 'checkout.session.completed', { id: 'cs_test_1', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 100, currency: 'eur', metadata: { orderId: o.orderId } });
    await t.post('/api/stripe/webhook', wrongAmount, { 'stripe-signature': sign(wrongAmount) });
    const wrongSession = event('evt_b', 'checkout.session.completed', { id: 'cs_altro', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 1470, currency: 'eur', metadata: { orderId: o.orderId } });
    await t.post('/api/stripe/webhook', wrongSession, { 'stripe-signature': sign(wrongSession) });
    const stored = t.app.locals.repo.orders.get(o.orderId);
    assert.equal(stored.paymentStatus, 'pending');
    assert.equal(stored.payment.mismatch.amountCents, 100);
    const expired = event('evt_c', 'checkout.session.expired', { id: 'cs_test_1', object: 'checkout.session', mode: 'payment', payment_status: 'unpaid', metadata: { orderId: o.orderId } });
    await t.post('/api/stripe/webhook', expired, { 'stripe-signature': sign(expired) });
    assert.equal(t.app.locals.repo.orders.get(o.orderId).paymentStatus, 'failed');
  });

  test('abbonamento Plus via webhook collegato all\'account (client_reference_id)', async () => {
    const stripe = fakeStripe();
    const t = await start({ env: { STRIPE_WEBHOOK_SECRET: SECRET }, overrides: { stripeClient: stripe } });
    const a = await t.registerUser('stripeplus@example.it');
    const me = (await (await a.get('/api/auth/me')).json()).user;
    const sub = await (await a.post('/api/plus/subscribe', { plan: 'yearly' })).json();
    assert.match(sub.url, /^https:\/\/checkout\.stripe\.com/);
    assert.equal(stripe.created.at(-1).params.client_reference_id, me.id);
    const payload = event('evt_sub', 'checkout.session.completed', { id: 'cs_sub', object: 'checkout.session', mode: 'subscription', client_reference_id: me.id, customer: 'cus_1', subscription: 'sub_1', metadata: { plan: 'yearly', userId: me.id } });
    await t.post('/api/stripe/webhook', payload, { 'stripe-signature': sign(payload) });
    const status = (await (await a.get('/api/auth/me')).json()).plus;
    assert.equal(status.active, true);
    assert.equal(status.demo, false);
  });
});

describe('PayPal Checkout nativo (Orders v2, API finta)', () => {
  test('crea l\'ordine PayPal con il totale del server, cattura al ritorno e verifica importo e riferimento', async () => {
    resetPaypalToken();
    const calls = [];
    let captureAmount = '14.70';
    const fakeFetch = async (url, init = {}) => {
      calls.push({ url, init });
      const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
      if (url.endsWith('/v1/oauth2/token')) return json({ access_token: 'A21-test', expires_in: 3600 });
      if (url.endsWith('/v2/checkout/orders')) {
        const body = JSON.parse(init.body);
        return json({ id: '5O190127TN364715T', status: 'PAYER_ACTION_REQUIRED', links: [{ rel: 'payer-action', href: `https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T&v=${body.purchase_units[0].amount.value}` }] });
      }
      if (/\/capture$/.test(url)) {
        const orderId = calls.find((c) => c.url.endsWith('/v2/checkout/orders')).init.body.match(/"custom_id":"([^"]+)"/)[1];
        return json({ id: '5O190127TN364715T', status: 'COMPLETED', purchase_units: [{ reference_id: orderId, payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', custom_id: orderId, amount: { currency_code: 'EUR', value: captureAmount } }] } }] });
      }
      return json({}, 404);
    };
    const t = await start({ env: { PAYPAL_CLIENT_ID: 'client-id', PAYPAL_CLIENT_SECRET: 'client-secret' }, fetch: fakeFetch });
    const o = await (await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'paypal' })).json();
    assert.equal(o.paymentProvider, 'paypal');
    assert.match(o.paymentUrl, /^https:\/\/www\.sandbox\.paypal\.com\/checkoutnow\?token=5O190127TN364715T&v=14\.70$/);
    const created = JSON.parse(calls.find((c) => c.url.endsWith('/v2/checkout/orders')).init.body);
    assert.equal(created.intent, 'CAPTURE');
    assert.equal(created.purchase_units[0].amount.currency_code, 'EUR');
    assert.match(calls[0].url, /^https:\/\/api-m\.sandbox\.paypal\.com/);

    // token PayPal di un altro ordine: rifiutato senza chiamare la cattura
    const bad = await fetch(`${t.base}/api/payments/paypal/return?order=${o.orderId}&token=ALTROTOKEN123`, { redirect: 'manual' });
    assert.match(bad.headers.get('location'), /esito=errore/);
    assert.equal(calls.some((c) => /\/capture$/.test(c.url)), false);

    const ret = await fetch(`${t.base}/api/payments/paypal/return?order=${o.orderId}&token=5O190127TN364715T`, { redirect: 'manual' });
    assert.equal(ret.status, 303);
    assert.match(ret.headers.get('location'), /esito=ok/);
    const paid = t.app.locals.repo.orders.get(o.orderId);
    assert.equal(paid.paymentStatus, 'paid');
    assert.equal(paid.payment.captureId, 'CAP-1');

    // importo catturato diverso dal totale: non pagato
    captureAmount = '0.01';
    calls.length = 0;
    const o2 = await (await t.post('/api/orders', { customer: CUSTOMER, items: ITEMS, paymentMethod: 'paypal' })).json();
    const r2 = await fetch(`${t.base}/api/payments/paypal/return?order=${o2.orderId}&token=5O190127TN364715T`, { redirect: 'manual' });
    assert.match(r2.headers.get('location'), /esito=errore/);
    assert.equal(t.app.locals.repo.orders.get(o2.orderId).paymentStatus, 'pending');
  });
});
