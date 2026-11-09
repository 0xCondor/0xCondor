import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

/** Avvia un'app su una porta libera con dati e catalogo isolati (nessuna chiave: modalità demo). */
export const ADMIN = { email: 'admin@example.it', password: 'Admin-Password-Test-123' };

export async function startTestServer({ env = {}, overrides = {}, products, anthropicClient, fetch: fakeFetch } = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'animol-test-'));
  const publicDir = path.join(root, 'public');
  const dataDir = path.join(root, 'data');
  await fs.mkdir(publicDir, { recursive: true });
  await fs.writeFile(path.join(publicDir, 'index.html'), '<!doctype html><title>Animol Life</title><h1>Animol Life</h1>');
  if (products) await fs.writeFile(path.join(publicDir, 'products.json'), JSON.stringify(products));
  const cfg = loadConfig(
    {
      NODE_ENV: 'test', RATE_LIMIT_ASSISTANT: '1000', RATE_LIMIT_ORDERS: '1000', RATE_LIMIT_FORMS: '1000', RATE_LIMIT_GENERAL: '5000',
      RATE_LIMIT_AUTH: '1000', SCRYPT_COST: '1024', ADMIN_EMAIL: ADMIN.email, ADMIN_PASSWORD: ADMIN.password, ...env,
    },
    { publicDir, dataDir, ...overrides },
  );
  const app = createApp({ config: cfg, anthropicClient, fetch: fakeFetch });
  await app.locals.ready;
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
    /** Client con cookie e token CSRF, come un browser. */
    agent() { return createAgent(base); },
    async registerUser(email, { password = 'Passw0rd-Lunga!', name = 'Mario Rossi' } = {}) {
      const a = createAgent(base);
      const res = await a.post('/api/auth/register', { email, password, name, privacy: true });
      if (res.status !== 201) throw new Error(`registrazione fallita: ${res.status} ${await res.text()}`);
      return a;
    },
    async adminAgent() {
      const a = createAgent(base, 'admin');
      const res = await a.post('/api/admin/login', ADMIN);
      if (res.status !== 200) throw new Error(`login admin fallito: ${res.status} ${await res.text()}`);
      return a;
    },
    async close() {
      await new Promise((r) => server.close(r));
      app.locals.repo.close();
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

/** Mini "browser": conserva i cookie di sessione e invia automaticamente X-CSRF-Token. */
export function createAgent(base, kind = 'customer') {
  const jar = new Map();
  let csrf = null;
  const store = (res) => {
    for (const c of res.headers.getSetCookie()) {
      const [pair, ...attrs] = c.split(';');
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (/max-age=0/i.test(attrs.join(';')) || value === '') jar.delete(name); else jar.set(name, value);
    }
  };
  const request = async (method, p, body, headers = {}) => {
    const h = { ...headers };
    if (jar.size) h.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (csrf && !('x-csrf-token' in h)) h['x-csrf-token'] = csrf;
    if (body !== undefined) h['content-type'] = 'application/json';
    const res = await fetch(base + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    store(res);
    if ((res.headers.get('content-type') || '').includes('json')) {
      const clone = res.clone();
      const data = await clone.json().catch(() => null);
      if (data && typeof data.csrfToken === 'string') csrf = data.csrfToken;
    }
    return res;
  };
  return {
    kind, jar,
    get csrf() { return csrf; },
    set csrf(v) { csrf = v; },
    get: (p, headers) => request('GET', p, undefined, headers),
    post: (p, body = {}, headers) => request('POST', p, body, headers),
    put: (p, body = {}, headers) => request('PUT', p, body, headers),
    del: (p, headers) => request('DELETE', p, undefined, headers),
  };
}
