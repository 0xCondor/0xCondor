// Report vendite giornaliero: ordini, fatturato, scontrino medio, prodotti e categorie top, coupon.
import fs from 'node:fs/promises';
import path from 'node:path';
import { sendEmail } from '../src/email.js';
import { formatEuro } from '../src/policies.js';

function dayOf(args) {
  if (typeof args.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.date)) return args.date;
  const d = new Date();
  if (!args.today) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function runDailyReport({ cfg, stores, log }, args = {}) {
  const day = dayOf(args);
  const orders = (await stores.orders.read()).filter((o) => o.createdAt.slice(0, 10) === day && o.status !== 'annullato');
  const revenueCents = orders.reduce((s, o) => s + o.totalCents, 0);
  const products = new Map();
  const categories = new Map();
  const coupons = {};
  for (const o of orders) {
    if (o.couponCode) coupons[o.couponCode] = (coupons[o.couponCode] || 0) + 1;
    for (const l of o.lines) {
      const p = products.get(l.id) || { id: l.id, name: l.name, qty: 0, revenueCents: 0 };
      p.qty += l.qty;
      p.revenueCents += l.unitCents * l.qty;
      products.set(l.id, p);
      categories.set(l.category, (categories.get(l.category) || 0) + l.unitCents * l.qty);
    }
  }
  const report = {
    date: day,
    generatedAt: new Date().toISOString(),
    orders: orders.length,
    revenue: revenueCents / 100,
    averageOrderValue: orders.length ? Math.round(revenueCents / orders.length) / 100 : 0,
    plusOrders: orders.filter((o) => o.isPlus).length,
    topProducts: [...products.values()].sort((a, b) => b.qty - a.qty).slice(0, 5).map((p) => ({ ...p, revenue: p.revenueCents / 100, revenueCents: undefined })),
    revenueByCategory: Object.fromEntries([...categories].map(([k, v]) => [k, v / 100])),
    coupons,
  };
  if (!args['dry-run']) {
    const dir = path.join(cfg.dataDir, 'reports');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `sales-${day}.json`), JSON.stringify(report, null, 2));
    if (cfg.alertEmail) {
      await sendEmail(cfg, {
        tag: 'daily-report',
        to: cfg.alertEmail,
        subject: `Animol Life - vendite del ${day}: ${formatEuro(revenueCents)}`,
        text: `Ordini: ${report.orders}\nFatturato: ${formatEuro(revenueCents)}\nScontrino medio: ${report.averageOrderValue.toFixed(2)} €\n` +
          `Top prodotti:\n${report.topProducts.map((p) => `- ${p.name}: ${p.qty}`).join('\n') || '- nessuno'}`,
      });
    }
  }
  log(`[daily-report] ${day}: ${report.orders} ordini, ${formatEuro(revenueCents)}`);
  return report;
}
