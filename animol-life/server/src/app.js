// Applicazione Express: API del negozio, assistente IA, Plus, agente vocale e file statici.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';
import { Catalog, exportProduct } from './catalog.js';
import { stores as makeStores } from './store.js';
import { openRepo } from './repo.js';
import { createAssistant } from './assistant.js';
import { createOrder, lookupOrder, resolveCart, parseShippingMethod, resolveCoupon, orderSummary } from './orders.js';
import { subscribe, confirm, unsubscribe } from './newsletter.js';
import { subscribePlus, cancelPlus, handlePlusStripeEvent, plusStatus, isPlusMember, removeMember, findMember } from './plus.js';
import { handleStripeWebhook, paymentRoutes, startPayment, paymentProviders } from './payments.js';
import { authRoutes, loadSessions, csrfProtection, requireUser, publicUser } from './auth.js';
import { adminRoutes, bootstrapAdmin, defaultCoupons } from './admin.js';
import { upcomingLives } from './lives.js';
import { createLead } from './leads.js';
import { computeTotals } from './policies.js';
import { createVoiceAgent, validateTwilio } from './voice.js';
import { securityHeaders, rateLimit, ValidationError, requireEmail, isPlainObject } from './security.js';

const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

function page(title, message) {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} - Animol Life</title>` +
    '<style>body{font-family:system-ui,sans-serif;max-width:560px;margin:15vh auto;padding:0 16px;color:#1f2937;background:#fffaf5}a{color:#c2410c}</style></head>' +
    `<body><h1>${esc(title)}</h1><p>${esc(message)}</p><p><a href="/">Torna al negozio</a></p></body></html>`;
}

export function createApp(options = {}) {
  const cfg = options.config ?? loadConfig();
  const repo = options.repo ?? openRepo(cfg.dataDir);
  const catalog = options.catalog ?? new Catalog(cfg.publicDir, { repo, exportFile: cfg.catalogExportFile });
  const stores = options.stores ?? makeStores(cfg.dataDir, repo);
  repo.coupons.seed(defaultCoupons());
  const assistant = options.assistant ?? createAssistant({ cfg, catalog, stores, client: options.anthropicClient });
  const voice = createVoiceAgent({ cfg, assistant });
  const ctx = { cfg, catalog, stores, repo, fetch: options.fetch };
  const ready = bootstrapAdmin(ctx, { log: cfg.env === 'test' ? () => {} : console.log });
  ready.catch((err) => console.error('[admin] bootstrap non riuscito:', err.message));
  const sessionPurge = setInterval(() => repo.sessions.purgeExpired(), 3_600_000);
  sessionPurge.unref();

  /* ----- funzioni dell'area personale (GDPR) ----- */
  const startOrderPayment = async (order, req) => {
    const r = await startPayment(ctx, order, req);
    return { orderId: order.orderId, paymentProvider: r.provider, paymentUrl: r.url };
  };
  const exportAccountData = async (user) => ({
    exportedAt: new Date().toISOString(),
    notice: 'Copia dei dati personali che Animol Life conserva sul tuo account (art. 15 e 20 GDPR).',
    account: publicUser(user),
    orders: repo.orders.listByUser(user.id).map((o) => orderSummary(o, { full: true })),
    plus: await findMember(stores, user.id).then((m) => m && { plan: m.plan, status: m.status, since: m.createdAt, trialEndsAt: m.trialEndsAt || null, currentPeriodEnd: m.currentPeriodEnd || null }),
    newsletter: (await stores.newsletter.read()).filter((n) => n.email === user.email).map((n) => ({ status: n.status, consentAt: n.consentAt, confirmedAt: n.confirmedAt || null })),
    savedCarts: (await stores.carts.read()).filter((c) => c.email === user.email).map((c) => ({ items: c.items, updatedAt: c.updatedAt })),
    activeSessions: repo.sessions.countForUser(user.id),
  });
  const deleteAccountData = async (user) => {
    await removeMember(ctx, user);
    await stores.newsletter.update((list) => { const i = list.findIndex((n) => n.email === user.email); if (i >= 0) list.splice(i, 1); });
    await stores.carts.update((list) => { for (let i = list.length - 1; i >= 0; i -= 1) if (list[i].email === user.email) list.splice(i, 1); });
    repo.orders.detachUser(user.id);
    repo.users.delete(user.id); // sessioni e token cancellati a cascata
    repo.loginFailures.clear(`customer:${user.email}`);
  };

  const app = express();
  app.disable('x-powered-by');
  if (cfg.trustProxy) app.set('trust proxy', /^\d+$/.test(cfg.trustProxy) ? Number(cfg.trustProxy) : cfg.trustProxy);
  app.use(securityHeaders(cfg));

  const rl = cfg.rateLimit;
  const limit = (name, max) => rateLimit({ windowMs: rl.windowMs, max, name });

  // Webhook Stripe: serve il corpo grezzo per verificare la firma, quindi va prima di express.json().
  app.post('/api/stripe/webhook', express.raw({ type: 'application/json', limit: '256kb' }), async (req, res, next) => {
    try {
      res.json(await handleStripeWebhook(ctx, req.body, req.get('stripe-signature'), { onSubscriptionEvent: (e) => handlePlusStripeEvent(ctx, e) }));
    } catch (err) {
      next(err);
    }
  });

  app.use('/api', limit('general', rl.general), express.json({ limit: '32kb' }));
  app.use(loadSessions(ctx));
  app.use('/api', csrfProtection(cfg));
  app.use(['/admin', '/api/admin'], (req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });
  app.use('/voice', express.urlencoded({ extended: false, limit: '16kb', parameterLimit: 100 }));
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  app.get('/api/health', async (req, res) => {
    const products = await catalog.all();
    res.json({
      status: 'ok',
      version: pkg.version,
      time: new Date().toISOString(),
      catalog: { source: catalog.source, seed: catalog.seed ?? null, count: products.length },
      integrations: {
        ai: assistant.mode,
        stripe: Boolean(cfg.stripeSecretKey),
        paypal: paymentProviders(cfg).paypal,
        demoPayments: paymentProviders(cfg).demo,
        twilioSignature: Boolean(cfg.twilioAuthToken),
        humanTransfer: Boolean(cfg.humanPhoneNumber),
        email: cfg.emailWebhookUrl ? 'webhook' : 'demo',
      },
    });
  });

  app.post('/api/assistant', limit('assistant', rl.assistant), async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const { reply, products } = await assistant.answer({ messages: body.messages, cart: body.cart, channel: 'web' });
    res.json(products?.length ? { reply, products } : { reply });
  });

  app.use('/api', authRoutes(ctx, {
    plusStatus: (userId) => plusStatus(stores, userId), deleteAccountData, exportAccountData, startOrderPayment, orderSummary,
  }));
  app.use('/api', paymentRoutes(ctx));
  app.use('/api/admin', adminRoutes(ctx, { aiClient: options.anthropicClient }));

  // Catalogo pubblico (solo prodotti attivi), usato dalla vetrina al posto del catalogo incorporato.
  app.get('/api/products', async (req, res) => {
    res.json({ products: (await catalog.all()).map(exportProduct), currency: 'EUR' });
  });

  app.post('/api/coupons/validate', limit('forms', rl.forms), (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    if (typeof body.code !== 'string' || !body.code.trim()) throw new ValidationError('Inserisci un codice', 'code');
    // 200 anche per i codici non validi: è una risposta prevista, non un errore della richiesta.
    let c = null;
    try { c = resolveCoupon(repo, body.code); } catch (err) { if (!(err instanceof ValidationError)) throw err; }
    res.json(c ? { valid: true, code: c.code, percent: c.percent, description: c.description } : { valid: false, message: 'Codice non valido o scaduto' });
  });

  app.post('/api/orders', limit('orders', rl.orders), async (req, res) => {
    const order = await createOrder(ctx, req.body, { user: req.user ?? null });
    let payment = { paymentProvider: order.paymentMethod === 'cod' ? 'cod' : null, paymentUrl: null };
    let paymentError = null;
    if (order.paymentMethod !== 'cod') {
      try {
        payment = await startOrderPayment(repo.orders.get(order.orderId), req);
      } catch (err) {
        console.error('[payments] avvio del pagamento non riuscito:', err.message);
        paymentError = 'Non è stato possibile avviare il pagamento: riprova da "I miei ordini" o contatta l\'assistenza.';
      }
    }
    res.status(201).json({
      ...payment,
      ...(paymentError ? { paymentError } : {}),
      paymentStatus: order.paymentStatus,
      account: Boolean(order.userId),
      orderId: order.orderId,
      total: order.total,
      subtotal: order.subtotalCents / 100,
      discount: (order.couponDiscountCents + order.plusDiscountCents) / 100,
      shipping: order.shippingCents / 100,
      shippingMethod: order.shippingMethod,
      paymentMethod: order.paymentMethod,
      plusApplied: order.isPlus,
      currency: 'EUR',
      status: order.status,
    });
  });

  // Anteprima totali (opzionale, utile al checkout): stessi calcoli dell'ordine, nulla viene salvato.
  app.post('/api/cart/quote', limit('quote', rl.general), async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const lines = await resolveCart(catalog, body.items ?? body.cart);
    const coupon = resolveCoupon(repo, body.coupon);
    const shippingMethod = parseShippingMethod(body);
    const isPlus = req.user ? await isPlusMember(stores, req.user.id) : false;
    const t = computeTotals({ lines, couponCode: coupon?.code ?? null, couponPercent: coupon?.percent ?? 0, isPlus, shipping: cfg.shipping, shippingMethod });
    res.json({ subtotal: t.subtotalCents / 100, discount: (t.couponDiscountCents + t.plusDiscountCents) / 100, shipping: t.shippingCents / 100, shippingMethod, total: t.totalCents / 100, plusApplied: isPlus, currency: 'EUR' });
  });

  app.post('/api/order-status', limit('orders', rl.orders), async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const result = await lookupOrder(stores, { orderId: body.orderId, email: body.email, cap: body.cap });
    if (!result) return res.status(404).json({ error: 'not_found', message: 'Nessun ordine trovato con questo numero.' });
    res.json(result);
  });

  // Snapshot carrello per i promemoria (solo con consenso marketing esplicito).
  app.post('/api/carts', limit('forms', rl.forms), async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const email = requireEmail(body);
    if (body.consent !== true) throw new ValidationError('Serve il consenso per ricevere promemoria sul carrello', 'consent');
    const lines = await resolveCart(catalog, body.items ?? body.cart);
    await stores.carts.update((carts) => {
      const i = carts.findIndex((c) => c.email === email);
      const rec = { email, items: lines.map(({ id, variant, qty }) => ({ id, variant, qty })), updatedAt: new Date().toISOString(), remindedAt: null };
      if (i >= 0) carts[i] = rec;
      else carts.push(rec);
    });
    res.json({ ok: true });
  });

  // Contatti B2B dalla landing /vendita/. Honeypot compilato: risposta di successo, nulla salvato.
  app.post('/api/leads', limit('forms', rl.forms), limit('leads', rl.leads), async (req, res) => {
    const r = await createLead(ctx, req.body);
    res.status(r.dropped ? 202 : 201).json({ ok: true });
  });

  app.post('/api/newsletter', limit('forms', rl.forms), async (req, res) => {
    res.status(202).json(await subscribe(ctx, req.body, req));
  });
  app.get('/api/newsletter/confirm', async (req, res) => {
    const r = await confirm(ctx, req.query.token);
    res.status(r.ok ? 200 : 400).type('html').send(
      r.ok ? page('Iscrizione confermata', 'Grazie! Da ora riceverai la newsletter di Animol Life. Puoi disiscriverti in qualsiasi momento.')
        : page('Link non valido', 'Il link di conferma non è valido o è scaduto. Prova a iscriverti di nuovo.'),
    );
  });
  app.get('/api/newsletter/unsubscribe', async (req, res) => {
    const r = await unsubscribe(ctx, req.query.token);
    res.status(r.ok ? 200 : 400).type('html').send(
      r.ok ? page('Disiscrizione completata', 'I tuoi dati sono stati cancellati dalla lista della newsletter.') : page('Link non valido', 'Il link non è valido.'),
    );
  });

  // Plus è legato all'account: serve l'accesso (sessione + token CSRF).
  app.post('/api/plus/subscribe', limit('forms', rl.forms), requireUser, async (req, res) => {
    res.json(await subscribePlus(ctx, req.body, req));
  });
  app.post('/api/plus/cancel', limit('forms', rl.forms), requireUser, async (req, res) => {
    res.status(202).json(await cancelPlus(ctx, req));
  });
  app.get('/api/plus/lives', async (req, res) => {
    res.json(await upcomingLives(cfg));
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', message: 'Endpoint inesistente' }));

  // Agente vocale (Twilio). La firma viene verificata se TWILIO_AUTH_TOKEN è impostato.
  const twilioCheck = validateTwilio(cfg);
  app.post('/voice/incoming', twilioCheck, (req, res) => {
    res.type('text/xml').send(voice.incoming(req));
  });
  app.post('/voice/respond', twilioCheck, async (req, res) => {
    res.type('text/xml').send(await voice.respond(req));
  });

  if (cfg.venditaDir && fs.existsSync(cfg.venditaDir)) {
    app.use('/vendita', express.static(cfg.venditaDir, { extensions: ['html'], maxAge: cfg.env === 'production' ? '1h' : 0, index: 'index.html', dotfiles: 'ignore' }));
  }
  app.use(express.static(cfg.publicDir, { extensions: ['html'], maxAge: cfg.env === 'production' ? '1h' : 0, index: 'index.html' }));
  app.use((req, res) => {
    const index = path.join(cfg.publicDir, 'index.html');
    if (req.method === 'GET' && req.accepts('html') && fs.existsSync(index)) return res.status(404).sendFile(index);
    res.status(404).type('text/plain').send('Pagina non trovata');
  });

  // Gestione errori centralizzata: niente stack trace verso il client.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'payload_too_large', message: 'Richiesta troppo grande' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json', message: 'JSON non valido' });
    if (err instanceof ValidationError) return res.status(400).json({ error: 'validation_error', message: err.message, field: err.field });
    const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
    if (status >= 500) console.error('[server]', err);
    res.status(status).json({ error: status >= 500 ? 'internal_error' : 'error', message: status >= 500 ? 'Errore interno, riprova più tardi.' : err.message });
  });

  Object.assign(app.locals, { cfg, catalog, stores, repo, assistant, voice, ready });
  return app;
}
