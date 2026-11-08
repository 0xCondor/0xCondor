// Sicurezza: header stile helmet, rate limit in memoria per IP, utilità di validazione.

const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com https://js.stripe.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "connect-src 'self'",
  'frame-src https://js.stripe.com https://checkout.stripe.com',
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.stripe.com",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

export function securityHeaders(cfg) {
  const csp = cfg.csp || DEFAULT_CSP;
  return (req, res, next) => {
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(), geolocation=(), microphone=(self), payment=(self)');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    if (cfg.env === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  };
}

/** Rate limit a finestra fissa per IP (in memoria: per più istanze usare Redis). */
export function rateLimit({ windowMs, max, name }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  timer.unref();
  return (req, res, next) => {
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ error: 'too_many_requests', message: 'Troppe richieste, riprova tra poco.', scope: name });
    }
    next();
  };
}

export class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.status = 400;
    this.field = field;
  }
}

export const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9.-]{1,253}\.[a-z]{2,24}$/i;
export const CAP_RE = /^\d{5}$/;
export const ORDER_ID_RE = /^AL-\d{4}-[A-Z0-9]{6}$/;

export function requireString(obj, field, { min = 1, max = 200, label = field } = {}) {
  const v = obj?.[field];
  if (typeof v !== 'string' || v.trim().length < min) throw new ValidationError(`Campo "${label}" obbligatorio`, field);
  const t = v.trim();
  if (t.length > max) throw new ValidationError(`Campo "${label}" troppo lungo (max ${max} caratteri)`, field);
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(t)) throw new ValidationError(`Campo "${label}" non valido`, field);
  return t;
}

export function optionalString(obj, field, opts = {}) {
  const v = obj?.[field];
  if (v === undefined || v === null || v === '') return null;
  return requireString(obj, field, opts);
}

export function requireEmail(obj, field = 'email') {
  const v = requireString(obj, field, { max: 254, label: 'email' }).toLowerCase();
  if (!EMAIL_RE.test(v)) throw new ValidationError('Indirizzo email non valido', field);
  return v;
}

export function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}
