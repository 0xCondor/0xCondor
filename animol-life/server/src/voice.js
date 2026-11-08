// Agente vocale telefonico (webhook Twilio Voice). Usa lo stesso "cervello" della chat.
// - annuncia subito che è un'IA (AI Act art. 50) e chiede il consenso prima di conservare la trascrizione
// - non registra l'audio; senza consenso non salva nulla
// - offre il trasferimento a un operatore umano (HUMAN_PHONE_NUMBER)
import crypto from 'node:crypto';
import { appendJsonLine } from './store.js';

const SESSION_TTL_MS = 60 * 60 * 1000;
const MAX_SESSIONS = 2000;
const MAX_TURNS = 10;

export function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Calcola la firma Twilio (HMAC-SHA1 di URL + parametri POST ordinati, base64). */
export function twilioSignature(authToken, url, params = {}) {
  const data = Object.keys(params)
    .sort()
    .reduce((acc, k) => acc + k + (params[k] ?? ''), url);
  return crypto.createHmac('sha1', authToken).update(Buffer.from(data, 'utf8')).digest('base64');
}

export function validateTwilio(cfg) {
  let warned = false;
  return (req, res, next) => {
    if (!cfg.twilioAuthToken) {
      if (cfg.env === 'production' && !warned) {
        warned = true;
        console.warn('[voice] TWILIO_AUTH_TOKEN non impostato: le firme Twilio NON vengono verificate');
      }
      return next();
    }
    const sig = req.get('X-Twilio-Signature') || '';
    const base = cfg.publicBaseUrl || `${req.protocol}://${req.get('host')}`;
    const expected = twilioSignature(cfg.twilioAuthToken, base + req.originalUrl, req.body || {});
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(403).type('text/plain').send('Firma Twilio non valida');
    }
    next();
  };
}

function cleanForSpeech(text) {
  return String(text)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/[*_#`>|]/g, '')
    .replace(/\s*\n+\s*-?\s*/g, '. ')
    .replace(/€/g, ' euro')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 900);
}

// \b in JS non riconosce le lettere accentate ("sì"): usiamo confini Unicode espliciti.
const YES_RE = /(?<![\p{L}])(s[iì]|va bene|ok|okay|certo|acconsento|d'accordo|accetto)(?![\p{L}])/iu;
const NO_RE = /(?<![\p{L}])(no|non acconsento|non voglio|preferisco di no|rifiuto)(?![\p{L}])/iu;
const HUMAN_RE = /\b(operator[ei]|(parlare|passa\w*|mett\w* in contatto) con (una persona|qualcuno|un umano|un essere umano)|assistenza umana)\b/i;
const BYE_RE = /^(no,? grazie|niente(?: altro)?|nient'altro|basta(?: così)?|arrivederci|ciao|a posto così|è tutto|grazie,? è tutto)[.!]?$/i;

export function createVoiceAgent({ cfg, assistant }) {
  const sessions = new Map();
  const sayAttrs = `language="it-IT"${cfg.twilioVoice ? ` voice="${xmlEscape(cfg.twilioVoice)}"` : ''}`;
  const say = (text) => `<Say ${sayAttrs}>${xmlEscape(text)}</Say>`;
  const gather = (inner, step = 'chat') =>
    `<Gather input="speech" language="it-IT" speechTimeout="auto" timeout="6" action="/voice/respond?step=${step}" method="POST">${inner}</Gather>` +
    `<Redirect method="POST">/voice/respond?step=${step}&amp;noinput=1</Redirect>`;
  const twiml = (body) => `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;

  function session(callSid) {
    const now = Date.now();
    for (const [k, v] of sessions) if (now - v.updatedAt > SESSION_TTL_MS) sessions.delete(k);
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
    let s = sessions.get(callSid);
    if (!s) {
      s = { history: [], consent: null, misses: 0, turns: 0, updatedAt: now };
      sessions.set(callSid, s);
    }
    s.updatedAt = now;
    return s;
  }

  const callKey = (sid) => crypto.createHash('sha256').update(String(sid)).digest('hex').slice(0, 16);

  async function logTurn(s, sid, role, text) {
    if (s.consent !== true) return; // senza consenso non conserviamo nulla
    await appendJsonLine(cfg.dataDir, 'call-transcripts', { call: callKey(sid), at: new Date().toISOString(), role, text });
  }

  function transfer() {
    if (cfg.humanPhoneNumber) {
      return say('Ti metto in contatto con un operatore, attendi in linea.') +
        `<Dial timeout="30">${xmlEscape(cfg.humanPhoneNumber)}</Dial>` +
        say('Al momento non è disponibile nessun operatore. Puoi scriverci via email, ti risponderemo al più presto. Arrivederci!') +
        '<Hangup/>';
    }
    return gather(say('Al momento non posso trasferirti a un operatore. Il servizio clienti risponde dal lunedì al venerdì dalle 9 alle 18, anche via email. Posso aiutarti in altro?'));
  }

  return {
    sessions,
    incoming(req) {
      const sid = req.body?.CallSid || `anon-${Date.now()}`;
      sessions.delete(sid);
      session(sid);
      const intro =
        'Ciao, grazie per aver chiamato Animol Life. Ti risponde un assistente virtuale: sono un\'intelligenza artificiale, non una persona. ' +
        'La chiamata non viene registrata. Solo con il tuo consenso conserveremo la trascrizione per migliorare la qualità del servizio. ' +
        'Acconsenti? Rispondi sì oppure no. In qualsiasi momento puoi dire operatore per parlare con una persona.';
      return twiml(gather(say(intro), 'consent'));
    },

    async respond(req) {
      const sid = req.body?.CallSid || 'anon';
      const s = session(sid);
      const step = req.query.step === 'consent' ? 'consent' : 'chat';
      const speech = String(req.body?.SpeechResult || '').trim().slice(0, 500);

      try {
        if (!speech) {
          s.misses += 1;
          if (step === 'consent' && s.consent === null) s.consent = false;
          if (s.misses >= 2) return twiml(say('Non ti sento bene. Puoi richiamarci quando vuoi. Arrivederci!') + '<Hangup/>');
          return twiml(gather(say('Scusa, non ho sentito. Come posso aiutarti? Ad esempio: stato di un ordine, spedizioni, resi o prodotti.')));
        }
        s.misses = 0;

        if (HUMAN_RE.test(speech)) return twiml(transfer());

        if (step === 'consent' && s.consent === null) {
          const short = speech.split(/\s+/).length <= 4; // "sì", "va bene", "no grazie": non una domanda
          const yes = short && YES_RE.test(speech) && !/\bnon\b/i.test(speech);
          const no = short && !yes && NO_RE.test(speech);
          if (yes || no) {
            s.consent = yes;
            return twiml(gather(say(
              `${yes ? 'Grazie, conserveremo la trascrizione solo per migliorare il servizio.' : 'Va bene, non conserveremo nulla di questa chiamata.'} ` +
              'Come posso aiutarti? Puoi chiedermi lo stato di un ordine, informazioni su prodotti, spedizioni, resi o coupon.',
            )));
          }
          s.consent = false; // nessuna risposta chiara: nessun consenso, rispondiamo direttamente alla domanda
        }

        if (BYE_RE.test(speech)) return twiml(say('Grazie per aver chiamato Animol Life. Buona giornata a te e al tuo amico a quattro zampe!') + '<Hangup/>');

        s.turns += 1;
        if (s.turns > MAX_TURNS) return twiml(say('Per richieste più articolate ti consiglio di parlare con un operatore.') + transfer());

        s.history.push({ role: 'user', content: speech });
        await logTurn(s, sid, 'user', speech);
        const { reply } = await assistant.answer({ messages: s.history, cart: [], channel: 'voice' });
        const spoken = cleanForSpeech(reply);
        s.history.push({ role: 'assistant', content: spoken });
        s.history = s.history.slice(-cfg.assistantMaxHistory);
        await logTurn(s, sid, 'assistant', spoken);
        return twiml(gather(say(`${spoken} Posso aiutarti in altro?`)));
      } catch (err) {
        console.error(`[voice] errore: ${err.message}`);
        return twiml(say('Mi dispiace, si è verificato un problema tecnico.') + transfer());
      }
    },
  };
}
