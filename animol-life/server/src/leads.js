// Contatti B2B dalla landing /vendita/ (negozi, toelettature, allevamenti, veterinari...).
// Si conserva solo quanto serve per ricontattare, con data e versione del consenso privacy.
import { sendEmail, maskEmail } from './email.js';
import { ValidationError, requireEmail, requireString, optionalString, isPlainObject } from './security.js';

const TYPES = ['negozio', 'toelettatura', 'allevamento', 'veterinario', 'pensione', 'altro'];

/** Valida il corpo; restituisce null se è un bot (honeypot "website" compilato). */
export function parseLead(body) {
  if (!isPlainObject(body)) throw new ValidationError('Corpo della richiesta non valido');
  if (typeof body.website === 'string' && body.website.trim() !== '') return null;
  if (body.website !== undefined && typeof body.website !== 'string') return null;
  if (body.privacyAccepted !== true) throw new ValidationError('Per inviare la richiesta devi accettare l\'informativa privacy', 'privacyAccepted');
  if (body.marketingConsent !== undefined && typeof body.marketingConsent !== 'boolean') throw new ValidationError('Consenso marketing non valido', 'marketingConsent');
  const lead = {
    name: requireString(body, 'name', { min: 2, max: 100, label: 'nome e cognome' }),
    shop: requireString(body, 'shop', { min: 2, max: 120, label: 'attività' }),
    type: optionalString(body, 'type', { max: 40, label: 'tipo di attività' }),
    city: optionalString(body, 'city', { max: 100, label: 'città' }),
    phone: optionalString(body, 'phone', { max: 30, label: 'telefono' }),
    email: requireEmail(body),
    interest: optionalString(body, 'interest', { max: 100, label: 'interesse' }),
    message: optionalString(body, 'message', { max: 2000, label: 'messaggio' }),
    marketingConsent: body.marketingConsent === true,
    consentVersion: optionalString(body, 'consentVersion', { max: 40, label: 'versione del consenso' }),
    source: optionalString(body, 'source', { max: 100, label: 'origine' }),
  };
  if (lead.type) {
    lead.type = lead.type.toLowerCase();
    if (!TYPES.includes(lead.type)) lead.type = 'altro';
  }
  if (lead.phone && !/^\+?[0-9 ()./-]{6,25}$/.test(lead.phone)) throw new ValidationError('Numero di telefono non valido', 'phone');
  if (lead.consentVersion && !/^[\w.-]+$/.test(lead.consentVersion)) throw new ValidationError('Versione del consenso non valida', 'consentVersion');
  return lead;
}

export async function createLead({ cfg, repo }, body) {
  const lead = parseLead(body);
  if (!lead) return { dropped: true };
  const saved = repo.leads.create(lead);
  const to = cfg.alertEmail || cfg.adminEmail;
  if (to) {
    await sendEmail(cfg, {
      tag: 'lead-b2b', to, subject: `Nuovo contatto B2B: ${lead.shop}${lead.city ? ` (${lead.city})` : ''}`,
      text: `Nuova richiesta dalla pagina /vendita/.\nAttività: ${lead.shop}${lead.type ? ` - ${lead.type}` : ''}\nReferente: ${lead.name}\n` +
        `Email: ${maskEmail(lead.email)}\nInteresse: ${lead.interest || '-'}\nDettagli completi nel pannello /admin (sezione Contatti B2B).`,
    });
  }
  return { dropped: false, lead: saved };
}
