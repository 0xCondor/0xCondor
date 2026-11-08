// Hook email: se EMAIL_WEBHOOK_URL è impostato inoltra il messaggio (es. a un tuo
// endpoint Postmark/Brevo/SES/Make), altrimenti lo registra soltanto (modalità demo).
export const outbox = []; // usato dai test e in demo; tiene solo gli ultimi 50 messaggi

export function maskEmail(email = '') {
  const [user, domain] = String(email).split('@');
  if (!domain) return '***';
  return `${user.slice(0, 2)}***@${domain}`;
}

export async function sendEmail(cfg, { to, subject, text, tag }) {
  const msg = { to, from: cfg.emailFrom, subject, text, tag, at: new Date().toISOString() };
  outbox.push(msg);
  if (outbox.length > 50) outbox.shift();

  if (!cfg.emailWebhookUrl) {
    if (cfg.env !== 'test') {
      console.log(`[email:demo] ${tag || 'email'} -> ${maskEmail(to)} | ${subject}`);
      const link = text.match(/https?:\/\/\S+/);
      if (link) console.log(`[email:demo] link: ${link[0]}`);
    }
    return { delivered: false, demo: true };
  }
  try {
    const res = await fetch(cfg.emailWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(msg),
      signal: AbortSignal.timeout(8000),
    });
    return { delivered: res.ok, status: res.status };
  } catch (err) {
    console.error(`[email] invio fallito verso ${maskEmail(to)}: ${err.message}`);
    return { delivered: false, error: err.message };
  }
}
