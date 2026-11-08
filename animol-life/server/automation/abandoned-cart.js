// Promemoria carrello abbandonato: email (stub) ai carrelli salvati con consenso, fermi da più di N ore,
// senza ordine successivo e non ancora sollecitati. Un solo promemoria per carrello.
import { resolveCart } from '../src/orders.js';
import { sendEmail } from '../src/email.js';
import { formatEuro } from '../src/policies.js';
import { baseUrl } from '../src/config.js';

export async function runAbandonedCart({ cfg, catalog, stores, log }, args = {}) {
  const dryRun = Boolean(args['dry-run']);
  const cutoff = Date.now() - cfg.abandonedCartHours * 3_600_000;
  const [carts, orders] = await Promise.all([stores.carts.read(), stores.orders.read()]);
  const due = carts.filter((c) => !c.remindedAt && Date.parse(c.updatedAt) < cutoff && c.items?.length);
  const reminded = [];
  for (const cart of due) {
    const ordered = orders.some((o) => o.customer.email === cart.email && Date.parse(o.createdAt) >= Date.parse(cart.updatedAt));
    if (ordered) continue;
    const lines = await resolveCart(catalog, cart.items, { strict: false });
    if (!lines.length) continue;
    const total = lines.reduce((s, l) => s + l.unitCents * l.qty, 0);
    const list = lines.map((l) => `- ${l.qty} x ${l.name}${l.variant ? ` (${l.variant})` : ''}`).join('\n');
    if (!dryRun) {
      await sendEmail(cfg, {
        tag: 'abandoned-cart',
        to: cart.email,
        subject: 'Hai lasciato qualcosa nel carrello',
        text: `Ciao! Nel tuo carrello Animol Life ti aspettano:\n${list}\n\nTotale prodotti: ${formatEuro(total)}.` +
          `${total < cfg.shipping.freeThresholdCents ? ` Aggiungi ${formatEuro(cfg.shipping.freeThresholdCents - total)} per la spedizione gratuita.` : ' La spedizione è gratuita!'}\n` +
          `Completa l'ordine: ${baseUrl(cfg)}/\n\nNon vuoi più ricevere questi promemoria? Rispondi a questa email.`,
      });
    }
    reminded.push(cart.email);
  }
  if (!dryRun && reminded.length) {
    const now = new Date().toISOString();
    await stores.carts.update((all) => {
      for (const c of all) if (reminded.includes(c.email)) c.remindedAt = now;
    });
  }
  log(`[abandoned-cart] carrelli salvati: ${carts.length}, da sollecitare: ${reminded.length}${dryRun ? ' (dry-run, nessuna email)' : ''}`);
  return { checked: carts.length, reminded: reminded.length, dryRun };
}
