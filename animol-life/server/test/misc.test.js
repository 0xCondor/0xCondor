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
