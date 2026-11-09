// Pannello di amministrazione: API /api/admin/* protette da sessione admin (cookie separato,
// SameSite=Strict, durata breve) + token CSRF; ogni modifica finisce nel registro azioni (audit log).
import crypto from 'node:crypto';
import express from 'express';
import { CATEGORIES, exportProduct } from './catalog.js';
import { COUPONS } from './policies.js';
import { sendEmail } from './email.js';
import { refundPayment } from './payments.js';
import { generateProductDescription } from '../automation/ai-content.js';
import { STATUS_LABELS } from './orders.js';
import {
  authenticate, AuthError, hashPassword, verifyPassword, cookieNames, setCookie, clearCookie, publicUser,
} from './auth.js';
import { ValidationError, isPlainObject, rateLimit } from './security.js';

/* ---------------- bootstrap dell'amministratore ---------------- */

/**
 * - ADMIN_EMAIL + ADMIN_PASSWORD: crea (o allinea) l'account admin con quella password;
 * - altrimenti, se non esiste nessun admin: lo crea con una password casuale stampata UNA volta in console.
 */
export async function bootstrapAdmin({ cfg, repo }, { log = console.log } = {}) {
  if (cfg.adminEmail && cfg.adminPassword) {
    if (cfg.adminPassword.length < 12) throw new Error('ADMIN_PASSWORD deve avere almeno 12 caratteri');
    const hash = await hashPassword(cfg.adminPassword, { cost: cfg.scryptCost });
    const u = repo.users.findByEmail(cfg.adminEmail);
    if (!u) {
      repo.users.create({ email: cfg.adminEmail, name: 'Amministratore', passwordHash: hash, role: 'admin' });
      log(`[admin] Creato l'amministratore ${cfg.adminEmail} (password da ADMIN_PASSWORD)`);
    } else if (u.role !== 'admin' || !(await verifyPassword(cfg.adminPassword, u.passwordHash))) {
      repo.users.setPassword(u.id, hash);
      repo.users.update(u.id, { role: 'admin' });
      repo.sessions.deleteForUser(u.id);
      log(`[admin] Allineato l'amministratore ${cfg.adminEmail} alla password di ADMIN_PASSWORD`);
    }
    return { email: cfg.adminEmail, created: !u };
  }
  if (repo.users.countByRole('admin') > 0) return { created: false };
  const email = cfg.adminEmail || 'admin@animol.local';
  if (repo.users.findByEmail(email)) throw new Error(`L'email ${email} appartiene già a un cliente: imposta ADMIN_EMAIL e ADMIN_PASSWORD`);
  const password = crypto.randomBytes(15).toString('base64url');
  repo.users.create({ email, name: 'Amministratore', passwordHash: await hashPassword(password, { cost: cfg.scryptCost }), role: 'admin' });
  log('\n==================================================================');
  log(' Primo avvio: creato l\'amministratore del pannello /admin');
  log(`   email:    ${email}`);
  log(`   password: ${password}`);
  log(' La password è mostrata SOLO ora: salvala in un gestore di password.');
  log(' Per impostarla tu usa ADMIN_EMAIL e ADMIN_PASSWORD nel file .env.');
  log('==================================================================\n');
  return { email, created: true, generated: true };
}

/* ---------------- validazione input admin ---------------- */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,79}$/;
const CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function str(v, field, { min = 0, max = 200, label = field, multiline = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') throw new ValidationError(`Campo "${label}" non valido`, field);
  const t = v.trim();
  if (t.length < min) throw new ValidationError(`Campo "${label}" obbligatorio (min ${min} caratteri)`, field);
  if (t.length > max) throw new ValidationError(`Campo "${label}" troppo lungo (max ${max})`, field);
  if (CTRL_RE.test(multiline ? t.replace(/[\n\t]/g, '') : t)) throw new ValidationError(`Campo "${label}" contiene caratteri non validi`, field);
  return t;
}

function money(v, field, { optional = false } = {}) {
  if ((v === null || v === undefined || v === '') && optional) return null;
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : v;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0.01 || n > 10000) throw new ValidationError(`Prezzo non valido in "${field}" (0,01-10.000 €)`, field);
  if (Math.abs(Math.round(n * 100) - n * 100) > 1e-6) throw new ValidationError(`Massimo due decimali in "${field}"`, field);
  return Math.round(n * 100) / 100;
}

export function slugify(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

/** Valida e normalizza un prodotto inviato dal pannello. existing: prodotto attuale in caso di modifica. */
export function validateProduct(body, existing = null) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const name = str(body.name ?? existing?.name, 'name', { min: 2, max: 120, label: 'nome' });
  const id = existing ? existing.id : (body.id ? String(body.id) : slugify(name));
  if (!SLUG_RE.test(id)) throw new ValidationError('Codice prodotto non valido (minuscole, numeri e trattini)', 'id');
  const category = body.category ?? existing?.category;
  if (!CATEGORIES.includes(category)) throw new ValidationError(`Categoria non valida: ${CATEGORIES.join(', ')}`, 'category');
  const price = money(body.price ?? existing?.price, 'price');
  const salePrice = money(body.salePrice === undefined ? existing?.salePrice : body.salePrice, 'salePrice', { optional: true });
  if (salePrice !== null && salePrice >= price) throw new ValidationError('Il prezzo scontato deve essere inferiore al prezzo pieno', 'salePrice');

  const rawVariants = body.variants === undefined ? (existing?.variants ?? []) : body.variants;
  if (!Array.isArray(rawVariants) || rawVariants.length > 20) throw new ValidationError('Varianti non valide (massimo 20)', 'variants');
  const labels = new Set();
  const variants = rawVariants.map((v, i) => {
    if (!isPlainObject(v)) throw new ValidationError(`Variante ${i + 1} non valida`, 'variants');
    const label = str(v.label, 'variants', { min: 1, max: 40, label: `etichetta variante ${i + 1}` });
    if (labels.has(label)) throw new ValidationError(`Variante duplicata: ${label}`, 'variants');
    labels.add(label);
    const vp = money(v.price, 'variants');
    const vs = money(v.salePrice, 'variants', { optional: true });
    if (vs !== null && vs >= vp) throw new ValidationError(`Variante ${label}: il prezzo scontato deve essere inferiore al prezzo pieno`, 'variants');
    return { label, price: vp, salePrice: vs };
  });

  const rawSpecs = body.specs === undefined ? (existing?.specs ?? {}) : body.specs;
  if (!isPlainObject(rawSpecs) || Object.keys(rawSpecs).length > 30) throw new ValidationError('Specifiche non valide (massimo 30)', 'specs');
  const specs = Object.fromEntries(Object.entries(rawSpecs).map(([k, v]) => {
    const key = str(k, 'specs', { min: 1, max: 40, label: 'nome specifica' });
    if (FORBIDDEN_KEYS.has(key)) throw new ValidationError('Nome specifica non consentito', 'specs');
    return [key, str(typeof v === 'number' ? String(v) : v, 'specs', { min: 1, max: 200, label: `specifica ${key}` })];
  }));

  let stock = body.stock === undefined ? (existing?.stock ?? null) : body.stock;
  if (stock === '' ) stock = null;
  if (stock !== null && (!Number.isInteger(Number(stock)) || Number(stock) < 0 || Number(stock) > 1_000_000)) throw new ValidationError('Scorte non valide (numero intero ≥ 0, vuoto = non gestite)', 'stock');
  if (stock !== null) stock = Number(stock);
  const active = body.active === undefined ? (existing?.active ?? true) : body.active;
  if (typeof active !== 'boolean') throw new ValidationError('Valore "attivo" non valido', 'active');

  return {
    id, name, brand: str(body.brand ?? existing?.brand, 'brand', { max: 60, label: 'marca' }), category, price, salePrice,
    rating: existing?.rating ?? 0, reviews: existing?.reviews ?? 0, sold: existing?.sold ?? 0,
    description: str(body.description ?? existing?.description, 'description', { max: 2000, label: 'descrizione', multiline: true }),
    specs, variants, stock, active,
  };
}

export function validateCoupon(body, existingCode = null) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const code = existingCode || String(body.code ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) throw new ValidationError('Codice coupon non valido (3-20 lettere o cifre)', 'code');
  const percent = Number(body.percent);
  if (!Number.isInteger(percent) || percent < 1 || percent > 50) throw new ValidationError('Percentuale di sconto non valida (1-50)', 'percent');
  const date = (v, f) => {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ValidationError('Data non valida (AAAA-MM-GG)', f);
    return v;
  };
  const validFrom = date(body.validFrom, 'validFrom');
  const validTo = date(body.validTo, 'validTo');
  if (validFrom && validTo && validTo < validFrom) throw new ValidationError('La data di fine precede quella di inizio', 'validTo');
  let maxUses = body.maxUses === undefined || body.maxUses === null || body.maxUses === '' ? null : Number(body.maxUses);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1_000_000)) throw new ValidationError('Numero massimo di utilizzi non valido', 'maxUses');
  const active = body.active === undefined ? true : body.active;
  if (typeof active !== 'boolean') throw new ValidationError('Valore "attivo" non valido', 'active');
  return { code, percent, description: str(body.description, 'description', { max: 120, label: 'descrizione' }), active, validFrom, validTo, maxUses };
}

/** CSV con protezione dalla formula injection (Excel/LibreOffice). */
export function toCsv(rows, columns) {
  const cell = (v) => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [columns.map((c) => cell(c.label)).join(';'), ...rows.map((r) => columns.map((c) => cell(r[c.key])).join(';'))].join('\r\n') + '\r\n';
}

/* ---------------- stati dell'ordine ---------------- */

const ACTIONS = {
  paid: { label: 'pagato' },
  processing: { label: 'in preparazione' },
  shipped: { label: 'spedito' },
  delivered: { label: 'consegnato' },
  refunded: { label: 'rimborsato' },
  canceled: { label: 'annullato' },
};

function validateTracking(t) {
  if (!isPlainObject(t)) throw new ValidationError('Per la spedizione servono corriere e numero di tracciamento', 'tracking');
  const carrier = str(t.carrier, 'tracking', { min: 2, max: 50, label: 'corriere' });
  const code = str(t.code, 'tracking', { min: 4, max: 60, label: 'numero di tracciamento' });
  if (!/^[A-Za-z0-9-]+$/.test(code)) throw new ValidationError('Numero di tracciamento non valido', 'tracking');
  let url = t.url ? str(t.url, 'tracking', { max: 300, label: 'link di tracciamento' }) : null;
  if (url) {
    let u;
    try { u = new URL(url); } catch { throw new ValidationError('Link di tracciamento non valido', 'tracking'); }
    if (u.protocol !== 'https:') throw new ValidationError('Il link di tracciamento deve iniziare con https://', 'tracking');
    url = u.toString();
  }
  return { carrier, code, url };
}

/* ---------------- rotte ---------------- */

export function adminRoutes(ctx, { aiClient } = {}) {
  const { cfg, repo, stores, catalog } = ctx;
  const r = express.Router();
  const names = cookieNames(cfg);
  const ttlMs = cfg.adminSessionHours * 3_600_000;
  const loginLimit = rateLimit({ windowMs: 15 * 60_000, max: cfg.rateLimit.auth * 2, name: 'admin-login' });
  const aiLimit = rateLimit({ windowMs: 60_000, max: 10, name: 'admin-ai' });
  const audit = (req, action, target, details) => repo.audit.log({ actor: req.admin, action, target, details, ip: req.ip });

  r.use((req, res, next) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    next();
  });

  r.post('/login', loginLimit, async (req, res) => {
    try {
      const user = await authenticate(ctx, req.body, { role: 'admin' });
      if (req.adminToken) repo.sessions.delete(req.adminToken);
      const s = repo.sessions.create({ userId: user.id, kind: 'admin', ttlMs });
      setCookie(res, cfg, req, names.admin, s.token, { maxAgeMs: ttlMs, sameSite: 'Strict' });
      repo.audit.log({ actor: user, action: 'admin.login', ip: req.ip });
      res.json({ admin: publicUser(user), csrfToken: s.csrf });
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      repo.audit.log({ actor: null, action: 'admin.login_failed', target: String(req.body?.email ?? '').slice(0, 254), ip: req.ip });
      if (err.extra.retryAfter) res.setHeader('Retry-After', String(err.extra.retryAfter));
      res.status(err.status).json({ error: err.status === 429 ? 'locked' : 'invalid_credentials', message: err.message });
    }
  });

  // Da qui in poi: solo amministratori autenticati (il CSRF è verificato a monte, in csrfProtection).
  r.use((req, res, next) => {
    if (!req.admin || req.admin.role !== 'admin') return res.status(401).json({ error: 'unauthorized', message: 'Accesso amministratore richiesto' });
    next();
  });

  r.get('/me', (req, res) => res.json({ admin: publicUser(req.admin), csrfToken: req.adminSession.csrf }));

  r.post('/logout', (req, res) => {
    repo.sessions.delete(req.adminToken);
    clearCookie(res, cfg, req, names.admin);
    audit(req, 'admin.logout');
    res.json({ ok: true });
  });

  /* ----- dashboard ----- */
  r.get('/dashboard', async (req, res) => {
    const now = new Date();
    const today = new Date(now); today.setHours(0, 0, 0, 0);
    const from30 = new Date(now.getTime() - 30 * 86_400_000);
    const orders = repo.orders.since(from30.toISOString());
    // Vendite: ordini pagati o in contrassegno, esclusi annullati e rimborsati.
    const counted = orders.filter((o) => ['paid', 'cod'].includes(o.paymentStatus) && !['annullato', 'rimborsato'].includes(o.status));
    const sum = (list) => list.reduce((s, o) => s + o.totalCents, 0);
    const todayList = counted.filter((o) => Date.parse(o.createdAt) >= today.getTime());
    const plus = (await stores.plus.read()).members;
    res.json({
      today: { salesCents: sum(todayList), orders: todayList.length },
      last30: {
        salesCents: sum(counted), orders: counted.length, aovCents: counted.length ? Math.round(sum(counted) / counted.length) : 0,
        allOrders: orders.length,
        pendingPayment: orders.filter((o) => o.paymentStatus === 'pending').length,
        toShip: orders.filter((o) => ['paid', 'cod'].includes(o.paymentStatus) && ['ricevuto', 'in_preparazione'].includes(o.status)).length,
      },
      plus: { active: plus.filter((m) => ['active', 'trialing'].includes(m.status)).length, total: plus.length },
      customers: repo.users.countByRole('customer'),
      lowStock: repo.products.list().filter((p) => p.stock !== null && p.stock <= cfg.lowStockThreshold).map((p) => ({ id: p.id, name: p.name, stock: p.stock })),
    });
  });

  /* ----- ordini ----- */
  r.get('/orders', (req, res) => {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 50, 1), 200);
    const offset = Math.max(Number.parseInt(req.query.offset, 10) || 0, 0);
    const status = typeof req.query.status === 'string' && Object.hasOwn(STATUS_LABELS, req.query.status) ? req.query.status : undefined;
    const paymentStatus = typeof req.query.payment === 'string' && ['pending', 'paid', 'failed', 'refunded', 'cod'].includes(req.query.payment) ? req.query.payment : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : '';
    const out = repo.orders.list({ status, paymentStatus, q, limit, offset });
    res.json({
      total: out.total,
      orders: out.orders.map((o) => ({
        orderId: o.orderId, createdAt: o.createdAt, status: o.status, paymentStatus: o.paymentStatus, paymentMethod: o.paymentMethod,
        shippingMethod: o.shippingMethod, total: o.total, customer: { name: o.customer.name, email: o.customer.email }, account: Boolean(o.userId),
        items: o.lines.reduce((s, l) => s + l.qty, 0), tracking: o.tracking || null,
      })),
    });
  });

  r.get('/orders/:id', (req, res) => {
    const o = repo.orders.get(req.params.id);
    if (!o) return res.status(404).json({ error: 'not_found', message: 'Ordine non trovato' });
    const { payment, ...rest } = o;
    res.json({ order: { ...rest, payment: payment ? { provider: payment.provider, ref: payment.ref ?? null, paidAt: payment.paidAt ?? null, mismatch: payment.mismatch ?? null } : null } });
  });

  r.post('/orders/:id/status', async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const action = body.action;
    if (!Object.hasOwn(ACTIONS, action)) throw new ValidationError(`Azione non valida: ${Object.keys(ACTIONS).join(', ')}`, 'action');
    const current = repo.orders.get(req.params.id);
    if (!current) return res.status(404).json({ error: 'not_found', message: 'Ordine non trovato' });
    const tracking = action === 'shipped' ? validateTracking(body.tracking) : null;
    const closed = ['annullato', 'rimborsato'].includes(current.status);
    if (closed) throw new ValidationError('L\'ordine è chiuso (annullato o rimborsato)', 'action');
    if (action === 'paid' && current.paymentStatus === 'paid') throw new ValidationError('L\'ordine risulta già pagato', 'action');
    if (['shipped', 'delivered', 'processing'].includes(action) && !['paid', 'cod'].includes(current.paymentStatus)) {
      throw new ValidationError('Prima registra il pagamento dell\'ordine', 'action');
    }
    if (action === 'delivered' && current.status !== 'spedito') throw new ValidationError('Si può segnare consegnato solo un ordine spedito', 'action');
    if (action === 'canceled' && current.paymentStatus === 'paid') throw new ValidationError('L\'ordine è pagato: usa "rimborsato"', 'action');
    let refund = null;
    if (action === 'refunded') {
      if (current.paymentStatus !== 'paid') throw new ValidationError('Si può rimborsare solo un ordine pagato', 'action');
      refund = await refundPayment(ctx, current);
    }
    const at = new Date().toISOString();
    const order = repo.orders.update(current.orderId, (o) => {
      if (action === 'paid') { o.paymentStatus = 'paid'; o.payment = { ...o.payment, provider: o.payment?.provider || 'manuale', paidAt: at }; }
      if (action === 'processing') o.status = 'in_preparazione';
      if (action === 'shipped') { o.status = 'spedito'; o.tracking = { ...tracking, shippedAt: at }; }
      if (action === 'delivered') { o.status = 'consegnato'; o.deliveredAt = at; }
      if (action === 'refunded') { o.paymentStatus = 'refunded'; o.status = 'rimborsato'; o.refund = { ...refund, at }; repo.orders.restock(o); }
      if (action === 'canceled') { o.status = 'annullato'; if (o.paymentStatus === 'pending') o.paymentStatus = 'failed'; repo.orders.restock(o); }
      o.history = [...(o.history || []), { at, event: action, by: req.admin.email }];
    });
    audit(req, `order.${action}`, order.orderId, { tracking, refund });
    let notified = false;
    if (body.notify !== false && action !== 'paid') {
      const lines = {
        processing: 'stiamo preparando il tuo ordine.',
        shipped: `il tuo ordine è stato spedito con ${tracking?.carrier}. Numero di tracciamento: ${tracking?.code}${tracking?.url ? `\nSegui la spedizione: ${tracking.url}` : ''}`,
        delivered: 'il tuo ordine risulta consegnato. Hai 14 giorni dalla consegna per esercitare il diritto di recesso.',
        refunded: `abbiamo disposto il rimborso di ${order.total.toFixed(2)} € sul metodo di pagamento usato. L'accredito può richiedere alcuni giorni lavorativi.`,
        canceled: 'il tuo ordine è stato annullato. Se hai domande rispondi a questa email.',
      };
      await sendEmail(cfg, { tag: `order-${action}`, to: order.customer.email, subject: `Animol Life - ordine ${order.orderId} ${ACTIONS[action].label}`, text: `Ciao ${order.customer.name},\n${lines[action]}\n\nIl team Animol Life` });
      notified = true;
    }
    res.json({ ok: true, notified, order: { orderId: order.orderId, status: order.status, paymentStatus: order.paymentStatus, tracking: order.tracking } });
  });

  /* ----- prodotti ----- */
  const exportCatalog = async () => {
    try { await catalog.exportJson(); } catch (err) { console.error('[admin] scrittura products.json non riuscita:', err.message); }
  };
  const adminProduct = (p) => ({ ...exportProduct(p), stock: p.stock, active: p.active, createdAt: p.createdAt, updatedAt: p.updatedAt });

  r.get('/products', (req, res) => {
    res.json({ products: repo.products.list({ includeInactive: true }).map(adminProduct) });
  });
  r.get('/products/:id', (req, res) => {
    const p = repo.products.get(req.params.id);
    if (!p) return res.status(404).json({ error: 'not_found', message: 'Prodotto non trovato' });
    res.json({ product: adminProduct(p), priceHistory: repo.products.priceHistory(p.id) });
  });
  r.post('/products', async (req, res) => {
    const p = validateProduct(req.body);
    if (repo.products.get(p.id, { omnibus: false })) throw new ValidationError(`Esiste già un prodotto con codice "${p.id}"`, 'id');
    repo.products.save(p);
    audit(req, 'product.create', p.id, { name: p.name, price: p.price, salePrice: p.salePrice });
    await exportCatalog();
    res.status(201).json({ product: adminProduct(repo.products.get(p.id)) });
  });
  r.put('/products/:id', async (req, res) => {
    const existing = repo.products.get(req.params.id, { omnibus: false });
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Prodotto non trovato' });
    const p = validateProduct(req.body, existing);
    const { priceChanges } = repo.products.save(p);
    audit(req, 'product.update', p.id, { priceChanges, price: p.price, salePrice: p.salePrice, stock: p.stock, active: p.active });
    await exportCatalog();
    res.json({ product: adminProduct(repo.products.get(p.id)), priceChanges });
  });
  // Nessuna cancellazione fisica: gli ordini passati fanno riferimento al prodotto.
  r.delete('/products/:id', async (req, res) => {
    if (!repo.products.setActive(req.params.id, false)) return res.status(404).json({ error: 'not_found', message: 'Prodotto non trovato' });
    audit(req, 'product.deactivate', req.params.id);
    await exportCatalog();
    res.json({ ok: true });
  });

  r.post('/products/ai-description', aiLimit, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const existing = body.id ? repo.products.get(String(body.id), { omnibus: false }) : null;
    const draft = {
      id: existing?.id || 'nuovo-prodotto',
      name: str(body.name ?? existing?.name, 'name', { min: 2, max: 120, label: 'nome' }),
      brand: str(body.brand ?? existing?.brand, 'brand', { max: 60, label: 'marca' }),
      category: CATEGORIES.includes(body.category) ? body.category : (existing?.category || 'cani'),
      description: str(body.description ?? existing?.description, 'description', { max: 2000, label: 'descrizione', multiline: true }),
      specs: isPlainObject(body.specs) ? Object.fromEntries(Object.entries(body.specs).slice(0, 30).map(([k, v]) => [String(k).slice(0, 40), String(v).slice(0, 200)])) : (existing?.specs || {}),
      price: Number(body.price ?? existing?.price) || 0, salePrice: null, variants: [], sold: 0,
    };
    const out = await generateProductDescription(cfg, draft, { client: aiClient });
    audit(req, 'product.ai_description', existing?.id || null, { mode: out.mode });
    res.json(out);
  });

  /* ----- coupon ----- */
  r.get('/coupons', (req, res) => res.json({ coupons: repo.coupons.list() }));
  r.post('/coupons', (req, res) => {
    const c = validateCoupon(req.body);
    if (repo.coupons.get(c.code)) throw new ValidationError(`Il coupon ${c.code} esiste già`, 'code');
    const saved = repo.coupons.save(c);
    audit(req, 'coupon.create', c.code, c);
    res.status(201).json({ coupon: saved });
  });
  r.put('/coupons/:code', (req, res) => {
    const existing = repo.coupons.get(req.params.code);
    if (!existing) return res.status(404).json({ error: 'not_found', message: 'Coupon non trovato' });
    const c = validateCoupon(req.body, existing.code);
    const saved = repo.coupons.save(c);
    audit(req, 'coupon.update', c.code, c);
    res.json({ coupon: saved });
  });
  r.delete('/coupons/:code', (req, res) => {
    if (!repo.coupons.delete(req.params.code)) return res.status(404).json({ error: 'not_found', message: 'Coupon non trovato' });
    audit(req, 'coupon.delete', String(req.params.code).toUpperCase());
    res.json({ ok: true });
  });

  /* ----- membri Plus, newsletter, registro ----- */
  r.get('/plus-members', async (req, res) => {
    const { members } = await stores.plus.read();
    res.json({
      members: members.map((m) => ({
        email: m.email, userId: m.userId || null, plan: m.plan, status: m.status, demo: Boolean(m.demo), since: m.createdAt,
        trialEndsAt: m.trialEndsAt || null, currentPeriodEnd: m.currentPeriodEnd || null, cancelAtPeriodEnd: Boolean(m.cancelAtPeriodEnd),
      })).sort((a, b) => String(b.since).localeCompare(String(a.since))),
    });
  });

  r.get('/newsletter.csv', async (req, res) => {
    const list = (await stores.newsletter.read()).filter((s) => s.status === 'confirmed');
    audit(req, 'newsletter.export', null, { count: list.length });
    res.setHeader('Content-Disposition', `attachment; filename="newsletter-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.type('text/csv; charset=utf-8').send('﻿' + toCsv(list, [
      { key: 'email', label: 'email' }, { key: 'consentAt', label: 'consenso' }, { key: 'confirmedAt', label: 'confermato' },
    ]));
  });

  r.get('/audit', (req, res) => {
    res.json({ entries: repo.audit.list({ limit: Math.min(Number.parseInt(req.query.limit, 10) || 100, 500) }) });
  });

  return r;
}

/** Coupon iniziali (gli stessi di sempre), importati nel database al primo avvio. */
export function defaultCoupons() {
  return Object.entries(COUPONS).map(([code, c]) => ({ code, percent: c.percent, description: c.description, active: true, validFrom: null, validTo: null, maxUses: null }));
}
