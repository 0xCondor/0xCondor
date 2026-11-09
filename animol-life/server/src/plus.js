// Animol Plus: abbonamento legato all'ACCOUNT (non a un'email digitata nel checkout).
// Stripe Checkout in modalità abbonamento se STRIPE_SECRET_KEY è impostata, altrimenti demo.
import { PLUS } from './policies.js';
import { baseUrl } from './config.js';
import { sendEmail } from './email.js';
import { getStripe } from './payments.js';
import { ValidationError, isPlainObject } from './security.js';

export { getStripe };

const ACTIVE = ['active', 'trialing'];

async function upsertMember(stores, user, fields) {
  return stores.plus.update((data) => {
    let m = data.members.find((x) => x.userId === user.id);
    if (!m) {
      m = { userId: user.id, email: user.email, createdAt: new Date().toISOString() };
      data.members.push(m);
    }
    Object.assign(m, fields, { email: user.email, updatedAt: new Date().toISOString() });
    return { ...m };
  });
}

export async function findMember(stores, userId) {
  if (!userId) return null;
  const data = await stores.plus.read();
  return data.members.find((m) => m.userId === userId) || null;
}

/** Il membro è riconosciuto solo dall'id dell'account autenticato. */
export async function isPlusMember(stores, userId) {
  const m = await findMember(stores, userId);
  return Boolean(m && ACTIVE.includes(m.status));
}

export async function plusStatus(stores, userId) {
  const m = await findMember(stores, userId);
  if (!m || m.status === 'canceled') return null;
  return {
    active: ACTIVE.includes(m.status), status: m.status, plan: m.plan, demo: Boolean(m.demo), trialEndsAt: m.trialEndsAt || null,
    currentPeriodEnd: m.currentPeriodEnd || null, cancelAtPeriodEnd: Boolean(m.cancelAtPeriodEnd), since: m.createdAt,
  };
}

export async function subscribePlus({ cfg, stores }, body, req) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const plan = body.plan;
  if (!['monthly', 'yearly'].includes(plan)) throw new ValidationError('Piano non valido: usa "monthly" o "yearly"', 'plan');
  const user = req.user;
  const existing = await findMember(stores, user.id);
  if (existing && ACTIVE.includes(existing.status) && !existing.cancelAtPeriodEnd) {
    throw new ValidationError('Hai già un abbonamento Animol Plus attivo', 'plan');
  }
  const stripe = await getStripe(cfg);
  if (!stripe) {
    const trialEndsAt = new Date(Date.now() + PLUS.trialDays * 86_400_000).toISOString();
    // Il primo addebito (simulato) avverrebbe alla fine della prova.
    await upsertMember(stores, user, { plan, status: 'trialing', demo: true, trialEndsAt, currentPeriodEnd: trialEndsAt, cancelAtPeriodEnd: false, canceledAt: null });
    return { url: `/plus/?checkout=demo&plan=${plan}`, demo: true, plan, price: PLUS[plan].label, trialDays: PLUS.trialDays, plus: await plusStatus(stores, user.id) };
  }
  const priceId = plan === 'monthly' ? cfg.stripePriceMonthly : cfg.stripePriceYearly;
  const lineItem = priceId
    ? { price: priceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: 'eur', unit_amount: PLUS[plan].amountCents, recurring: { interval: PLUS[plan].interval },
          product_data: { name: `Animol Plus ${plan === 'monthly' ? 'mensile' : 'annuale'}` },
        },
      };
  const base = baseUrl(cfg, req);
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [lineItem],
    client_reference_id: user.id,
    subscription_data: { trial_period_days: PLUS.trialDays, metadata: { plan, userId: user.id } },
    metadata: { plan, userId: user.id },
    customer_email: user.email,
    locale: 'it',
    success_url: `${base}/plus/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/plus/?checkout=cancel`,
  });
  return { url: session.url, plan, price: PLUS[plan].label, trialDays: PLUS.trialDays };
}

/** Disdetta dall'area personale (sessione + token CSRF): con Stripe a fine periodo, in demo subito. */
export async function cancelPlus({ cfg, stores }, req) {
  const user = req.user;
  const m = await findMember(stores, user.id);
  if (!m || !['active', 'trialing', 'past_due'].includes(m.status)) {
    throw new ValidationError('Non hai un abbonamento Animol Plus attivo', 'plan');
  }
  const stripe = await getStripe(cfg);
  if (stripe && m.stripeSubscriptionId) {
    await stripe.subscriptions.update(m.stripeSubscriptionId, { cancel_at_period_end: true });
    const upd = await upsertMember(stores, user, { cancelAtPeriodEnd: true });
    await sendEmail(cfg, { tag: 'plus-canceled', to: user.email, subject: 'Disdetta di Animol Plus registrata', text: `La disdetta è registrata: Plus resta attivo fino al ${upd.currentPeriodEnd ? new Date(upd.currentPeriodEnd).toLocaleDateString('it-IT') : 'termine del periodo già pagato'} e non ci saranno altri addebiti.` });
    return { ok: true, canceled: false, cancelAtPeriodEnd: true, message: 'Disdetta registrata: Plus resterà attivo fino alla fine del periodo già pagato, senza altri addebiti.', plus: await plusStatus(stores, user.id) };
  }
  await upsertMember(stores, user, { status: 'canceled', canceledAt: new Date().toISOString() });
  await sendEmail(cfg, { tag: 'plus-canceled', to: user.email, subject: 'Disdetta di Animol Plus registrata', text: `La disdetta del tuo abbonamento Animol Plus${m.demo ? ' (modalità dimostrativa)' : ''} è stata registrata. Non riceverai alcun addebito.` });
  return { ok: true, canceled: true, demo: Boolean(m.demo), message: 'Disdetta registrata. Nessun ulteriore addebito.', plus: null };
}

/** Eventi Stripe degli abbonamenti (chiamata da handleStripeWebhook in payments.js). */
export async function handlePlusStripeEvent({ stores, repo }, event) {
  const obj = event.data.object;
  if (event.type === 'checkout.session.completed' && obj.mode === 'subscription') {
    const userId = obj.client_reference_id || obj.metadata?.userId;
    const user = userId && repo.users.findById(userId);
    if (!user) {
      console.warn('[plus] checkout completato senza un account valido: ignorato');
      return;
    }
    await upsertMember(stores, user, {
      plan: obj.metadata?.plan || null, status: 'trialing', demo: false, stripeCustomerId: obj.customer, stripeSubscriptionId: obj.subscription,
      trialEndsAt: new Date(Date.now() + PLUS.trialDays * 86_400_000).toISOString(), cancelAtPeriodEnd: false, canceledAt: null,
    });
  } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    await stores.plus.update((data) => {
      const m = data.members.find((x) => x.stripeSubscriptionId === obj.id);
      if (!m) return;
      m.status = event.type.endsWith('deleted') ? 'canceled' : obj.status;
      m.cancelAtPeriodEnd = Boolean(obj.cancel_at_period_end);
      const toIso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
      if (obj.trial_end) m.trialEndsAt = toIso(obj.trial_end);
      // current_period_end è sulla subscription (API meno recenti) o sui suoi item (API recenti).
      const periodEnd = obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end;
      if (periodEnd) m.currentPeriodEnd = toIso(periodEnd);
      const interval = obj.items?.data?.[0]?.price?.recurring?.interval;
      if (interval) m.plan = interval === 'year' ? 'yearly' : 'monthly';
      m.updatedAt = new Date().toISOString();
    });
  }
}

/** GDPR: alla cancellazione dell'account chiude l'abbonamento e rimuove il record del membro. */
export async function removeMember({ cfg, stores }, user) {
  const m = await findMember(stores, user.id);
  if (!m) return;
  const stripe = await getStripe(cfg);
  if (stripe && m.stripeSubscriptionId && m.status !== 'canceled') {
    try {
      await stripe.subscriptions.cancel(m.stripeSubscriptionId);
    } catch (err) {
      console.error('[plus] disdetta Stripe non riuscita durante la cancellazione account:', err.message);
    }
  }
  await stores.plus.update((data) => { data.members = data.members.filter((x) => x.userId !== user.id); });
}
