// Configurazione centralizzata: tutto arriva da variabili d'ambiente, mai dal codice.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const SERVER_ROOT = path.resolve(here, '..');

function int(v, def) {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : def;
}

/**
 * Costruisce la configurazione a partire da un oggetto env (default: process.env).
 * I test passano un oggetto esplicito, così nessuna chiave reale viene mai usata.
 */
export function loadConfig(env = process.env, overrides = {}) {
  const cfg = {
    env: env.NODE_ENV || 'development',
    port: int(env.PORT, 3000),
    publicBaseUrl: (env.PUBLIC_BASE_URL || '').replace(/\/+$/, ''),
    trustProxy: env.TRUST_PROXY ?? '',
    publicDir: path.resolve(SERVER_ROOT, env.PUBLIC_DIR || '../public'),
    venditaDir: path.resolve(SERVER_ROOT, env.VENDITA_DIR || '../vendita'),
    dataDir: path.resolve(SERVER_ROOT, env.DATA_DIR || 'data'),
    csp: env.CONTENT_SECURITY_POLICY || '',

    anthropicApiKey: env.ANTHROPIC_API_KEY || '',
    anthropicModel: env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    assistantMaxHistory: int(env.ASSISTANT_MAX_HISTORY, 12),
    assistantMaxChars: int(env.ASSISTANT_MAX_CHARS, 1500),

    rateLimit: {
      windowMs: int(env.RATE_LIMIT_WINDOW_MS, 60_000),
      assistant: int(env.RATE_LIMIT_ASSISTANT, 20),
      orders: int(env.RATE_LIMIT_ORDERS, 10),
      forms: int(env.RATE_LIMIT_FORMS, 6),
      general: int(env.RATE_LIMIT_GENERAL, 120),
      auth: int(env.RATE_LIMIT_AUTH, 10),
      leads: int(env.RATE_LIMIT_LEADS, 5),
    },

    shipping: {
      freeThresholdCents: 4900,
      costCents: int(env.SHIPPING_COST_CENTS, 490),
    },

    stripeSecretKey: env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET || '',
    stripePriceMonthly: env.STRIPE_PRICE_MONTHLY || '',
    stripePriceYearly: env.STRIPE_PRICE_YEARLY || '',

    twilioAuthToken: env.TWILIO_AUTH_TOKEN || '',
    humanPhoneNumber: env.HUMAN_PHONE_NUMBER || '',
    twilioVoice: env.TWILIO_VOICE || '',

    emailWebhookUrl: env.EMAIL_WEBHOOK_URL || '',
    emailFrom: env.EMAIL_FROM || 'Animol Life <ciao@animol.life>',
    alertEmail: env.ALERT_EMAIL || '',

    abandonedCartHours: int(env.ABANDONED_CART_HOURS, 24),
    lowStockThreshold: int(env.LOW_STOCK_THRESHOLD, 5),
    plusTrialReminderDays: int(env.PLUS_TRIAL_REMINDER_DAYS, 3),
    plusRenewalReminderDays: int(env.PLUS_RENEWAL_REMINDER_DAYS, 30),

    liveProvider: env.LIVE_PROVIDER || 'demo',

    // Account e sessioni
    sessionTtlDays: int(env.SESSION_TTL_DAYS, 30),
    sessionIdleDays: int(env.SESSION_IDLE_DAYS, 14),
    adminSessionHours: int(env.ADMIN_SESSION_HOURS, 8),
    scryptCost: int(env.SCRYPT_COST, 32768),
    cookieSecure: (env.COOKIE_SECURE || 'auto').toLowerCase(), // auto | true | false
    loginMaxFailures: int(env.LOGIN_MAX_FAILURES, 5),
    loginLockMinutes: int(env.LOGIN_LOCK_MINUTES, 15),
    adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
    adminPassword: env.ADMIN_PASSWORD || '',

    // Pagamenti
    paypalClientId: env.PAYPAL_CLIENT_ID || '',
    paypalClientSecret: env.PAYPAL_CLIENT_SECRET || '',
    paypalEnv: env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox',
    // Pagina di pagamento simulata: attiva di default fuori produzione quando mancano le chiavi
    demoPayments: env.DEMO_PAYMENTS ? env.DEMO_PAYMENTS === '1' || env.DEMO_PAYMENTS === 'true' : (env.NODE_ENV || 'development') !== 'production',

    // products.json riscritto dal database dopo ogni modifica del catalogo ("off" per disattivare)
    catalogExportFile: env.CATALOG_EXPORT_FILE === 'off' ? null : (env.CATALOG_EXPORT_FILE ? path.resolve(SERVER_ROOT, env.CATALOG_EXPORT_FILE) : undefined),
  };
  return { ...cfg, ...overrides };
}

export function baseUrl(cfg, req) {
  if (cfg.publicBaseUrl) return cfg.publicBaseUrl;
  if (req) return `${req.protocol}://${req.get('host')}`;
  return `http://localhost:${cfg.port}`;
}
