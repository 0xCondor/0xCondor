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
  };
  return { ...cfg, ...overrides };
}

export function baseUrl(cfg, req) {
  if (cfg.publicBaseUrl) return cfg.publicBaseUrl;
  if (req) return `${req.protocol}://${req.get('host')}`;
  return `http://localhost:${cfg.port}`;
}
