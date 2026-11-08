// Promemoria Animol Plus (trasparenza sui rinnovi automatici):
// - fine prova: email PLUS_TRIAL_REMINDER_DAYS giorni (default 3) prima del primo addebito;
// - rinnovo annuale: email PLUS_RENEWAL_REMINDER_DAYS giorni (default 30) prima del rinnovo.
// Ogni promemoria viene inviato una sola volta per scadenza; nessun invio a chi ha già disdetto.
import { sendEmail } from '../src/email.js';
import { PLUS } from '../src/policies.js';
import { baseUrl } from '../src/config.js';

const DAY = 86_400_000;

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' });
}

function within(iso, now, days) {
  const t = Date.parse(iso || '');
  return Number.isFinite(t) && t > now && t <= now + days * DAY;
}

export async function runPlusReminders({ cfg, stores, log }, args = {}) {
  const dryRun = Boolean(args['dry-run']);
  const now = Date.now();
  const { members } = await stores.plus.read();
  const trial = [];
  const renewal = [];
  for (const m of members) {
    if (m.cancelAtPeriodEnd || !['trialing', 'active'].includes(m.status)) continue;
    if (m.status === 'trialing' && within(m.trialEndsAt, now, cfg.plusTrialReminderDays) && m.trialReminderFor !== m.trialEndsAt) {
      trial.push(m);
    } else if (m.status === 'active' && m.plan === 'yearly' && within(m.currentPeriodEnd, now, cfg.plusRenewalReminderDays) && m.renewalReminderFor !== m.currentPeriodEnd) {
      renewal.push(m);
    }
  }
  const manage = `${baseUrl(cfg)}/plus/`;
  if (!dryRun) {
    for (const m of trial) {
      const price = PLUS[m.plan]?.label || PLUS.monthly.label;
      await sendEmail(cfg, {
        tag: 'plus-trial-ending',
        to: m.email,
        subject: `La tua prova Animol Plus termina il ${fmtDate(m.trialEndsAt)}`,
        text: `Ciao! La prova gratuita di Animol Plus termina il ${fmtDate(m.trialEndsAt)}. ` +
          `Da quel giorno l'abbonamento si rinnova automaticamente al prezzo di ${price}, addebitato sul metodo di pagamento indicato.\n` +
          `Se non vuoi continuare puoi disdire gratuitamente prima di quella data: ${manage}\n\nIl team Animol Life`,
      });
    }
    for (const m of renewal) {
      await sendEmail(cfg, {
        tag: 'plus-annual-renewal',
        to: m.email,
        subject: `Il tuo Animol Plus annuale si rinnova il ${fmtDate(m.currentPeriodEnd)}`,
        text: `Ciao! Il tuo abbonamento annuale Animol Plus si rinnoverà automaticamente il ${fmtDate(m.currentPeriodEnd)} ` +
          `al prezzo di ${PLUS.yearly.label}. Se non desideri rinnovarlo puoi disdire prima di quella data: ${manage}\n\nIl team Animol Life`,
      });
    }
    if (trial.length || renewal.length) {
      await stores.plus.update((data) => {
        for (const m of data.members) {
          if (trial.some((x) => x.email === m.email)) m.trialReminderFor = m.trialEndsAt;
          if (renewal.some((x) => x.email === m.email)) m.renewalReminderFor = m.currentPeriodEnd;
        }
      });
    }
  }
  log(`[plus-reminders] fine prova: ${trial.length}, rinnovo annuale: ${renewal.length}${dryRun ? ' (dry-run, nessuna email)' : ''}`);
  return { trial: trial.length, renewal: renewal.length, dryRun };
}
