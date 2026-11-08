import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startTestServer, CUSTOMER } from './helpers.js';
import { createContext } from '../automation/context.js';
import { runAbandonedCart } from '../automation/abandoned-cart.js';
import { runLowStock } from '../automation/low-stock.js';
import { runDailyReport } from '../automation/daily-report.js';
import { runAiContent } from '../automation/ai-content.js';
import { outbox } from '../src/email.js';

const servers = [];
after(async () => { await Promise.all(servers.map((s) => s.close())); });

test('rate limit per IP sull\'assistente -> 429', async () => {
  const t = await startTestServer({ env: { RATE_LIMIT_ASSISTANT: '2' } });
  servers.push(t);
  const send = () => t.post('/api/assistant', { messages: [{ role: 'user', content: 'ciao' }] });
  assert.equal((await send()).status, 200);
  assert.equal((await send()).status, 200);
  const res = await send();
  assert.equal(res.status, 429);
  assert.ok(res.headers.get('retry-after'));
});

test('catalogo letto da products.json del frontend', async () => {
  const products = [{
    id: 'p1', name: 'Tiragraffi Torre', brand: 'Felix', category: 'gatti', price: 59, salePrice: 45, lowestPrice30d: 45,
    rating: 4.5, reviews: 10, sold: 5, description: 'Torre tiragraffi', specs: {}, variants: [{ label: 'Grande', price: 79, salePrice: null }],
  }];
  const t = await startTestServer({ products });
  servers.push(t);
  const health = await (await t.get('/api/health')).json();
  assert.equal(health.catalog.source, 'products.json');
  assert.equal(health.catalog.count, 1);
  const order = await (await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: 'p1', variant: 'Grande', qty: 1 }] })).json();
  assert.equal(order.total, 79);
});

test('automazioni in modalità demo', async () => {
  const t = await startTestServer({ env: { ALERT_EMAIL: 'ops@example.it' } });
  servers.push(t);
  const logs = [];
  const ctx = createContext({ cfg: t.cfg, log: (m) => logs.push(m) });

  // carrello abbandonato: uno vecchio (da sollecitare) e uno recente
  const old = new Date(Date.now() - 48 * 3_600_000).toISOString();
  await ctx.stores.carts.write([
    { email: 'old@example.it', items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], updatedAt: old, remindedAt: null },
    { email: 'new@example.it', items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], updatedAt: new Date().toISOString(), remindedAt: null },
  ]);
  const ac = await runAbandonedCart(ctx, {});
  assert.equal(ac.reminded, 1);
  assert.ok(outbox.some((m) => m.tag === 'abandoned-cart' && m.to === 'old@example.it'));
  assert.equal((await runAbandonedCart(ctx, {})).reminded, 0, 'un solo promemoria');

  const ls = await runLowStock(ctx, {});
  assert.equal(ls.simulated, true);
  await ctx.stores.inventory.write({ 'fieno-coniglio-1kg': 1, 'gabbia-criceto-deluxe': 50 });
  const ls2 = await runLowStock(ctx, { threshold: '3' });
  assert.equal(ls2.simulated, false);
  assert.ok(ls2.low.some((p) => p.id === 'fieno-coniglio-1kg'));
  assert.ok(!ls2.low.some((p) => p.id === 'gabbia-criceto-deluxe'));

  await t.post('/api/orders', { customer: CUSTOMER, coupon: 'ANIMOL10', items: [{ id: 'gabbia-criceto-deluxe', qty: 2 }] });
  const rep = await runDailyReport(ctx, { today: true });
  assert.equal(rep.orders, 1);
  assert.equal(rep.coupons.ANIMOL10, 1);
  assert.equal(rep.topProducts[0].id, 'gabbia-criceto-deluxe');
  await fs.access(path.join(t.dataDir, 'reports', `${rep.date}.json`.replace(/^/, 'sales-')));

  const ai = await runAiContent(ctx, { limit: '2' });
  assert.equal(ai.mode, 'template');
  assert.equal(ai.items.length, 2);
  for (const i of ai.items) assert.ok(i.description && i.instagram && i.facebook && i.hashtags.length);
});

test('ai-content con Claude (client finto) usa output JSON strutturato', async () => {
  const t = await startTestServer();
  servers.push(t);
  const ctx = createContext({ cfg: t.cfg, log: () => {} });
  let params;
  const client = {
    beta: { messages: { async create(p) {
      params = p;
      return { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ items: [{ id: 'fieno-coniglio-1kg', description: 'd', instagram: 'i', facebook: 'f', hashtags: ['#a'] }, { id: 'inventato', description: 'x', instagram: 'x', facebook: 'x', hashtags: [] }] }) }] };
    } } },
  };
  const out = await runAiContent(ctx, { id: 'fieno-coniglio-1kg', 'dry-run': true }, { client });
  assert.equal(out.mode, 'claude');
  assert.deepEqual(out.items.map((i) => i.id), ['fieno-coniglio-1kg']);
  assert.equal(params.output_config.format.type, 'json_schema');
});

test('promemoria Plus: fine prova (3 giorni prima) e rinnovo annuale, una sola volta', async () => {
  const { runPlusReminders } = await import('../automation/plus-reminders.js');
  const t = await startTestServer();
  servers.push(t);
  const ctx = createContext({ cfg: t.cfg, log: () => {} });
  const inDays = (d) => new Date(Date.now() + d * 86_400_000).toISOString();
  await ctx.stores.plus.write({
    tokens: [],
    members: [
      { email: 'trial@example.it', plan: 'monthly', status: 'trialing', trialEndsAt: inDays(2), currentPeriodEnd: inDays(2) },
      { email: 'trial-far@example.it', plan: 'monthly', status: 'trialing', trialEndsAt: inDays(10) },
      { email: 'year@example.it', plan: 'yearly', status: 'active', currentPeriodEnd: inDays(20) },
      { email: 'month@example.it', plan: 'monthly', status: 'active', currentPeriodEnd: inDays(5) },
      { email: 'gone@example.it', plan: 'yearly', status: 'active', currentPeriodEnd: inDays(5), cancelAtPeriodEnd: true },
    ],
  });
  const r = await runPlusReminders(ctx, {});
  assert.deepEqual({ trial: r.trial, renewal: r.renewal }, { trial: 1, renewal: 1 });
  assert.ok(outbox.some((m) => m.tag === 'plus-trial-ending' && m.to === 'trial@example.it' && /5,99/.test(m.text)));
  assert.ok(outbox.some((m) => m.tag === 'plus-annual-renewal' && m.to === 'year@example.it' && /49,90/.test(m.text)));
  const again = await runPlusReminders(ctx, {});
  assert.deepEqual({ trial: again.trial, renewal: again.renewal }, { trial: 0, renewal: 0 });
});

test('catalogo reale: public/products.json (24 prodotti) coincide con il catalogo incorporato in index.html', async () => {
  const { readFile } = await import('node:fs/promises');
  const { fileURLToPath } = await import('node:url');
  const pub = fileURLToPath(new URL('../../public/', import.meta.url));
  const products = JSON.parse(await readFile(pub + 'products.json', 'utf8'));
  const html = await readFile(pub + 'index.html', 'utf8');
  const embedded = JSON.parse(html.match(/<script[^>]*id="catalog-data"[^>]*>([\s\S]*?)<\/script>/)[1]);
  assert.equal(products.length, 24);
  const key = (p) => JSON.stringify([p.id, p.category, p.price, p.salePrice ?? null, (p.variants || []).map((v) => [v.label, v.price, v.salePrice ?? null])]);
  assert.deepEqual(embedded.map(key), products.map(key));
  const { Catalog } = await import('../src/catalog.js');
  const cat = new Catalog(pub);
  assert.equal((await cat.all()).length, 24);
  assert.equal(cat.source, 'products.json');
});
