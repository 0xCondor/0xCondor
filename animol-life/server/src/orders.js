// Ordini: validazione lato server e ricalcolo totali dal catalogo (mai fidarsi dei prezzi del client).
import crypto from 'node:crypto';
import { effectivePrice } from './catalog.js';
import { COUPONS, computeTotals } from './policies.js';
import { sendEmail } from './email.js';
import {
  ValidationError, requireString, optionalString, requireEmail, isPlainObject, CAP_RE, ORDER_ID_RE,
} from './security.js';

const MAX_LINES = 50;
const MAX_QTY = 20;
const ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente 0/O/1/I: più facile da dettare al telefono

export function newOrderId(date = new Date()) {
  const bytes = crypto.randomBytes(6);
  let suffix = '';
  for (const b of bytes) suffix += ID_ALPHABET[b % ID_ALPHABET.length];
  return `AL-${date.getUTCFullYear()}-${suffix}`;
}

function findVariant(product, variant) {
  if (variant === undefined || variant === null || variant === '') return null;
  if (product.variants.length === 0) throw new ValidationError(`Il prodotto "${product.name}" non ha varianti`, 'items');
  if (typeof variant === 'number' && Number.isInteger(variant) && product.variants[variant]) return product.variants[variant];
  const v = product.variants.find((x) => x.label === String(variant));
  if (!v) throw new ValidationError(`Variante "${variant}" non disponibile per "${product.name}"`, 'items');
  return v;
}

/** Risolve un carrello [{id, variant, qty}] contro il catalogo. strict=false ignora le righe non valide. */
export async function resolveCart(catalog, items, { strict = true } = {}) {
  if (!Array.isArray(items)) {
    if (strict) throw new ValidationError('Il carrello deve essere una lista', 'items');
    return [];
  }
  if (strict && items.length === 0) throw new ValidationError('Il carrello è vuoto', 'items');
  if (items.length > MAX_LINES) throw new ValidationError(`Massimo ${MAX_LINES} righe per ordine`, 'items');
  const lines = [];
  for (const it of items) {
    try {
      if (!isPlainObject(it)) throw new ValidationError('Riga carrello non valida', 'items');
      const qty = Number(it.qty ?? 1);
      if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw new ValidationError(`Quantità non valida (1-${MAX_QTY})`, 'items');
      const product = await catalog.get(it.id);
      if (!product) throw new ValidationError(`Prodotto non trovato: ${String(it.id).slice(0, 60)}`, 'items');
      const variant = findVariant(product, it.variant);
      const unitCents = Math.round(effectivePrice(product, variant) * 100);
      const existing = lines.find((l) => l.id === product.id && l.variant === (variant?.label ?? null));
      if (existing) {
        existing.qty = Math.min(MAX_QTY, existing.qty + qty);
        continue;
      }
      lines.push({ id: product.id, name: product.name, category: product.category, variant: variant?.label ?? null, qty, unitCents });
    } catch (err) {
      if (strict) throw err;
    }
  }
  return lines;
}

export async function isPlusMember(stores, email) {
  if (!email) return false;
  const data = await stores.plus.read();
  return data.members.some((m) => m.email === email && ['active', 'trialing'].includes(m.status));
}

function parseCustomer(body) {
  const c = isPlainObject(body.customer) ? body.customer : body;
  const customer = {
    name: requireString(c, 'name', { min: 2, max: 100, label: 'nome e cognome' }),
    email: requireEmail(c),
    phone: optionalString(c, 'phone', { max: 30, label: 'telefono' }),
    address: requireString(c, 'address', { min: 3, max: 200, label: 'indirizzo' }),
    city: requireString(c, 'city', { min: 2, max: 100, label: 'città' }),
    cap: requireString(c, 'cap', { min: 5, max: 5, label: 'CAP' }),
    province: optionalString(c, 'province', { max: 2, label: 'provincia' }),
  };
  if (!CAP_RE.test(customer.cap)) throw new ValidationError('Il CAP deve essere di 5 cifre', 'cap');
  if (customer.province && !/^[A-Za-z]{2}$/.test(customer.province)) throw new ValidationError('Sigla provincia non valida', 'province');
  if (customer.phone && !/^\+?[0-9 ]{6,20}$/.test(customer.phone)) throw new ValidationError('Numero di telefono non valido', 'phone');
  if (customer.province) customer.province = customer.province.toUpperCase();
  return customer;
}

export async function createOrder({ cfg, catalog, stores }, body) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const customer = parseCustomer(body);
  const lines = await resolveCart(catalog, body.items ?? body.cart);
  let couponCode = null;
  if (body.coupon) {
    couponCode = String(body.coupon).trim().toUpperCase().slice(0, 30);
    if (!COUPONS[couponCode]) throw new ValidationError('Codice coupon non valido', 'coupon');
  }
  const isPlus = await isPlusMember(stores, customer.email);
  const totals = computeTotals({ lines, couponCode, isPlus, shipping: cfg.shipping });
  const notes = optionalString(body, 'notes', { max: 500, label: 'note' });
  const paymentMethod = ['card', 'paypal', 'cod'].includes(body.paymentMethod) ? body.paymentMethod : 'card';

  const now = new Date();
  const order = {
    orderId: newOrderId(now),
    createdAt: now.toISOString(),
    status: 'ricevuto',
    paymentMethod,
    paymentStatus: 'pending',
    customer,
    lines,
    couponCode,
    isPlus,
    ...totals,
    total: totals.totalCents / 100,
    notes,
  };
  await stores.orders.update((orders) => {
    while (orders.some((o) => o.orderId === order.orderId)) order.orderId = newOrderId(now);
    orders.push(order);
  });
  await sendOrderConfirmation(cfg, order);
  return order;
}

/** Hook email di conferma ordine (stub: in demo registra soltanto). */
export async function sendOrderConfirmation(cfg, order) {
  const rows = order.lines
    .map((l) => `- ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ''}: ${((l.unitCents * l.qty) / 100).toFixed(2)} €`)
    .join('\n');
  return sendEmail(cfg, {
    tag: 'order-confirmation',
    to: order.customer.email,
    subject: `Animol Life - conferma ordine ${order.orderId}`,
    text: `Ciao ${order.customer.name},\ngrazie per il tuo ordine ${order.orderId}.\n\n${rows}\n\n` +
      `Spedizione: ${(order.shippingCents / 100).toFixed(2)} €\nTotale: ${order.total.toFixed(2)} €\n\n` +
      'Hai 14 giorni dalla consegna per esercitare il diritto di recesso.\nIl team Animol Life',
  });
}

const STATUS_LABELS = {
  ricevuto: 'ordine ricevuto',
  in_preparazione: 'in preparazione nel nostro magazzino',
  spedito: 'spedito, in viaggio verso di te',
  consegnato: 'consegnato',
  annullato: 'annullato',
};

/** Stato derivato: se l'ordine non è stato aggiornato a mano, simula l'avanzamento in base all'età (demo). */
export function deriveStatus(order, now = Date.now()) {
  if (order.status && order.status !== 'ricevuto') return order.status;
  const hours = (now - Date.parse(order.createdAt)) / 3_600_000;
  if (hours < 2) return 'ricevuto';
  if (hours < 24) return 'in_preparazione';
  if (hours < 96) return 'spedito';
  return 'consegnato';
}

export function normalizeOrderId(raw) {
  if (typeof raw !== 'string') return null;
  // Accetta anche forme dettate a voce: "a elle 2026 k 7 x ...", spazi, trattini mancanti.
  const compact = raw
    .toUpperCase()
    .replace(/\bELLE\b/g, 'L')
    .replace(/\bA\b(?=\s*L)/g, 'A')
    .replace(/[^A-Z0-9]/g, '');
  const m = compact.match(/AL(\d{4})([A-Z0-9]{6})/);
  if (!m) return null;
  const id = `AL-${m[1]}-${m[2]}`;
  return ORDER_ID_RE.test(id) ? id : null;
}

/**
 * Ricerca stato ordine. Con il solo ID restituisce lo stato senza dati personali (minimizzazione GDPR);
 * con ID + email (o CAP) corrispondenti aggiunge il riepilogo.
 */
export async function lookupOrder(stores, { orderId, email, cap }) {
  const id = normalizeOrderId(orderId);
  if (!id) throw new ValidationError('Numero ordine non valido (formato AL-AAAA-XXXXXX)', 'orderId');
  const orders = await stores.orders.read();
  const order = orders.find((o) => o.orderId === id);
  if (!order) return null;
  const status = deriveStatus(order);
  const result = {
    orderId: order.orderId,
    status,
    statusLabel: STATUS_LABELS[status] || status,
    createdAt: order.createdAt,
  };
  const verified =
    (email && String(email).toLowerCase().trim() === order.customer.email) ||
    (cap && String(cap).trim() === order.customer.cap);
  if (verified) {
    result.items = order.lines.map((l) => ({ name: l.name, variant: l.variant, qty: l.qty }));
    result.total = order.total;
  }
  return result;
}

export { STATUS_LABELS };
