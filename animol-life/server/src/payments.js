// Pagamenti degli ordini.
// - Stripe Checkout (STRIPE_SECRET_KEY): pagamento una tantum; carta, PayPal e gli altri metodi attivati
//   nella dashboard Stripe. L'ordine passa a "pagato" SOLO dal webhook firmato.
// - PayPal Checkout nativo (PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET, Orders API v2): l'ordine passa a
//   "pagato" quando il server cattura il pagamento al ritorno da PayPal e ne verifica importo e riferimento.
// - Demo (nessuna chiave, mai in produzione salvo DEMO_PAYMENTS=1): pagina simulata chiaramente etichettata.
// - Contrassegno: nessun pagamento online e nessun supplemento.
// Il totale viene sempre dal server (order.totalCents), mai dal client.
import crypto from 'node:crypto';
import express from 'express';
import { baseUrl } from './config.js';
import { sendEmail } from './email.js';
import { hashToken } from './tokens.js';
import { ORDER_ID_RE, isPlainObject, ValidationError } from './security.js';

/* ---------------- Stripe ---------------- */

const stripeClients = new Map();
export async function getStripe(cfg) {
  if (cfg.stripeClient) return cfg.stripeClient; // iniezione per i test
  if (!cfg.stripeSecretKey) return null;
  if (!stripeClients.has(cfg.stripeSecretKey)) {
    const { default: Stripe } = await import('stripe');
    stripeClients.set(cfg.stripeSecretKey, new Stripe(cfg.stripeSecretKey));
  }
  return stripeClients.get(cfg.stripeSecretKey);
}

export function paymentProviders(cfg) {
  const stripe = Boolean(cfg.stripeSecretKey || cfg.stripeClient);
  const paypal = Boolean(cfg.paypalClientId && cfg.paypalClientSecret);
  return { stripe, paypal, demo: !stripe && !paypal && cfg.demoPayments };
}

/** Errore se il metodo scelto non è pagabile online con la configurazione attuale. */
export function assertPayable(cfg, paymentMethod) {
  if (paymentMethod === 'cod') return;
  const p = paymentProviders(cfg);
  if (paymentMethod === 'paypal' && (p.paypal || p.stripe || p.demo)) return;
  if (paymentMethod === 'card' && (p.stripe || p.demo)) return;
  throw new ValidationError('Il pagamento online non è ancora disponibile: scegli il contrassegno.', 'paymentMethod');
}

const euro = (c) => (c / 100).toFixed(2);

/* ---------------- PayPal Orders v2 ---------------- */

function paypalBase(cfg) {
  return cfg.paypalEnv === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}
let paypalToken = null;
async function paypalFetch(ctx, method, pathname, body, { requestId } = {}) {
  const { cfg } = ctx;
  const doFetch = ctx.fetch || fetch;
  if (!paypalToken || paypalToken.exp < Date.now() || paypalToken.key !== cfg.paypalClientId) {
    const auth = Buffer.from(`${cfg.paypalClientId}:${cfg.paypalClientSecret}`).toString('base64');
    const tr = await doFetch(`${paypalBase(cfg)}/v1/oauth2/token`, {
      method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials', signal: AbortSignal.timeout(10_000),
    });
    if (!tr.ok) throw Object.assign(new Error(`PayPal OAuth ${tr.status}`), { status: 502 });
    const tj = await tr.json();
    paypalToken = { value: tj.access_token, exp: Date.now() + (Number(tj.expires_in) - 60) * 1000, key: cfg.paypalClientId };
  }
  const res = await doFetch(`${paypalBase(cfg)}${pathname}`, {
    method,
    headers: {
      authorization: `Bearer ${paypalToken.value}`, 'content-type': 'application/json', prefer: 'return=representation',
      ...(requestId ? { 'paypal-request-id': requestId } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(`PayPal ${method} ${pathname} -> ${res.status} ${json?.name || ''}`), { status: 502, paypal: json });
  return json;
}
export function resetPaypalToken() { paypalToken = null; }

/* ---------------- avvio del pagamento ---------------- */

/**
 * Crea la sessione di pagamento per un ordine in attesa e restituisce {provider, url}.
 * Usata alla creazione dell'ordine e da "Paga ora" nell'area personale.
 */
export async function startPayment(ctx, order, req) {
  const { cfg, repo } = ctx;
  if (order.paymentMethod === 'cod') return { provider: 'cod', url: null };
  if (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded' || order.status === 'annullato') {
    throw new ValidationError('Questo ordine non è in attesa di pagamento', 'orderId');
  }
  assertPayable(cfg, order.paymentMethod);
  const providers = paymentProviders(cfg);
  const base = baseUrl(cfg, req);
  const esito = (e) => `${base}/pagamento/esito.html?order=${encodeURIComponent(order.orderId)}&esito=${e}`;
  const attempt = (order.payment?.attempts ?? 0) + 1;

  if (order.paymentMethod === 'paypal' && providers.paypal) {
    const pp = await paypalFetch(ctx, 'POST', '/v2/checkout/orders', {
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: order.orderId, custom_id: order.orderId, invoice_id: `${order.orderId}-${attempt}`,
        description: `Ordine ${order.orderId} - Animol Life`,
        amount: { currency_code: 'EUR', value: euro(order.totalCents) },
      }],
      payment_source: { paypal: { experience_context: {
        brand_name: 'Animol Life', locale: 'it-IT', user_action: 'PAY_NOW', shipping_preference: 'NO_SHIPPING',
        return_url: `${base}/api/payments/paypal/return?order=${encodeURIComponent(order.orderId)}`,
        cancel_url: esito('annullato'),
      } } },
    }, { requestId: `${order.orderId}-${attempt}` });
    const link = (pp.links || []).find((l) => l.rel === 'payer-action' || l.rel === 'approve');
    if (!pp.id || !link || !/^https:\/\//.test(link.href)) throw Object.assign(new Error('Risposta PayPal non valida'), { status: 502 });
    repo.orders.update(order.orderId, (o) => { o.payment = { ...o.payment, provider: 'paypal', ref: pp.id, attempts: attempt, startedAt: new Date().toISOString() }; });
    return { provider: 'paypal', url: link.href };
  }

  if (providers.stripe) {
    const stripe = await getStripe(cfg);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Un'unica riga con il totale calcolato dal server (sconti e spedizione inclusi): l'importo coincide al centesimo.
      line_items: [{
        quantity: 1,
        price_data: {
          currency: 'eur', unit_amount: order.totalCents,
          product_data: {
            name: `Ordine ${order.orderId}`,
            description: order.lines.map((l) => `${l.qty}x ${l.name}${l.variant ? ` (${l.variant})` : ''}`).join(', ').slice(0, 500),
          },
        },
      }],
      client_reference_id: order.orderId,
      metadata: { orderId: order.orderId },
      payment_intent_data: { metadata: { orderId: order.orderId } },
      customer_email: order.customer.email,
      locale: 'it',
      expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
      success_url: `${esito('ok')}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: esito('annullato'),
    }, { idempotencyKey: `${order.orderId}-${attempt}` });
    repo.orders.update(order.orderId, (o) => { o.payment = { ...o.payment, provider: 'stripe', ref: session.id, attempts: attempt, startedAt: new Date().toISOString() }; });
    return { provider: 'stripe', url: session.url };
  }

  // Demo: token casuale legato all'ordine, solo il suo hash resta sul server.
  const token = crypto.randomBytes(24).toString('base64url');
  repo.orders.update(order.orderId, (o) => { o.payment = { ...o.payment, provider: 'demo', ref: null, demoTokenHash: hashToken(token), attempts: attempt, startedAt: new Date().toISOString() }; });
  return { provider: 'demo', url: `/pagamento/demo.html?order=${encodeURIComponent(order.orderId)}&token=${token}` };
}

/* ---------------- cambi di stato del pagamento ---------------- */

/** Segna l'ordine come pagato solo se importo e valuta coincidono con il totale del server. */
export async function markPaid(ctx, orderId, { provider, amountCents, currency = 'eur', ref = null, captureId = null, by = 'system' }) {
  const { cfg, repo } = ctx;
  let mismatch = false;
  let changed = false;
  const order = repo.orders.update(orderId, (o) => {
    if (o.paymentStatus === 'paid') return false;
    if (amountCents !== o.totalCents || String(currency).toLowerCase() !== 'eur') {
      mismatch = true;
      o.payment = { ...o.payment, mismatch: { amountCents, currency, at: new Date().toISOString() } };
      return true;
    }
    o.paymentStatus = 'paid';
    o.payment = { ...o.payment, provider, paidAt: new Date().toISOString(), ...(ref ? { intent: ref } : {}), ...(captureId ? { captureId } : {}) };
    o.history = [...(o.history || []), { at: new Date().toISOString(), event: 'paid', by }];
    changed = true;
  });
  if (!order) return { ok: false, reason: 'not_found' };
  if (mismatch) {
    console.error(`[payments] importo non corrispondente per ${orderId}: ${amountCents} ${currency} invece di ${order.totalCents} eur`);
    return { ok: false, reason: 'amount_mismatch' };
  }
  if (changed) {
    await sendEmail(cfg, {
      tag: 'order-paid', to: order.customer.email, subject: `Animol Life - pagamento ricevuto per l'ordine ${order.orderId}`,
      text: `Ciao ${order.customer.name},\nabbiamo ricevuto il pagamento di ${euro(order.totalCents)} € per l'ordine ${order.orderId}. Ti avviseremo alla spedizione.\nIl team Animol Life`,
    });
  }
  return { ok: true, order };
}

export function markPaymentFailed(ctx, orderId, reason) {
  return ctx.repo.orders.update(orderId, (o) => {
    if (o.paymentStatus !== 'pending') return false;
    o.paymentStatus = 'failed';
    o.history = [...(o.history || []), { at: new Date().toISOString(), event: `payment_failed:${reason}` }];
  });
}

/** Rimborso totale presso il provider (Stripe/PayPal); in demo e per il contrassegno è solo registrato. */
export async function refundPayment(ctx, order) {
  const p = order.payment || {};
  if (order.paymentStatus !== 'paid') return { provider: null };
  if (p.provider === 'stripe' && p.intent) {
    const stripe = await getStripe(ctx.cfg);
    const r = await stripe.refunds.create({ payment_intent: p.intent }, { idempotencyKey: `refund-${order.orderId}` });
    return { provider: 'stripe', refundId: r.id };
  }
  if (p.provider === 'paypal' && p.captureId) {
    const r = await paypalFetch(ctx, 'POST', `/v2/payments/captures/${encodeURIComponent(p.captureId)}/refund`, {}, { requestId: `refund-${order.orderId}` });
    return { provider: 'paypal', refundId: r.id };
  }
  return { provider: p.provider || 'manuale' };
}

/* ---------------- webhook Stripe (ordini + abbonamenti Plus) ---------------- */

export async function handleStripeWebhook(ctx, rawBody, signature, { onSubscriptionEvent } = {}) {
  const { cfg, repo } = ctx;
  const stripe = await getStripe(cfg);
  if (!stripe || !cfg.stripeWebhookSecret) throw Object.assign(new Error('Stripe non configurato'), { status: 503 });
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, cfg.stripeWebhookSecret);
  } catch {
    throw Object.assign(new Error('Firma Stripe non valida'), { status: 400 });
  }
  if (!repo.webhookEvents.claim(event.id, 'stripe', event.type)) return { received: true, duplicate: true, type: event.type };
  try {
    const obj = event.data.object;
    const orderId = obj?.metadata?.orderId;
    if (obj?.object === 'checkout.session' && obj.mode === 'payment' && orderId && ORDER_ID_RE.test(orderId)) {
      const order = repo.orders.get(orderId);
      if (order && order.payment?.ref === obj.id) {
        if ((event.type === 'checkout.session.completed' && obj.payment_status === 'paid') || event.type === 'checkout.session.async_payment_succeeded') {
          await markPaid(ctx, orderId, { provider: 'stripe', amountCents: obj.amount_total, currency: obj.currency, ref: obj.payment_intent });
        } else if (event.type === 'checkout.session.async_payment_failed' || event.type === 'checkout.session.expired') {
          markPaymentFailed(ctx, orderId, event.type.split('.').pop());
        }
      }
    } else if (onSubscriptionEvent) {
      await onSubscriptionEvent(event);
    }
  } catch (err) {
    repo.webhookEvents.release(event.id); // Stripe ritenterà la consegna
    throw err;
  }
  return { received: true, type: event.type };
}

/* ---------------- rotte /api/payments ---------------- */

export function paymentRoutes(ctx) {
  const { cfg, repo } = ctx;
  const r = express.Router();
  const demoOrder = (orderId, token) => {
    if (!paymentProviders(cfg).demo) return null;
    if (typeof orderId !== 'string' || !ORDER_ID_RE.test(orderId) || typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
    const o = repo.orders.get(orderId);
    if (!o || o.payment?.provider !== 'demo' || !o.payment.demoTokenHash) return null;
    const a = Buffer.from(o.payment.demoTokenHash);
    const b = Buffer.from(hashToken(token));
    return a.length === b.length && crypto.timingSafeEqual(a, b) ? o : null;
  };

  r.get('/payments/config', (req, res) => {
    const p = paymentProviders(cfg);
    res.json({ stripe: p.stripe, paypal: p.paypal, demo: p.demo, cod: true });
  });

  // Pagina demo: mostra solo importo e numero d'ordine, e solo a chi ha il token del link.
  r.get('/payments/demo/:orderId', (req, res) => {
    const o = demoOrder(req.params.orderId, req.query.token);
    if (!o) return res.status(404).json({ error: 'not_found', message: 'Pagamento non trovato' });
    res.json({ demo: true, orderId: o.orderId, total: o.totalCents / 100, currency: 'EUR', paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod });
  });

  r.post('/payments/demo/:orderId', async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const o = demoOrder(req.params.orderId, body.token);
    if (!o) return res.status(404).json({ error: 'not_found', message: 'Pagamento non trovato' });
    if (body.outcome === 'success') {
      await markPaid(ctx, o.orderId, { provider: 'demo', amountCents: o.totalCents, currency: 'eur', by: 'demo' });
      repo.orders.update(o.orderId, (x) => { delete x.payment.demoTokenHash; });
      return res.json({ ok: true, paymentStatus: 'paid', redirect: `/pagamento/esito.html?order=${o.orderId}&esito=ok` });
    }
    if (body.outcome === 'cancel') return res.json({ ok: true, paymentStatus: o.paymentStatus, redirect: `/pagamento/esito.html?order=${o.orderId}&esito=annullato` });
    throw new ValidationError('Esito non valido', 'outcome');
  });

  // Ritorno da PayPal: il server cattura il pagamento e verifica importo e riferimento prima di segnarlo pagato.
  r.get('/payments/paypal/return', async (req, res) => {
    const orderId = String(req.query.order || '');
    const ppId = String(req.query.token || '');
    const fail = () => res.redirect(303, `/pagamento/esito.html?order=${encodeURIComponent(ORDER_ID_RE.test(orderId) ? orderId : '')}&esito=errore`);
    if (!ORDER_ID_RE.test(orderId) || !/^[A-Z0-9-]{5,40}$/i.test(ppId) || !paymentProviders(cfg).paypal) return fail();
    const o = repo.orders.get(orderId);
    if (!o || o.payment?.provider !== 'paypal' || o.payment.ref !== ppId) return fail();
    if (o.paymentStatus === 'paid') return res.redirect(303, `/pagamento/esito.html?order=${orderId}&esito=ok`);
    try {
      const cap = await paypalFetch(ctx, 'POST', `/v2/checkout/orders/${encodeURIComponent(ppId)}/capture`, {}, { requestId: `capture-${ppId}` });
      const unit = cap.purchase_units?.[0];
      const capture = unit?.payments?.captures?.[0];
      const amountCents = Math.round(Number(capture?.amount?.value) * 100);
      const okRef = (capture?.custom_id ?? unit?.custom_id ?? unit?.reference_id) === orderId;
      if (cap.status !== 'COMPLETED' || capture?.status !== 'COMPLETED' || !okRef) return fail();
      const r2 = await markPaid(ctx, orderId, { provider: 'paypal', amountCents, currency: capture.amount.currency_code, ref: ppId, captureId: capture.id });
      return res.redirect(303, `/pagamento/esito.html?order=${orderId}&esito=${r2.ok ? 'ok' : 'errore'}`);
    } catch (err) {
      console.error('[payments] cattura PayPal non riuscita:', err.message);
      return fail();
    }
  });

  return r;
}
