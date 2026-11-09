// Account clienti: registrazione, accesso, sessioni con cookie httpOnly, CSRF, blocco dei tentativi,
// reimpostazione della password via email, esportazione e cancellazione dei dati (GDPR).
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import express from 'express';
import { baseUrl } from './config.js';
import { sendEmail } from './email.js';
import { ValidationError, requireEmail, requireString, isPlainObject, rateLimit } from './security.js';

const scryptAsync = promisify(crypto.scrypt);
const KEYLEN = 64;

/* ---------------- password ---------------- */

/** Hash scrypt nel formato scrypt$N$r$p$salt$hash (base64url). Il costo si regola con SCRYPT_COST. */
export async function hashPassword(password, { cost = 32768 } = {}) {
  const salt = crypto.randomBytes(16);
  const N = cost;
  const r = 8;
  const p = 1;
  const hash = await scryptAsync(String(password).normalize('NFKC'), salt, KEYLEN, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every(Number.isInteger) || N > 2 ** 20 || r > 32 || p > 16) return false;
  const salt = Buffer.from(parts[4], 'base64url');
  const expected = Buffer.from(parts[5], 'base64url');
  const hash = await scryptAsync(String(password).normalize('NFKC'), salt, expected.length, { N, r, p, maxmem: 256 * N * r + 1024 * 1024 });
  return hash.length === expected.length && crypto.timingSafeEqual(hash, expected);
}

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '1234567890', '12345678910', 'qwertyuiop', 'qwerty1234', 'iloveyou12',
  'passwordpassword', 'animollife', 'animollife1', 'cambiami123', 'ciaociao123', 'juventus123', 'forzainter',
]);

/** Regole minime (NIST 800-63B): 10-128 caratteri, niente password note o uguali all'email. */
export function validateNewPassword(password, email = '') {
  if (typeof password !== 'string' || password.length < 10) throw new ValidationError('La password deve avere almeno 10 caratteri', 'password');
  if (password.length > 128) throw new ValidationError('La password può avere al massimo 128 caratteri', 'password');
  const low = password.toLowerCase();
  if (COMMON_PASSWORDS.has(low) || /^(.)\1+$/.test(password) || (email && low === email.toLowerCase()) || (email && low === email.split('@')[0].toLowerCase())) {
    throw new ValidationError('Password troppo facile da indovinare: scegline una diversa', 'password');
  }
  return password;
}

/* ---------------- cookie ---------------- */

export function parseCookies(header) {
  const out = Object.create(null);
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const k = part.slice(0, i).trim();
    if (!(k in out)) {
      try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch { /* cookie malformato: ignorato */ }
    }
  }
  return out;
}

function isSecure(cfg, req) {
  if (cfg.cookieSecure === 'true') return true;
  if (cfg.cookieSecure === 'false') return false;
  // auto: sempre Secure in produzione e su https; in sviluppo anche su localhost (contesto sicuro per i browser)
  return cfg.env === 'production' || req.secure || /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(req.get('host') || '');
}

export function cookieNames(cfg) {
  const prod = cfg.env === 'production';
  return { customer: prod ? '__Host-al_sid' : 'al_sid', admin: prod ? '__Host-al_admin' : 'al_admin' };
}

export function setCookie(res, cfg, req, name, value, { maxAgeMs, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'HttpOnly', `SameSite=${sameSite}`];
  if (isSecure(cfg, req) || name.startsWith('__Host-')) parts.push('Secure');
  if (maxAgeMs !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAgeMs / 1000))}`);
  res.append('Set-Cookie', parts.join('; '));
}

export function clearCookie(res, cfg, req, name) {
  setCookie(res, cfg, req, name, '', { maxAgeMs: 0 });
}

/* ---------------- middleware ---------------- */

/** Carica la sessione cliente (req.user) e quella admin (req.admin) dai cookie. */
export function loadSessions({ cfg, repo }) {
  const names = cookieNames(cfg);
  const idleMs = cfg.sessionIdleDays * 86_400_000;
  return (req, res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    req.cookies = cookies;
    const c = cookies[names.customer] ? repo.sessions.get(cookies[names.customer], 'customer', { idleMs }) : null;
    if (c) { req.user = c.user; req.session = c.session; req.sessionToken = cookies[names.customer]; }
    const a = cookies[names.admin] ? repo.sessions.get(cookies[names.admin], 'admin', { idleMs: 2 * 3_600_000 }) : null;
    if (a) { req.admin = a.user; req.adminSession = a.session; req.adminToken = cookies[names.admin]; }
    next();
  };
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const PRE_AUTH = new Set(['/auth/login', '/auth/register', '/auth/forgot', '/auth/reset', '/admin/login']);

/**
 * Protezione CSRF per le richieste che modificano dati (montata su /api):
 * 1) Origin/Sec-Fetch-Site devono essere dello stesso sito (blocca anche il login CSRF);
 * 2) con una sessione attiva serve l'header X-CSRF-Token legato alla sessione (synchronizer token).
 * Le richieste anonime (ordine come ospite, assistente) non hanno autorità ambientale da sfruttare.
 */
export function csrfProtection(cfg) {
  return (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const origin = req.get('origin');
    if (origin) {
      const allowed = new Set([`${req.protocol}://${req.get('host')}`]);
      if (cfg.publicBaseUrl) allowed.add(new URL(cfg.publicBaseUrl).origin);
      if (!allowed.has(origin)) return res.status(403).json({ error: 'forbidden', message: 'Origine della richiesta non consentita' });
    }
    if (req.get('sec-fetch-site') === 'cross-site') return res.status(403).json({ error: 'forbidden', message: 'Richiesta cross-site non consentita' });
    if (PRE_AUTH.has(req.path)) return next();
    const token = req.get('x-csrf-token');
    const isAdminPath = req.path.startsWith('/admin/');
    const sess = isAdminPath ? req.adminSession : req.session;
    if (sess && !safeEqual(token, sess.csrf)) {
      return res.status(403).json({ error: 'csrf', message: 'Token di sicurezza mancante o scaduto: ricarica la pagina e riprova.' });
    }
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'unauthorized', message: 'Accedi al tuo account per continuare.' });
  next();
}

/* ---------------- login comune (clienti e admin) ---------------- */

const DUMMY_HASH_CACHE = new Map();
async function dummyHash(cost) {
  if (!DUMMY_HASH_CACHE.has(cost)) DUMMY_HASH_CACHE.set(cost, await hashPassword(crypto.randomBytes(16).toString('hex'), { cost }));
  return DUMMY_HASH_CACHE.get(cost);
}

export class AuthError extends Error {
  constructor(message, status = 401, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

/**
 * Verifica email e password con blocco per email (LOGIN_MAX_FAILURES tentativi in 15 minuti →
 * blocco di LOGIN_LOCK_MINUTES). Tempo di risposta simile anche se l'utente non esiste.
 */
export async function authenticate({ cfg, repo }, body, { role } = {}) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const email = requireEmail(body);
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 128) throw new AuthError('Email o password non corretti');
  const key = `${role || 'customer'}:${email}`;
  const locked = repo.loginFailures.lockedUntil(key);
  if (locked) {
    const minutes = Math.ceil((locked - Date.now()) / 60_000);
    throw new AuthError(`Troppi tentativi non riusciti. Riprova tra ${minutes} minut${minutes === 1 ? 'o' : 'i'} o reimposta la password.`, 429, { retryAfter: Math.ceil((locked - Date.now()) / 1000) });
  }
  const user = repo.users.findByEmail(email);
  const ok = await verifyPassword(password, user ? user.passwordHash : await dummyHash(cfg.scryptCost));
  if (!user || !ok || (role && user.role !== role)) {
    repo.loginFailures.fail(key, { max: cfg.loginMaxFailures, windowMs: 15 * 60_000, lockMs: cfg.loginLockMinutes * 60_000 });
    throw new AuthError('Email o password non corretti');
  }
  repo.loginFailures.clear(key);
  return repo.users.update(user.id, { lastLoginAt: new Date().toISOString() });
}

export function publicUser(u) {
  return u && { id: u.id, email: u.email, name: u.name, role: u.role, emailVerified: Boolean(u.emailVerifiedAt), createdAt: u.createdAt };
}

/* ---------------- rotte /api/auth e /api/account ---------------- */

export function authRoutes(ctx, { plusStatus, deleteAccountData, exportAccountData, startOrderPayment, orderSummary }) {
  const { cfg, repo } = ctx;
  const r = express.Router();
  const names = cookieNames(cfg);
  const authLimit = rateLimit({ windowMs: 15 * 60_000, max: cfg.rateLimit.auth * 3, name: 'auth' });
  const strictLimit = rateLimit({ windowMs: cfg.rateLimit.windowMs, max: cfg.rateLimit.auth, name: 'auth-minute' });
  const ttlMs = cfg.sessionTtlDays * 86_400_000;

  const startSession = (req, res, user) => {
    if (req.sessionToken) repo.sessions.delete(req.sessionToken); // nessuna fissazione: sempre un id nuovo
    const s = repo.sessions.create({ userId: user.id, kind: 'customer', ttlMs });
    setCookie(res, cfg, req, names.customer, s.token, { maxAgeMs: ttlMs });
    return s;
  };

  const me = async (user, csrf) => ({ user: publicUser(user), csrfToken: csrf, plus: user ? await plusStatus(user.id) : null });

  r.get('/auth/me', async (req, res) => {
    res.json(req.user ? await me(req.user, req.session.csrf) : { user: null });
  });

  r.post('/auth/register', authLimit, strictLimit, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const email = requireEmail(body);
    const name = requireString(body, 'name', { min: 2, max: 100, label: 'nome' });
    validateNewPassword(body.password, email);
    if (body.privacy !== true) throw new ValidationError('Per creare l\'account devi dichiarare di aver letto l\'informativa privacy', 'privacy');
    if (repo.users.findByEmail(email)) {
      throw new ValidationError('Esiste già un account con questa email: accedi oppure reimposta la password.', 'email');
    }
    const user = repo.users.create({ email, name, passwordHash: await hashPassword(body.password, { cost: cfg.scryptCost }) });
    const verifyToken = repo.tokens.create(user.id, 'verify', 7 * 86_400_000);
    await sendEmail(cfg, {
      tag: 'account-verify', to: email, subject: 'Benvenuto in Animol Life: conferma la tua email',
      text: `Ciao ${name},\nil tuo account Animol Life è stato creato. Conferma il tuo indirizzo email aprendo questo link (valido 7 giorni):\n${baseUrl(cfg, req)}/api/auth/verify?token=${verifyToken}\n\nSe non sei stato tu, ignora questa email.`,
    });
    const s = startSession(req, res, user);
    res.status(201).json(await me(user, s.csrf));
  });

  r.post('/auth/login', authLimit, strictLimit, async (req, res) => {
    try {
      const user = await authenticate(ctx, req.body);
      const s = startSession(req, res, user);
      res.json(await me(user, s.csrf));
    } catch (err) {
      if (!(err instanceof AuthError)) throw err;
      if (err.extra.retryAfter) res.setHeader('Retry-After', String(err.extra.retryAfter));
      res.status(err.status).json({ error: err.status === 429 ? 'locked' : 'invalid_credentials', message: err.message });
    }
  });

  r.post('/auth/logout', (req, res) => {
    if (req.sessionToken) repo.sessions.delete(req.sessionToken);
    clearCookie(res, cfg, req, names.customer);
    res.json({ ok: true });
  });

  r.get('/auth/verify', (req, res) => {
    const userId = repo.tokens.consume(req.query.token, 'verify');
    if (userId) repo.users.update(userId, { emailVerifiedAt: new Date().toISOString() });
    res.redirect(303, userId ? '/?account=verificato#account' : '/?account=link-non-valido#account');
  });

  r.post('/auth/forgot', authLimit, strictLimit, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const email = requireEmail(body);
    const user = repo.users.findByEmail(email);
    if (user) {
      const token = repo.tokens.create(user.id, 'reset', 3_600_000);
      // Il token è nel frammento (#): non arriva nei log del server né nell'header Referer.
      await sendEmail(cfg, {
        tag: 'password-reset', to: user.email, subject: 'Animol Life: reimposta la password',
        text: `Abbiamo ricevuto una richiesta di reimpostazione della password. Apri questo link entro 1 ora:\n${baseUrl(cfg, req)}/#reset=${token}\n\nSe non sei stato tu, ignora questa email: la password attuale resta valida.`,
      });
    }
    res.status(202).json({ ok: true, message: 'Se l\'indirizzo corrisponde a un account, riceverai un\'email con il link per reimpostare la password.' });
  });

  r.post('/auth/reset', authLimit, strictLimit, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    if (typeof body.token !== 'string') throw new ValidationError('Link non valido', 'token');
    validateNewPassword(body.password); // prima di consumare il token: un errore di battitura non lo brucia
    const userId = repo.tokens.consume(body.token, 'reset');
    const user = userId && repo.users.findById(userId);
    if (!user) return res.status(400).json({ error: 'invalid_token', message: 'Il link non è valido o è scaduto: richiedine uno nuovo.' });
    validateNewPassword(body.password, user.email);
    repo.users.setPassword(user.id, await hashPassword(body.password, { cost: cfg.scryptCost }));
    repo.users.update(user.id, { emailVerifiedAt: user.emailVerifiedAt || new Date().toISOString() }); // ha dimostrato di ricevere l'email
    repo.sessions.deleteForUser(user.id); // chiude tutte le sessioni aperte
    repo.loginFailures.clear(`customer:${user.email}`);
    repo.loginFailures.clear(`admin:${user.email}`);
    await sendEmail(cfg, { tag: 'password-changed', to: user.email, subject: 'Animol Life: password modificata', text: 'La password del tuo account è stata modificata. Se non sei stato tu, contatta subito l\'assistenza.' });
    const s = user.role === 'customer' ? startSession(req, res, user) : null;
    res.json(s ? await me(user, s.csrf) : { ok: true });
  });

  /* ----- area personale (richiede accesso) ----- */

  r.post('/account/profile', requireUser, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    const name = requireString(body, 'name', { min: 2, max: 100, label: 'nome' });
    const u = repo.users.update(req.user.id, { name });
    res.json(await me(u, req.session.csrf));
  });

  r.post('/account/password', requireUser, authLimit, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    if (!(await verifyPassword(String(body.currentPassword ?? ''), req.user.passwordHash))) {
      throw new ValidationError('La password attuale non è corretta', 'currentPassword');
    }
    validateNewPassword(body.newPassword, req.user.email);
    repo.users.setPassword(req.user.id, await hashPassword(body.newPassword, { cost: cfg.scryptCost }));
    repo.sessions.deleteForUser(req.user.id, 'customer');
    const s = startSession(req, res, req.user);
    res.json(await me(req.user, s.csrf));
  });

  r.get('/account/orders', requireUser, (req, res) => {
    res.json({ orders: repo.orders.listByUser(req.user.id).map(orderSummary) });
  });

  // Solo i propri ordini: un id di un altro utente risponde 404 (nessuna differenza osservabile).
  r.get('/account/orders/:id', requireUser, (req, res) => {
    const o = repo.orders.get(req.params.id);
    if (!o || o.userId !== req.user.id) return res.status(404).json({ error: 'not_found', message: 'Ordine non trovato' });
    res.json({ order: orderSummary(o, { full: true }) });
  });

  r.post('/account/orders/:id/pay', requireUser, async (req, res) => {
    const o = repo.orders.get(req.params.id);
    if (!o || o.userId !== req.user.id) return res.status(404).json({ error: 'not_found', message: 'Ordine non trovato' });
    res.json(await startOrderPayment(o, req));
  });

  r.get('/account/export', requireUser, async (req, res) => {
    const data = await exportAccountData(req.user);
    res.setHeader('Content-Disposition', `attachment; filename="animol-life-dati-${new Date().toISOString().slice(0, 10)}.json"`);
    res.type('application/json').send(JSON.stringify(data, null, 2));
  });

  r.post('/account/delete', requireUser, authLimit, async (req, res) => {
    const body = isPlainObject(req.body) ? req.body : {};
    if (!(await verifyPassword(String(body.password ?? ''), req.user.passwordHash))) {
      throw new ValidationError('Password non corretta', 'password');
    }
    if (req.user.role === 'admin') throw new ValidationError('Un amministratore non può cancellarsi da qui', 'role');
    await deleteAccountData(req.user);
    clearCookie(res, cfg, req, names.customer);
    res.json({
      ok: true,
      message: 'Account cancellato. Abbiamo eliminato profilo, sessioni, abbonamento Plus, newsletter e carrelli salvati. ' +
        'Gli ordini restano conservati, senza collegamento all\'account, solo per gli obblighi fiscali (10 anni, art. 2220 c.c.).',
    });
  });

  return r;
}
