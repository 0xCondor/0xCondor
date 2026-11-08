// Newsletter con doppio opt-in: salviamo solo email, data del consenso e hash del token.
import { newToken, hashToken } from './tokens.js';
import { sendEmail } from './email.js';
import { baseUrl } from './config.js';
import { ValidationError, requireEmail, isPlainObject } from './security.js';

const TOKEN_TTL_MS = 48 * 3_600_000;

export async function subscribe({ cfg, stores }, body, req) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  const email = requireEmail(body);
  if (body.consent !== true) throw new ValidationError('È necessario il consenso esplicito al trattamento per la newsletter', 'consent');
  const { token, hash } = newToken();
  const now = new Date().toISOString();
  const alreadyConfirmed = await stores.newsletter.update((list) => {
    const existing = list.find((s) => s.email === email);
    if (existing?.status === 'confirmed') return true;
    const rec = { email, status: 'pending', consentAt: now, tokenHash: hash, tokenExpires: Date.now() + TOKEN_TTL_MS };
    if (existing) Object.assign(existing, rec);
    else list.push(rec);
    return false;
  });
  if (!alreadyConfirmed) {
    const link = `${baseUrl(cfg, req)}/api/newsletter/confirm?token=${token}`;
    await sendEmail(cfg, {
      tag: 'newsletter-confirm',
      to: email,
      subject: 'Conferma la tua iscrizione alla newsletter Animol Life',
      text: `Ciao! Per confermare l'iscrizione alla newsletter di Animol Life apri questo link (valido 48 ore):\n${link}\n\nSe non hai richiesto l'iscrizione ignora questa email.`,
    });
  }
  // Risposta identica in ogni caso: non riveliamo se un indirizzo è già iscritto.
  return { ok: true, message: 'Controlla la tua casella email e conferma l\'iscrizione con il link che ti abbiamo inviato.' };
}

export async function confirm({ stores }, token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 100) return { ok: false };
  const hash = hashToken(token);
  return stores.newsletter.update((list) => {
    const rec = list.find((s) => s.tokenHash === hash);
    if (!rec || rec.tokenExpires < Date.now()) return { ok: false };
    rec.status = 'confirmed';
    rec.confirmedAt = new Date().toISOString();
    const u = newToken();
    rec.tokenHash = null;
    rec.tokenExpires = null;
    rec.unsubscribeHash = u.hash; // il link di disiscrizione andrà nelle email della newsletter
    return { ok: true, email: rec.email, unsubscribeToken: u.token };
  });
}

export async function unsubscribe({ stores }, token) {
  if (typeof token !== 'string' || token.length < 16 || token.length > 100) return { ok: false };
  const hash = hashToken(token);
  return stores.newsletter.update((list) => {
    const i = list.findIndex((s) => s.unsubscribeHash === hash);
    if (i === -1) return { ok: false };
    list.splice(i, 1); // cancellazione completa dei dati
    return { ok: true };
  });
}
