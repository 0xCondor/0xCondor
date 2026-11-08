import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/** Avvia un'app su una porta libera con dati e catalogo isolati (nessuna chiave: modalità demo). */
export async function startTestServer({ env = {}, overrides = {}, products, anthropicClient } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'animol-test-'));
  const publicDir = path.join(root, 'public');
  const dataDir = path.join(root, 'data');
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>Animol Life</title><h1>Animol Life</h1>');
  if (products) await fs.writeFile(path.join(publicDir, 'products.json'), JSON.stringify(products));
  const cfg = loadConfig(
    { NODE_ENV: 'test', RATE_LIMIT_ASSISTANT: '1000', RATE_LIMIT_ORDERS: '1000', RATE_LIMIT_FORMS: '1000', RATE_LIMIT_GENERAL: '5000', ...env },
    { publicDir, dataDir, ...overrides },
  );
  const app = createApp({ config: cfg, anthropicClient });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    app, cfg, base, dataDir, publicDir,
    post: (p, body, headers = {}) =>
      fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }),
    postForm: (p, params, headers = {}) =>
      fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body: new URLSearchParams(params).toString() }),
    get: (p) => fetch(base + p),
    async close() {
      await new Promise((r) => server.close(r));
      await fs.rm(root, { recursive: true, force: true });
    },
  };
}

export const CUSTOMER = {
  name: 'Mario Rossi',
  email: 'mario.rossi@example.it',
  address: 'Via Roma 1',
  city: 'Milano',
  cap: '20121',
  province: 'MI',
};
