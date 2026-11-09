// Repository: unico punto di accesso ai dati relazionali (account, sessioni, ordini, prodotti,
// storico prezzi, coupon, registro azioni admin). Implementazione SQLite (better-sqlite3, file
// data/animol.db in modalità WAL). Per passare a PostgreSQL/MySQL basta reimplementare questa
// interfaccia: il resto del server non conosce SQL.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

const DAY = 86_400_000;
const SCHEMA_VERSION = 2;

const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
   CREATE TABLE IF NOT EXISTS users (
     id TEXT PRIMARY KEY,
     email TEXT NOT NULL UNIQUE COLLATE NOCASE,
     name TEXT,
     password_hash TEXT NOT NULL,
     role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
     email_verified_at TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     password_changed_at TEXT,
     last_login_at TEXT
   );
   CREATE TABLE IF NOT EXISTS sessions (
     id_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     kind TEXT NOT NULL CHECK (kind IN ('customer','admin')),
     csrf TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     last_seen_at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
   CREATE TABLE IF NOT EXISTS user_tokens (
     token_hash TEXT PRIMARY KEY,
     user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     purpose TEXT NOT NULL CHECK (purpose IN ('reset','verify')),
     expires_at INTEGER NOT NULL
   );
   CREATE TABLE IF NOT EXISTS login_failures (
     key TEXT PRIMARY KEY, count INTEGER NOT NULL, first_at INTEGER NOT NULL, locked_until INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE IF NOT EXISTS orders (
     id TEXT PRIMARY KEY,
     user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
     email TEXT NOT NULL,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     status TEXT NOT NULL,
     payment_status TEXT NOT NULL,
     payment_method TEXT NOT NULL,
     payment_ref TEXT,
     total_cents INTEGER NOT NULL,
     data TEXT NOT NULL
   );
   CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at);
   CREATE INDEX IF NOT EXISTS orders_created ON orders(created_at);
   CREATE INDEX IF NOT EXISTS orders_payment_ref ON orders(payment_ref);
   CREATE TABLE IF NOT EXISTS products (
     id TEXT PRIMARY KEY,
     data TEXT NOT NULL,
     active INTEGER NOT NULL DEFAULT 1,
     stock INTEGER,
     position INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS price_history (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     product_id TEXT NOT NULL,
     variant TEXT NOT NULL DEFAULT '',
     price_cents INTEGER NOT NULL,
     sale_cents INTEGER,
     at INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS price_history_pv ON price_history(product_id, variant, at);
   CREATE TABLE IF NOT EXISTS coupons (
     code TEXT PRIMARY KEY,
     percent INTEGER NOT NULL CHECK (percent BETWEEN 1 AND 90),
     description TEXT NOT NULL DEFAULT '',
     active INTEGER NOT NULL DEFAULT 1,
     valid_from TEXT,
     valid_to TEXT,
     max_uses INTEGER,
     used_count INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS audit_log (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     at TEXT NOT NULL,
     actor_id TEXT,
     actor_email TEXT,
     action TEXT NOT NULL,
     target TEXT,
     details TEXT,
     ip TEXT
   );
   CREATE TABLE IF NOT EXISTS webhook_events (
     id TEXT PRIMARY KEY, provider TEXT NOT NULL, type TEXT, received_at TEXT NOT NULL
   );`,
  // v2: contatti B2B dalla landing /vendita/ (consenso con data e versione dell'informativa)
  `CREATE TABLE IF NOT EXISTS leads (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     created_at TEXT NOT NULL,
     name TEXT NOT NULL,
     shop TEXT NOT NULL,
     type TEXT,
     city TEXT,
     phone TEXT,
     email TEXT NOT NULL,
     interest TEXT,
     message TEXT,
     privacy_accepted_at TEXT NOT NULL,
     marketing_consent INTEGER NOT NULL DEFAULT 0,
     marketing_consent_at TEXT,
     consent_version TEXT,
     source TEXT
   );
   CREATE INDEX IF NOT EXISTS leads_created ON leads(created_at);`,
];

const nowIso = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');
const cents = (n) => (n === null || n === undefined ? null : Math.round(Number(n) * 100));

/* ---------------- Omnibus: prezzo più basso degli ultimi 30 giorni ---------------- */

const onSale = (e) => e.sale_cents !== null && e.sale_cents !== undefined && e.sale_cents < e.price_cents;
const effective = (e) => (onSale(e) ? e.sale_cents : e.price_cents);

/**
 * Prezzo di riferimento Omnibus (art. 17-bis Cod. Consumo / dir. UE 2019/2161) in centesimi.
 * entries: storico ordinato per data ({price_cents, sale_cents, at}); l'ultima voce è il prezzo attuale.
 * - Se c'è una riduzione in corso: il prezzo più basso applicato nei 30 giorni PRECEDENTI l'inizio della
 *   riduzione (le riduzioni progressive senza interruzioni mantengono lo stesso riferimento).
 *   Senza storico prima della riduzione si usa il prezzo pieno della prima voce in saldo.
 * - Altrimenti: il prezzo più basso applicato negli ultimi 30 giorni (informativo).
 */
export function omnibusLowestCents(entries, now = Date.now()) {
  if (!entries.length) return null;
  const last = entries.length - 1;
  const inForce = (j, from, to) => entries[j].at < to && (j === last ? Infinity : entries[j + 1].at) > from;
  if (onSale(entries[last])) {
    let i = last;
    while (i > 0 && onSale(entries[i - 1])) i -= 1;
    const start = entries[i].at;
    let min = null;
    for (let j = 0; j < i; j += 1) {
      if (inForce(j, start - 30 * DAY, start)) min = min === null ? effective(entries[j]) : Math.min(min, effective(entries[j]));
    }
    return min ?? entries[i].price_cents;
  }
  let min = null;
  for (let j = 0; j <= last; j += 1) {
    if (inForce(j, now - 30 * DAY, now + 1)) min = min === null ? effective(entries[j]) : Math.min(min, effective(entries[j]));
  }
  return min;
}

/* ---------------- repository ---------------- */

const opened = new Map();

/** Apre (una sola volta per percorso) il database in dataDir. */
export function openRepo(dataDir, { file = 'animol.db' } = {}) {
  const dbPath = file === ':memory:' ? ':memory:' : path.join(dataDir, file);
  if (opened.has(dbPath)) return opened.get(dbPath);
  if (dbPath !== ':memory:') fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('synchronous = NORMAL');
  const current = db.pragma('user_version', { simple: true });
  for (let v = current; v < MIGRATIONS.length; v += 1) {
    db.exec(MIGRATIONS[v]);
    db.pragma(`user_version = ${v + 1}`);
  }
  const repo = createRepo(db);
  repo.path = dbPath;
  repo.close = () => {
    opened.delete(dbPath);
    if (db.open) db.close();
  };
  opened.set(dbPath, repo);
  return repo;
}

function createRepo(db) {
  const tx = (fn) => db.transaction(fn);
  let productsVersion = 0;

  const meta = {
    get: (k) => db.prepare('SELECT value FROM meta WHERE key = ?').pluck().get(k) ?? null,
    set: (k, v) => db.prepare('INSERT INTO meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v)),
  };

  /* ---------- utenti ---------- */
  const userRow = (r) => r && ({
    id: r.id, email: r.email, name: r.name || '', role: r.role, passwordHash: r.password_hash,
    emailVerifiedAt: r.email_verified_at, createdAt: r.created_at, updatedAt: r.updated_at,
    passwordChangedAt: r.password_changed_at, lastLoginAt: r.last_login_at,
  });
  const users = {
    create({ email, name = '', passwordHash, role = 'customer' }) {
      const id = crypto.randomUUID();
      const t = nowIso();
      db.prepare(`INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at, password_changed_at)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, email.toLowerCase(), name, passwordHash, role, t, t, t);
      return users.findById(id);
    },
    findById: (id) => userRow(db.prepare('SELECT * FROM users WHERE id = ?').get(String(id))),
    findByEmail: (email) => userRow(db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase())),
    setPassword(id, passwordHash) {
      const t = nowIso();
      db.prepare('UPDATE users SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?').run(passwordHash, t, t, id);
    },
    update(id, { name, role, emailVerifiedAt, lastLoginAt }) {
      const u = users.findById(id);
      if (!u) return null;
      db.prepare('UPDATE users SET name = ?, role = ?, email_verified_at = ?, last_login_at = ?, updated_at = ? WHERE id = ?').run(
        name ?? u.name, role ?? u.role, emailVerifiedAt ?? u.emailVerifiedAt, lastLoginAt ?? u.lastLoginAt, nowIso(), id,
      );
      return users.findById(id);
    },
    delete: (id) => db.prepare('DELETE FROM users WHERE id = ?').run(id).changes > 0,
    countByRole: (role) => db.prepare('SELECT COUNT(*) FROM users WHERE role = ?').pluck().get(role),
    count: () => db.prepare('SELECT COUNT(*) FROM users').pluck().get(),
  };

  /* ---------- sessioni (salviamo solo l'hash del token del cookie) ---------- */
  const sessions = {
    create({ userId, kind, ttlMs }) {
      const token = crypto.randomBytes(32).toString('base64url');
      const csrf = crypto.randomBytes(24).toString('base64url');
      const now = Date.now();
      db.prepare('INSERT INTO sessions (id_hash, user_id, kind, csrf, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(sha256(token), userId, kind, csrf, now, now + ttlMs, now);
      return { token, csrf, expiresAt: now + ttlMs };
    },
    /** Restituisce {session, user} se il token è valido e non scaduto (scadenza assoluta + inattività). */
    get(token, kind, { idleMs } = {}) {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const r = db.prepare('SELECT * FROM sessions WHERE id_hash = ? AND kind = ?').get(sha256(token), kind);
      if (!r) return null;
      const now = Date.now();
      if (r.expires_at <= now || (idleMs && now - r.last_seen_at > idleMs)) {
        db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(r.id_hash);
        return null;
      }
      const user = users.findById(r.user_id);
      if (!user || (kind === 'admin' && user.role !== 'admin')) return null;
      if (now - r.last_seen_at > 60_000) db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id_hash = ?').run(now, r.id_hash);
      return { session: { idHash: r.id_hash, csrf: r.csrf, kind: r.kind, expiresAt: r.expires_at, createdAt: r.created_at }, user };
    },
    delete: (token) => db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token)),
    deleteForUser: (userId, kind) => (kind
      ? db.prepare('DELETE FROM sessions WHERE user_id = ? AND kind = ?').run(userId, kind)
      : db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)),
    countForUser: (userId) => db.prepare('SELECT COUNT(*) FROM sessions WHERE user_id = ?').pluck().get(userId),
    purgeExpired: () => db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now()),
  };

  /* ---------- token monouso (reset password, verifica email) ---------- */
  const tokens = {
    create(userId, purpose, ttlMs) {
      const token = crypto.randomBytes(32).toString('base64url');
      db.prepare('DELETE FROM user_tokens WHERE user_id = ? AND purpose = ?').run(userId, purpose);
      db.prepare('INSERT INTO user_tokens (token_hash, user_id, purpose, expires_at) VALUES (?, ?, ?, ?)').run(sha256(token), userId, purpose, Date.now() + ttlMs);
      return token;
    },
    /** Consuma il token (monouso). Restituisce l'id utente o null. */
    consume: tx((token, purpose) => {
      if (typeof token !== 'string' || token.length < 20 || token.length > 100) return null;
      const r = db.prepare('SELECT * FROM user_tokens WHERE token_hash = ? AND purpose = ?').get(sha256(token), purpose);
      if (!r) return null;
      db.prepare('DELETE FROM user_tokens WHERE token_hash = ?').run(r.token_hash);
      return r.expires_at > Date.now() ? r.user_id : null;
    }),
  };

  /* ---------- tentativi di accesso falliti (blocco per email) ---------- */
  const loginFailures = {
    lockedUntil(key) {
      const r = db.prepare('SELECT locked_until FROM login_failures WHERE key = ?').get(key);
      return r && r.locked_until > Date.now() ? r.locked_until : 0;
    },
    fail: tx((key, { max, windowMs, lockMs }) => {
      const now = Date.now();
      const r = db.prepare('SELECT * FROM login_failures WHERE key = ?').get(key);
      if (!r || now - r.first_at > windowMs) {
        db.prepare('INSERT INTO login_failures (key, count, first_at, locked_until) VALUES (?, 1, ?, 0) ON CONFLICT(key) DO UPDATE SET count = 1, first_at = excluded.first_at, locked_until = 0').run(key, now);
        return 1;
      }
      const count = r.count + 1;
      db.prepare('UPDATE login_failures SET count = ?, locked_until = ? WHERE key = ?').run(count, count >= max ? now + lockMs : r.locked_until, key);
      return count;
    }),
    clear: (key) => db.prepare('DELETE FROM login_failures WHERE key = ?').run(key),
  };

  /* ---------- ordini ---------- */
  const orderFromRow = (r) => r && JSON.parse(r.data);
  function writeOrder(o) {
    o.updatedAt = nowIso();
    db.prepare(`UPDATE orders SET user_id = ?, email = ?, updated_at = ?, status = ?, payment_status = ?, payment_method = ?,
                payment_ref = ?, total_cents = ?, data = ? WHERE id = ?`).run(
      o.userId ?? null, o.customer.email, o.updatedAt, o.status, o.paymentStatus, o.paymentMethod,
      o.payment?.ref ?? null, o.totalCents, JSON.stringify(o), o.orderId,
    );
  }
  const orders = {
    /**
     * Inserisce l'ordine in un'unica transazione: verifica e scala le scorte dei prodotti con
     * magazzino gestito e conta l'uso del coupon. onConflictId genera un nuovo id se già usato.
     */
    insert: tx((order, { onConflictId, StockError } = {}) => {
      for (const l of order.lines) {
        const stock = db.prepare('SELECT stock FROM products WHERE id = ?').pluck().get(l.id);
        if (stock === null || stock === undefined) continue;
        const qty = order.lines.filter((x) => x.id === l.id).reduce((s, x) => s + x.qty, 0);
        if (stock < qty) throw new (StockError || Error)(`Disponibilità insufficiente per "${l.name}" (rimasti ${stock})`);
      }
      const touched = new Set();
      for (const l of order.lines) {
        if (touched.has(l.id)) continue;
        touched.add(l.id);
        const qty = order.lines.filter((x) => x.id === l.id).reduce((s, x) => s + x.qty, 0);
        const r = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock IS NOT NULL').run(qty, l.id);
        if (r.changes) order.stockReserved = true;
      }
      if (order.couponCode) db.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE code = ?').run(order.couponCode);
      while (onConflictId && db.prepare('SELECT 1 FROM orders WHERE id = ?').get(order.orderId)) order.orderId = onConflictId();
      order.updatedAt = order.createdAt;
      db.prepare(`INSERT INTO orders (id, user_id, email, created_at, updated_at, status, payment_status, payment_method, payment_ref, total_cents, data)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        order.orderId, order.userId ?? null, order.customer.email, order.createdAt, order.updatedAt, order.status,
        order.paymentStatus, order.paymentMethod, order.payment?.ref ?? null, order.totalCents, JSON.stringify(order),
      );
      if (touched.size) productsVersion += 1;
      return order;
    }),
    get: (id) => orderFromRow(db.prepare('SELECT data FROM orders WHERE id = ?').get(String(id))),
    getByPaymentRef: (ref) => orderFromRow(db.prepare('SELECT data FROM orders WHERE payment_ref = ?').get(String(ref))),
    /** Modifica atomica: fn(order) muta l'ordine; se restituisce false non salva. */
    update: tx((id, fn) => {
      const o = orders.get(id);
      if (!o) return null;
      const res = fn(o);
      if (res === false) return o;
      writeOrder(o);
      return o;
    }),
    restock: tx((order) => {
      if (!order.stockReserved) return;
      for (const l of order.lines) db.prepare('UPDATE products SET stock = stock + ? WHERE id = ? AND stock IS NOT NULL').run(l.qty, l.id);
      order.stockReserved = false;
      productsVersion += 1;
    }),
    listByUser: (userId) => db.prepare('SELECT data FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(userId).map(orderFromRow),
    list({ status, paymentStatus, q, limit = 50, offset = 0 } = {}) {
      const where = [];
      const args = [];
      if (status) { where.push('status = ?'); args.push(status); }
      if (paymentStatus) { where.push('payment_status = ?'); args.push(paymentStatus); }
      if (q) { where.push('(id LIKE ? ESCAPE \'\\\' OR email LIKE ? ESCAPE \'\\\')'); const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; args.push(like, like); }
      const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const total = db.prepare(`SELECT COUNT(*) FROM orders ${w}`).pluck().get(...args);
      const rows = db.prepare(`SELECT data FROM orders ${w} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...args, limit, offset);
      return { total, orders: rows.map(orderFromRow) };
    },
    all: () => db.prepare('SELECT data FROM orders ORDER BY created_at').all().map(orderFromRow),
    since: (iso) => db.prepare('SELECT data FROM orders WHERE created_at >= ? ORDER BY created_at').all(iso).map(orderFromRow),
    /** GDPR: alla cancellazione dell'account gli ordini restano (obblighi fiscali) ma non sono più collegati. */
    detachUser: tx((userId) => {
      for (const o of orders.listByUser(userId)) {
        o.userId = null;
        writeOrder(o);
      }
    }),
  };

  /* ---------- prodotti e storico prezzi ---------- */
  const historyStmt = () => db.prepare('SELECT price_cents, sale_cents, at FROM price_history WHERE product_id = ? AND variant = ? ORDER BY at, id');
  function recordPrice(productId, variant, price, sale, at = Date.now()) {
    const pc = cents(price);
    let sc = cents(sale);
    if (sc !== null && sc >= pc) sc = null;
    const last = db.prepare('SELECT price_cents, sale_cents FROM price_history WHERE product_id = ? AND variant = ? ORDER BY at DESC, id DESC LIMIT 1').get(productId, variant);
    if (last && last.price_cents === pc && last.sale_cents === sc) return false;
    db.prepare('INSERT INTO price_history (product_id, variant, price_cents, sale_cents, at) VALUES (?, ?, ?, ?, ?)').run(productId, variant, pc, sc, at);
    return true;
  }
  function withOmnibus(p, now = Date.now()) {
    const out = structuredClone(p);
    const lowest = (variant) => {
      const c = omnibusLowestCents(historyStmt().all(p.id, variant), now);
      return c === null ? null : c / 100;
    };
    out.lowestPrice30d = lowest('');
    out.variants = (out.variants || []).map((v) => ({ ...v, lowestPrice30d: lowest(v.label) }));
    return out;
  }
  const productFromRow = (r) => r && { ...JSON.parse(r.data), stock: r.stock, active: Boolean(r.active), createdAt: r.created_at, updatedAt: r.updated_at };

  const products = {
    get version() { return productsVersion; },
    count: () => db.prepare('SELECT COUNT(*) FROM products').pluck().get(),
    get(id, { omnibus = true } = {}) {
      const p = productFromRow(db.prepare('SELECT * FROM products WHERE id = ?').get(String(id)));
      return p && omnibus ? withOmnibus(p) : p;
    },
    list({ includeInactive = false } = {}) {
      const rows = db.prepare(`SELECT * FROM products ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY position, created_at, id`).all();
      const now = Date.now();
      return rows.map((r) => withOmnibus(productFromRow(r), now));
    },
    /** Salva (crea o aggiorna) un prodotto già validato e registra le variazioni di prezzo. */
    save: tx((p, { at } = {}) => {
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(p.id);
      const t = nowIso();
      const { stock = null, active = true, ...rest } = p;
      delete rest.lowestPrice30d;
      delete rest.createdAt;
      delete rest.updatedAt;
      rest.variants = (rest.variants || []).map(({ label, price, salePrice }) => ({ label, price, salePrice: salePrice ?? null }));
      if (existing) {
        db.prepare('UPDATE products SET data = ?, active = ?, stock = ?, updated_at = ? WHERE id = ?').run(JSON.stringify(rest), active ? 1 : 0, stock, t, p.id);
      } else {
        const pos = (db.prepare('SELECT MAX(position) FROM products').pluck().get() ?? -1) + 1;
        db.prepare('INSERT INTO products (id, data, active, stock, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(p.id, JSON.stringify(rest), active ? 1 : 0, stock, pos, t, t);
      }
      const changes = [];
      if (recordPrice(p.id, '', rest.price, rest.salePrice, at)) changes.push('');
      for (const v of rest.variants) if (recordPrice(p.id, v.label, v.price, v.salePrice, at)) changes.push(v.label);
      productsVersion += 1;
      return { created: !existing, priceChanges: changes };
    }),
    setActive(id, active) {
      const r = db.prepare('UPDATE products SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, nowIso(), id);
      productsVersion += 1;
      return r.changes > 0;
    },
    priceHistory: (id) => db.prepare('SELECT variant, price_cents, sale_cents, at FROM price_history WHERE product_id = ? ORDER BY at, id').all(id)
      .map((r) => ({ variant: r.variant || null, price: r.price_cents / 100, salePrice: r.sale_cents === null ? null : r.sale_cents / 100, at: new Date(r.at).toISOString() })),
    /** Primo avvio: importa il catalogo e ricostruisce uno storico coerente con i lowestPrice30d già pubblicati. */
    seed: tx((list, source) => {
      if (products.count() > 0) return false;
      const now = Date.now();
      const seedHistory = (id, variant, price, sale, lowest) => {
        const eff = sale !== null && sale !== undefined && sale < price ? sale : price;
        const ref = lowest ?? price;
        if (ref !== eff || (sale !== null && sale !== undefined && sale < price)) {
          db.prepare('INSERT INTO price_history (product_id, variant, price_cents, sale_cents, at) VALUES (?, ?, ?, NULL, ?)').run(id, variant, cents(ref), now - 20 * DAY);
          db.prepare('INSERT INTO price_history (product_id, variant, price_cents, sale_cents, at) VALUES (?, ?, ?, ?, ?)').run(id, variant, cents(price), sale !== null && sale !== undefined && sale < price ? cents(sale) : null, now - 10 * DAY);
        } else {
          db.prepare('INSERT INTO price_history (product_id, variant, price_cents, sale_cents, at) VALUES (?, ?, ?, NULL, ?)').run(id, variant, cents(price), now - 20 * DAY);
        }
      };
      list.forEach((p, i) => {
        const t = new Date(now - 20 * DAY).toISOString();
        const { stock = null, active = true, lowestPrice30d, ...rest } = p;
        rest.variants = (rest.variants || []).map(({ label, price, salePrice }) => ({ label, price, salePrice: salePrice ?? null }));
        db.prepare('INSERT INTO products (id, data, active, stock, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(rest.id, JSON.stringify(rest), active ? 1 : 0, stock, i, t, t);
        seedHistory(rest.id, '', rest.price, rest.salePrice, lowestPrice30d);
        for (const v of p.variants || []) seedHistory(rest.id, v.label, v.price, v.salePrice, v.lowestPrice30d ?? null);
      });
      meta.set('catalog_seed', source);
      productsVersion += 1;
      return true;
    }),
  };

  /* ---------- coupon ---------- */
  const couponRow = (r) => r && {
    code: r.code, percent: r.percent, description: r.description, active: Boolean(r.active), validFrom: r.valid_from,
    validTo: r.valid_to, maxUses: r.max_uses, usedCount: r.used_count, createdAt: r.created_at, updatedAt: r.updated_at,
  };
  const coupons = {
    list: () => db.prepare('SELECT * FROM coupons ORDER BY code').all().map(couponRow),
    get: (code) => couponRow(db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(code).toUpperCase())),
    /** Coupon utilizzabile adesso (attivo, nel periodo di validità, entro il numero massimo di usi). */
    usable(code, now = new Date()) {
      const c = coupons.get(code);
      if (!c || !c.active) return null;
      const day = now.toISOString().slice(0, 10);
      if (c.validFrom && day < c.validFrom) return null;
      if (c.validTo && day > c.validTo) return null;
      if (c.maxUses !== null && c.usedCount >= c.maxUses) return null;
      return c;
    },
    save(c) {
      const t = nowIso();
      db.prepare(`INSERT INTO coupons (code, percent, description, active, valid_from, valid_to, max_uses, created_at, updated_at)
                  VALUES (@code, @percent, @description, @active, @validFrom, @validTo, @maxUses, @t, @t)
                  ON CONFLICT(code) DO UPDATE SET percent = excluded.percent, description = excluded.description, active = excluded.active,
                  valid_from = excluded.valid_from, valid_to = excluded.valid_to, max_uses = excluded.max_uses, updated_at = excluded.updated_at`)
        .run({ ...c, active: c.active ? 1 : 0, t });
      return coupons.get(c.code);
    },
    delete: (code) => db.prepare('DELETE FROM coupons WHERE code = ?').run(String(code).toUpperCase()).changes > 0,
    seed(list) {
      if (meta.get('coupons_seeded')) return;
      for (const c of list) if (!coupons.get(c.code)) coupons.save(c);
      meta.set('coupons_seeded', '1');
    },
  };

  /* ---------- registro azioni admin ---------- */
  const audit = {
    log({ actor, action, target = null, details = null, ip = null }) {
      db.prepare('INSERT INTO audit_log (at, actor_id, actor_email, action, target, details, ip) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(nowIso(), actor?.id ?? null, actor?.email ?? null, action, target, details ? JSON.stringify(details) : null, ip);
    },
    list: ({ limit = 100 } = {}) => db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(limit)
      .map((r) => ({ id: r.id, at: r.at, actorEmail: r.actor_email, action: r.action, target: r.target, details: r.details ? JSON.parse(r.details) : null, ip: r.ip })),
  };

  /* ---------- idempotenza dei webhook ---------- */
  const webhookEvents = {
    /** true se l'evento è nuovo (e lo registra), false se già elaborato. */
    claim(id, provider, type) {
      return db.prepare('INSERT OR IGNORE INTO webhook_events (id, provider, type, received_at) VALUES (?, ?, ?, ?)').run(String(id), provider, type ?? null, nowIso()).changes > 0;
    },
    release: (id) => db.prepare('DELETE FROM webhook_events WHERE id = ?').run(String(id)),
  };

  /* ---------- contatti B2B ---------- */
  const leadRow = (r) => r && {
    id: r.id, createdAt: r.created_at, name: r.name, shop: r.shop, type: r.type, city: r.city, phone: r.phone, email: r.email,
    interest: r.interest, message: r.message, privacyAcceptedAt: r.privacy_accepted_at, marketingConsent: Boolean(r.marketing_consent),
    marketingConsentAt: r.marketing_consent_at, consentVersion: r.consent_version, source: r.source,
  };
  const leads = {
    create(l) {
      const t = nowIso();
      const id = db.prepare(`INSERT INTO leads (created_at, name, shop, type, city, phone, email, interest, message, privacy_accepted_at,
                             marketing_consent, marketing_consent_at, consent_version, source)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        t, l.name, l.shop, l.type, l.city, l.phone, l.email, l.interest, l.message, t,
        l.marketingConsent ? 1 : 0, l.marketingConsent ? t : null, l.consentVersion, l.source,
      ).lastInsertRowid;
      return leadRow(db.prepare('SELECT * FROM leads WHERE id = ?').get(id));
    },
    list: ({ limit = 500 } = {}) => db.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT ?').all(limit).map(leadRow),
    count: () => db.prepare('SELECT COUNT(*) FROM leads').pluck().get(),
  };

  return { db, meta, leads, users, sessions, tokens, loginFailures, orders, products, coupons, audit, webhookEvents, schemaVersion: SCHEMA_VERSION };
}
