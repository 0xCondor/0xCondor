// Animol Plus: abbonamento via Stripe Checkout (se STRIPE_SECRET_KEY è impostata) o demo.
import { PLUS } from './policies.js';
import { baseUrl } from './config.js';
import { sendEmail } from './email.js';
import { newToken, hashToken } from './tokens.js';
import { ValidationError, requireEmail, isPlainObject, EMAIL_RE } from './security.js';

let stripeClient = null;
export async function getStripe(cfg) {
  if (!cfg.stripeSecretKey) return null;
  if (!stripeClient) {
    const { default: Stripe } = await import('stripe');
    stripeClient = new Stripe(cfg.stripeSecretKey);
  }
  return stripeClient;
}

async function upsertMember(stores, email, fields) {
  return stores.plus.update((data) => {
    let m = data.members.find((x) => x.email === email);
    if (!m) {
      m = { email, createdAt: new Date().toISOString() };
      data.members.push(m);
    }
    Object.assign(m, fields, { updatedAt: new Date().toISOString() });
    return m;
  });
}

export async function subscribePlus({ cfg, stores }, body, req) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const plan = body.plan;
  if (!['monthly', 'yearly'].includes(plan)) throw new ValidationError('Piano non valido: usa "monthly" o "yearly"', 'plan');
  const email = body.email ? requireEmail(body) : null;
  const base = baseUrl(cfg, req);
  const stripe = await getStripe(cfg);

  if (!stripe) {
    if (email) await upsertMember(stores, email, { plan, status: 'trialing', demo: true, trialEndsAt: new Date(Date.now() + PLUS.trialDays * 86_400_000).toISOString() });
    return { url: `/plus/?checkout=demo&plan=${plan}`, demo: true, plan, price: PLUS[plan].label, trialDays: PLUS.trialDays };
  }

  const priceId = plan === 'monthly' ? cfg.stripePriceMonthly : cfg.stripePriceYearly;
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: PLUS[plan].amountCents,
          recurring: { interval: PLUS[plan].interval },
          product_data: { name: `Animol Plus ${plan === 'monthly' ? 'mensile' : 'annuale'}` },
        },
      };
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [lineItem],
    subscription_data: { trial_period_days: PLUS.trialDays, metadata: { plan } },
    metadata: { plan },
    ...(email ? { customer_email: email } : {}),
    locale: 'it',
    success_url: `${base}/plus/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/plus/?checkout=cancel`,
  });
  return { url: session.url, plan, price: PLUS[plan].label, trialDays: PLUS.trialDays };
}

/** Avvia la disdetta: per sicurezza inviamo un link di conferma all'email del membro. */
export async function requestCancel({ cfg, stores }, body, req) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const email = requireEmail(body);
  const { token, hash } = newToken();
  const member = await stores.plus.update((data) => {
    const m = data.members.find((x) => x.email === email && ['active', 'trialing', 'past_due'].includes(x.status));
    if (!m) return null;
    data.tokens = data.tokens.filter((t) => t.expires > Date.now() && t.email !== email);
    data.tokens.push({ email, hash, purpose: 'cancel', expires: Date.now() + 24 * 3_600_000 });
    return m;
  });
  if (member) {
    await sendEmail(cfg, {
      tag: 'plus-cancel',
      to: email,
      subject: 'Conferma la disdetta di Animol Plus',
      text: `Abbiamo ricevuto una richiesta di disdetta di Animol Plus. Per confermarla apri questo link (valido 24 ore):\n${baseUrl(cfg, req)}/api/plus/cancel/confirm?token=${token}\n\nSe non sei stato tu, ignora questa email.`,
    });
  }
  return { ok: true, message: 'Se l\'indirizzo corrisponde a un abbonamento attivo, riceverai un\'email per confermare la disdetta.' };
}

export async function confirmCancel({ cfg, stores }, token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 100) return { ok: false };
  const hash = hashToken(token);
  const member = await stores.plus.update((data) => {
    const t = data.tokens.find((x) => x.hash === hash && x.purpose === 'cancel' && x.expires > Date.now());
    if (!t) return null;
    data.tokens = data.tokens.filter((x) => x !== t);
    return data.members.find((m) => m.email === t.email) || null;
  });
  if (!member) return { ok: false };
  const stripe = await getStripe(cfg);
  if (stripe && member.stripeSubscriptionId) {
    await stripe.subscriptions.update(member.stripeSubscriptionId, { cancel_at_period_end: true });
    await upsertMember(stores, member.email, { cancelAtPeriodEnd: true });
    return { ok: true, message: 'Disdetta registrata: Plus resterà attivo fino alla fine del periodo già pagato.' };
  }
  await upsertMember(stores, member.email, { status: 'canceled', canceledAt: new Date().toISOString() });
  return { ok: true, message: 'Disdetta registrata.' };
}

/** Webhook Stripe: aggiorna lo stato dei membri. Richiede il corpo grezzo e STRIPE_WEBHOOK_SECRET. */
export async function handleStripeWebhook({ cfg, stores }, rawBody, signature) {
  const stripe = await getStripe(cfg);
  if (!stripe || !cfg.stripeWebhookSecret) {
    const err = new Error('Stripe non configurato');
    err.status = 503;
    throw err;
  }
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, cfg.stripeWebhookSecret);
  } catch {
    const err = new Error('Firma Stripe non valida');
    err.status = 400;
    throw err;
  }
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const email = (obj.customer_details?.email || obj.customer_email || '').toLowerCase();
    if (EMAIL_RE.test(email)) {
      await upsertMember(stores, email, {
        plan: obj.metadata?.plan || null, status: 'trialing', stripeCustomerId: obj.customer, stripeSubscriptionId: obj.subscription,
      });
    }
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await stores.plus.update((data) => {
      const m = data.members.find((x) => x.stripeSubscriptionId === obj.id);
      if (m) {
        m.status = event.type.endsWith('deleted') ? 'canceled' : obj.status;
        m.cancelAtPeriodEnd = Boolean(obj.cancel_at_period_end);
        m.updatedAt = new Date().toISOString();
      }
    });
  }
  return { received: true, type: event.type };
}
