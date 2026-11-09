// Avviso scorte basse: usa le scorte gestite dal pannello admin (database); per gli altri prodotti
// legge data/inventory.json ({ "<id>": quantità }) oppure, se non c'è nulla, scorte simulate (demo).
import crypto from 'node:crypto';
import { sendEmail } from '../src/email.js';

function simulatedStock(id) {
  const h = crypto.createHash('md5').update(id).digest();
  return h[0] % 40; // 0-39, deterministico per prodotto
}

export async function runLowStock({ cfg, catalog, stores, log }, args = {}) {
  const threshold = Number(args.threshold) || cfg.lowStockThreshold;
  const products = await catalog.all();
  const inventory = await stores.inventory.read();
  const tracked = products.some((p) => p.stock !== null && p.stock !== undefined);
  const simulated = !inventory && !tracked;
  const low = products
    .filter((p) => simulated || inventory || (p.stock !== null && p.stock !== undefined))
    .map((p) => {
      const stock = p.stock ?? (simulated ? simulatedStock(p.id) : Number(inventory?.[p.id] ?? 0));
      return { id: p.id, name: p.name, stock, sold: p.sold };
    })
    .filter((p) => p.stock <= threshold)
    .sort((a, b) => a.stock - b.stock || b.sold - a.sold);
  if (low.length && cfg.alertEmail && !args['dry-run']) {
    await sendEmail(cfg, {
      tag: 'low-stock',
      to: cfg.alertEmail,
      subject: `Scorte basse: ${low.length} prodotti sotto soglia (${threshold})`,
      text: low.map((p) => `- ${p.name} [${p.id}]: ${p.stock} pezzi`).join('\n'),
    });
  }
  log(`[low-stock] ${low.length} prodotti con scorte <= ${threshold}${simulated ? ' (scorte simulate: crea data/inventory.json)' : ''}`);
  for (const p of low) log(`  - ${p.name}: ${p.stock}`);
  return { threshold, simulated, low };
}
