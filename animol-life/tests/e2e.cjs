#!/usr/bin/env node
/*
 * Test end-to-end di Animol Life con Playwright (Chromium).
 *
 *   node animol-life/tests/e2e.cjs            # tutto
 *   E2E_SCREENSHOTS=1 node animol-life/tests/e2e.cjs   # salva anche gli screenshot in docs/screenshots/
 *
 * Avvia da solo:
 *  - il server reale (server/src/index.js, modalità demo, dati in una cartella temporanea) su E2E_PORT (default 3000);
 *  - un server statico senza backend (python3 -m http.server) su E2E_STATIC_PORT (default 8765) dentro public/.
 * Esegue le verifiche su desktop 1440 e mobile 390, tema chiaro e scuro, e termina con exit code 1 se qualcosa fallisce.
 */
'use strict';
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SERVER_DIR = path.join(ROOT, 'server');
const PORT = Number(process.env.E2E_PORT || 3000);
const STATIC_PORT = Number(process.env.E2E_STATIC_PORT || 8765);
const SERVER_URL = `http://localhost:${PORT}`;
const STATIC_URL = `http://localhost:${STATIC_PORT}`;
const SHOTS = process.env.E2E_SCREENSHOTS === '1';
const PRODUCTS = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'products.json'), 'utf8'));
const BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p]));

/* ---------- risultati ---------- */
const results = [];
let lastPage = null;
let currentSuite = '';
function check(name, ok, detail) {
  results.push({ suite: currentSuite, name, ok: !!ok, detail: ok ? '' : String(detail ?? '') });
  console.log(`${ok ? '  ok  ' : '  FAIL'} [${currentSuite}] ${name}${ok ? '' : ` -> ${detail ?? ''}`}`);
}
async function step(name, fn) {
  try { await fn(); } catch (err) {
    const lines = err.message.split('\n');
    const where = lines.find((l) => /waiting for|locator resolved|intercepts pointer/.test(l));
    check(name, false, lines[0] + (where ? ` (${where.replace(/\x1b\[\d+m/g, '').trim()})` : ''));
    if (process.env.E2E_DEBUG && lastPage) {
      const f = path.join(os.tmpdir(), `e2e-fail-${results.length}.png`);
      await lastPage.screenshot({ path: f }).catch(() => {});
      console.log('    screenshot:', f, '\n    ', lines.slice(1, 12).join('\n     '));
    }
  }
}

/* ---------- riferimento indipendente per i totali (stesse regole del server) ---------- */
const SHIP = { standard: { c: 490, free: true }, express: { c: 990, free: false }, point: { c: 290, free: true } };
function unitCents(id, variant) {
  const p = BY_ID[id];
  const v = variant ? p.variants.find((x) => x.label === variant) : null;
  const s = v || p;
  return Math.round((s.salePrice ?? s.price) * 100);
}
function expectedTotal(lines, { coupon = null, plus = false, ship = 'standard' } = {}) {
  const sub = lines.reduce((s, l) => s + unitCents(l.id, l.variant) * l.qty, 0);
  const cp = coupon === 'ANIMOL10' ? 10 : coupon === 'CUCCIOLO5' ? 5 : 0;
  const disc = Math.round((sub * cp) / 100) + (plus ? Math.round((sub * 5) / 100) : 0);
  const goods = sub - disc;
  const shipping = SHIP[ship].free && (plus || goods >= 4900) ? 0 : SHIP[ship].c;
  return (goods + shipping) / 100;
}
const euro = (n) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }).replace(/\s/g, ' ');
const normSpaces = (s) => String(s).replace(/[\s ]+/g, ' ');

/* ---------- processi ---------- */
const procs = [];
function startProc(cmd, args, opts) {
  const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...opts });
  let log = '';
  p.stdout.on('data', (d) => { log += d; });
  p.stderr.on('data', (d) => { log += d; });
  p.getLog = () => log;
  procs.push(p);
  return p;
}
async function waitFor(url, ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.status < 500) return true; } catch { /* riprova */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timeout in attesa di ${url}`);
}
function stopAll() { for (const p of procs) { try { p.kill('SIGTERM'); } catch { /* già chiuso */ } } }
process.on('exit', stopAll);
process.on('SIGINT', () => { stopAll(); process.exit(130); });

/* ---------- utilità pagina ---------- */
function watchErrors(page, mode) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Senza backend le chiamate /api/* ricevono 404/501 dal server statico: è il fallback previsto.
    if (mode === 'static' && /Failed to load resource.*(404|501)/.test(t)) return;
    errors.push(`console: ${t}`);
  });
  return errors;
}
async function newPage(browser, { base, mode, width, scheme, consent = true, storage = null }) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
    deviceScaleFactor: SHOTS ? 2 : 1,
    colorScheme: scheme,
    isMobile: width < 600,
    hasTouch: width < 600,
    locale: 'it-IT',
  });
  if (consent || storage) {
    await ctx.addInitScript(([c, st]) => {
      if (sessionStorage.getItem('__e2e_init')) return;
      sessionStorage.setItem('__e2e_init', '1');
      if (c) localStorage.setItem('al_consent', JSON.stringify({ necessary: true, preferences: true, analytics: false, marketing: false, date: new Date().toISOString(), version: 1 }));
      if (st) for (const [k, v] of Object.entries(st)) localStorage.setItem(k, JSON.stringify(v));
    }, [consent, storage]);
  }
  const page = await ctx.newPage();
  lastPage = page;
  const errors = watchErrors(page, mode);
  await page.goto(base + '/', { waitUntil: 'load' });
  await waitGrid(page);
  return { ctx, page, errors };
}
/* Il codice della pagina è in una IIFE: i test usano solo DOM e localStorage (come farebbe un utente). */
async function waitGrid(page) { await page.waitForSelector('#grid .card:not(.skeleton)'); }
async function reload(page) { await page.reload(); await waitGrid(page); }
async function ls(page, key) { return page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), key); }
async function seedCart(page, lines, coupon = null) {
  await page.evaluate(([ls2, c]) => {
    localStorage.setItem('al_cart', JSON.stringify(ls2));
    if (c) localStorage.setItem('al_coupon', JSON.stringify(c)); else localStorage.removeItem('al_coupon');
  }, [lines.map((l) => ({ id: l.id, variant: l.variant ?? (BY_ID[l.id].variants?.[0]?.label ?? null), qty: l.qty }))].concat([coupon]));
  await reload(page);
}
const visibleSearch = (page) => page.locator('[data-search] input:visible').first();
async function cartCount(page) {
  const t = await page.locator('#cart-count').textContent();
  return (await page.locator('#cart-count').isHidden()) ? 0 : Number(t);
}
async function closeAllDialogs(page) {
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()));
}
async function clearCart(page) { await seedCart(page, []); }
async function addViaCard(page, id, variant) {
  if (variant) await page.locator(`.card[data-pid="${id}"] .vpill[data-v="${variant}"]`).click();
  await page.locator(`.card[data-pid="${id}"] [data-act="add"]`).click();
}
async function ensureInGrid(page, id) {
  await reload(page);
  await page.locator(`.card[data-pid="${id}"]`).waitFor();
}
const ADDRESS = { 'f-nome': 'Mario', 'f-cognome': 'Rossi', 'f-email': 'mario.e2e@example.it', 'f-tel': '+39 333 1234567', 'f-via': 'Via Roma', 'f-civico': '1', 'f-cap': '20121', 'f-prov': 'MI', 'f-citta': 'Milano' };
async function fillCheckout(page, overrides = {}) {
  const data = { ...ADDRESS, ...overrides };
  for (const [id, v] of Object.entries(data)) await page.fill('#' + id, v);
}
async function placeOrder(page, { ship, pay, email, expectServer }) {
  await page.locator('#cart-btn').click();
  await page.locator('#go-checkout').click();
  await page.locator('#dlg-checkout[open]').waitFor();
  await fillCheckout(page, email ? { 'f-email': email } : {});
  await page.locator(`label.option:has(input[name="ship"][value="${ship}"])`).click();
  await page.locator(`label.option:has(input[name="pay"][value="${pay}"])`).click();
  const shownTotal = normSpaces(await page.locator('#sum-totals .row.total span').last().textContent());
  await page.locator('#f-terms').check();
  let apiBody = null;
  let reqBody = null;
  const respP = expectServer ? page.waitForResponse((r) => r.url().endsWith('/api/orders') && r.request().method() === 'POST') : null;
  await page.locator('#co-submit').click();
  if (respP) {
    const resp = await respP;
    reqBody = resp.request().postDataJSON();
    apiBody = await resp.json().catch(() => null);
  }
  await page.locator('#dlg-confirm[open]').waitFor();
  const okText = normSpaces(await page.locator('#ok-body').textContent());
  const orderId = (await page.locator('#order-number').textContent()).trim();
  await closeAllDialogs(page);
  return { shownTotal, apiBody, reqBody, okText, orderId };
}

/* =====================================================================
   Suite di base: per ogni origine × viewport × tema
   ===================================================================== */
async function suiteBasics(browser, env) {
  const { base, mode, width, scheme } = env;
  currentSuite = `${mode} ${width}px ${scheme}`;
  const { ctx, page, errors } = await newPage(browser, env);

  await step('tema', async () => {
    check('tema applicato da prefers-color-scheme', (await page.getAttribute('html', 'data-theme')) === scheme, await page.getAttribute('html', 'data-theme'));
  });
  await step('layout', async () => {
    const sw = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('nessuno scroll orizzontale', sw <= 1, `scrollWidth eccede di ${sw}px`);
    check('24 prodotti in griglia', (await page.locator('#grid .card').count()) === 24, await page.locator('#grid .card').count());
  });

  await step('ricerca', async () => {
    const s = visibleSearch(page);
    await s.fill('lettiera');
    await page.waitForTimeout(400);
    const names = await page.locator('#grid .card .card-title').allTextContents();
    const pidsS = await page.locator('#grid .card').evaluateAll((els) => els.map((e) => e.dataset.pid));
    const hay = (id) => { const p = BY_ID[id]; return `${p.name} ${p.brand} ${p.description} ${JSON.stringify(p.specs || {})}`; };
    check('ricerca "lettiera" filtra i risultati', names.length > 0 && names.length < 24 && pidsS.every((id) => /lettiera/i.test(hay(id))), names.join(' | '));
    await s.fill('zzzznessuno');
    await page.waitForTimeout(400);
    check('ricerca senza risultati mostra 0 card', (await page.locator('#grid .card').count()) === 0);
    await s.fill('');
    await page.waitForTimeout(400);
  });

  await step('filtri', async () => {
    await ensureInGrid(page, PRODUCTS[0].id);
    await page.locator('#cat-chips button', { hasText: 'Gatti' }).first().click();
    await page.waitForTimeout(200);
    const pids = await page.locator('#grid .card').evaluateAll((els) => els.map((e) => e.dataset.pid));
    check('filtro categoria Gatti', pids.length === PRODUCTS.filter((p) => p.category === 'gatti').length && pids.every((id) => BY_ID[id].category === 'gatti'), pids.join(','));
    await page.locator('#cat-chips button', { hasText: 'Tutti' }).first().click();
    await page.locator('#only-sale').click();
    await page.waitForTimeout(200);
    const sale = await page.locator('#grid .card').evaluateAll((els) => els.map((e) => e.dataset.pid));
    const hasSale = (p) => (p.variants?.length ? p.variants.some((v) => v.salePrice != null) : p.salePrice != null);
    check('filtro "solo offerte"', sale.length > 0 && sale.every((id) => hasSale(BY_ID[id])), sale.join(','));
    await page.locator('#only-sale').click();
  });

  await step('ordinamento', async () => {
    const prices = async () => (await page.locator('#grid .card').evaluateAll((els) => els.map((e) => {
      const v = e.querySelector('.vpill[aria-checked="true"]'); return [e.dataset.pid, v ? v.dataset.v : null];
    }))).map(([id, v]) => unitCents(id, v));
    const opts = await page.locator('#sort option').evaluateAll((o) => o.map((x) => x.value));
    const asc = opts.find((v) => /asc|low|cresc/i.test(v)); const desc = opts.find((v) => /desc|high|decresc/i.test(v));
    if (asc) { await page.selectOption('#sort', asc); const a = await prices(); check(`ordinamento ${asc}`, a.every((x, i) => i === 0 || a[i - 1] <= x), a.join(',')); }
    else check('opzione prezzo crescente presente', false, opts.join(','));
    if (desc) { await page.selectOption('#sort', desc); const d = await prices(); check(`ordinamento ${desc}`, d.every((x, i) => i === 0 || d[i - 1] >= x), d.join(',')); }
    if (opts.includes('rating')) {
      await page.selectOption('#sort', 'rating');
      const r = (await page.locator('#grid .card').evaluateAll((els) => els.map((e) => e.dataset.pid))).map((id) => BY_ID[id].rating);
      check('ordinamento per valutazione', r.every((x, i) => i === 0 || r[i - 1] >= x), r.join(','));
    }
    await page.selectOption('#sort', 'best');
  });

  await step('preferiti', async () => {
    const id = PRODUCTS[2].id;
    await page.locator(`.card[data-pid="${id}"] [data-act="fav"]`).click();
    check('preferito: aria-pressed=true', (await page.locator(`.card[data-pid="${id}"] [data-act="fav"]`).getAttribute('aria-pressed')) === 'true');
    await reload(page);
    check('preferiti persistono dopo il ricaricamento', (await page.locator(`.card[data-pid="${id}"] [data-act="fav"]`).getAttribute('aria-pressed')) === 'true');
    check('contatore preferiti', (await page.locator('#fav-count').textContent()).trim() === '1');
    await page.locator(`.card[data-pid="${id}"] [data-act="fav"]`).click();
  });

  await step('scheda prodotto e varianti', async () => {
    const p = PRODUCTS.find((x) => x.variants && x.variants.length >= 2);
    await clearCart(page);
    await ensureInGrid(page, p.id);
    await page.locator(`.card[data-pid="${p.id}"] .card-title button`).click();
    await page.locator('#dlg-product[open]').waitFor();
    const v2 = p.variants[1];
    await page.locator(`#dlg-product [data-pdv="${v2.label}"]`).click();
    const addTxt = normSpaces(await page.locator('#pd-add').textContent());
    check('variante cambia prezzo nel pulsante', addTxt.includes(normSpaces(euro(v2.salePrice ?? v2.price))), `${addTxt} vs ${euro(v2.salePrice ?? v2.price)}`);
    const note = await page.locator('#reviews-note').textContent();
    check('nota onesta sulle recensioni', /Recensioni di esempio/.test(note) && !/ordine reale/i.test(note), note);
    await page.locator('#dlg-product [data-pdq="1"]').click();
    await page.locator('#pd-add').click();
    await page.waitForFunction(() => !/^#p=/.test(location.hash));
    const line = (await ls(page, 'al_cart'))[0];
    check('aggiunta dalla scheda: variante e quantità 2', line && line.variant === v2.label && line.qty === 2, JSON.stringify(line));
    await page.keyboard.press('Escape');
    check('Esc chiude la scheda', !(await page.locator('#dlg-product').evaluate((d) => d.open)));
  });

  await step('carrello, soglia e coupon', async () => {
    await clearCart(page);
    const cheap = PRODUCTS.slice().filter((p) => !p.variants?.length).sort((a, b) => (a.salePrice ?? a.price) - (b.salePrice ?? b.price))[0];
    await addViaCard(page, cheap.id);
    check('badge carrello = 1', (await cartCount(page)) === 1);
    await page.locator('#cart-btn').click();
    await page.locator('#dlg-cart[open]').waitFor();
    const bar = await page.locator('#cart-body .ship-progress').textContent();
    const missing = (4900 - unitCents(cheap.id)) / 100;
    check('barra spedizione gratuita: importo mancante', normSpaces(bar).includes(normSpaces(euro(missing))), `${bar} / ${euro(missing)}`);
    await page.locator('#cart-body [data-qty="1"]').click();
    await page.locator('#cart-body [data-qty="1"]').click();
    check('quantità +2 -> 3', (await page.locator('#cart-body .qty output').textContent()).trim() === '3');
    await page.locator('#cart-body [data-qty="-1"]').click();
    check('quantità -1 -> 2', (await page.locator('#cart-body .qty output').textContent()).trim() === '2');
    for (let i = 0; i < 19; i++) await page.locator('#cart-body [data-qty="1"]').click();
    check('quantità massima 20 (come il server)', (await page.locator('#cart-body .qty output').textContent()).trim() === '20' && (await ls(page, 'al_cart'))[0].qty === 20);
    await closeAllDialogs(page);
    await seedCart(page, [{ id: cheap.id, qty: 2 }]);
    await page.locator('#cart-btn').click();
    await page.fill('#coupon-input', 'FINTO99');
    await page.locator('#coupon-form button').first().click();
    check('coupon non valido rifiutato', /non valido/i.test(await page.locator('#coupon-err').textContent()));
    for (const [code, pct] of [['ANIMOL10', 10], ['CUCCIOLO5', 5]]) {
      if (await page.locator('#coupon-remove').count()) await page.locator('#coupon-remove').click();
      await page.fill('#coupon-input', code.toLowerCase());
      await page.locator('#coupon-form button').first().click();
      const disc = normSpaces(await page.locator('#cart-foot .row.discount span').last().textContent());
      const tot = normSpaces(await page.locator('#cart-foot .row.total span').last().textContent());
      const expDisc = Math.round(unitCents(cheap.id) * 2 * pct / 100) / 100;
      const exp = expectedTotal([{ id: cheap.id, qty: 2 }], { coupon: code });
      check(`coupon ${code} -${pct}%`, disc === normSpaces('−' + euro(expDisc)) && tot === normSpaces(euro(exp)), `${disc} ${tot} exp ${euro(expDisc)} ${euro(exp)}`);
    }
    await page.locator('#coupon-remove').click();
    await closeAllDialogs(page);
    // sopra soglia
    await seedCart(page, [{ id: 'cani-crocchette-adult-agnello', qty: 4 }].filter((l) => BY_ID[l.id]));
    await page.locator('#cart-btn').click();
    const shipRow = await page.locator('#cart-foot .row', { hasText: 'Spedizione' }).textContent();
    check('sopra 49 € spedizione standard gratuita e barra completa', /Gratuita/.test(shipRow) && (await page.locator('#cart-body .ship-progress.done').count()) === 1, shipRow);
    await closeAllDialogs(page);
    await clearCart(page);
  });

  await step('CAP non valido', async () => {
    await seedCart(page, [{ id: 'cani-crocchette-adult-agnello', qty: 1 }]);
    await page.locator('#cart-btn').click();
    await page.locator('#go-checkout').click();
    await fillCheckout(page, { 'f-cap': '1234' });
    await page.locator('#f-terms').check();
    await page.locator('#co-submit').click();
    check('CAP di 4 cifre rifiutato', /5 cifre/.test(await page.locator('#f-cap').locator('xpath=ancestor::*[contains(@class,"field")][1]').locator('.err').textContent()));
    await page.fill('#f-cap', '99999');
    await page.locator('#co-submit').click();
    check('CAP 99999 rifiutato', (await page.locator('#f-cap').getAttribute('aria-invalid')) === 'true');
    check('dialog checkout ancora aperto', await page.locator('#dlg-checkout').evaluate((d) => d.open));
    await closeAllDialogs(page);
    await clearCart(page);
  });

  await step('checkout singolo', async () => {
    const lines = [{ id: 'gatti-lettiera-agglomerante-vegetale', qty: 1 }].filter((l) => BY_ID[l.id]);
    const first = lines.length ? lines : [{ id: PRODUCTS[5].id, variant: PRODUCTS[5].variants?.[0]?.label, qty: 1 }];
    await seedCart(page, first);
    const ship = width < 600 ? 'point' : 'express';
    const r = await placeOrder(page, { ship, pay: 'cod', expectServer: mode === 'server' });
    const exp = expectedTotal(first.map((l) => ({ ...l, variant: l.variant || (BY_ID[l.id].variants?.[0]?.label ?? null) })), { ship });
    if (mode === 'server') {
      check('ordine accettato dal server', r.apiBody && /^AL-\d{4}-[A-Z0-9]{6}$/.test(r.apiBody.orderId), JSON.stringify(r.apiBody));
      check('pagina invia shippingMethod', r.reqBody.shippingMethod === ship, r.reqBody.shippingMethod);
      check('totale server = riferimento', r.apiBody.total === exp, `${r.apiBody.total} vs ${exp}`);
      check('conferma mostra totale server', r.okText.includes(normSpaces(euro(r.apiBody.total))), r.okText);
      check('numero ordine = server', r.orderId === r.apiBody.orderId);
    } else {
      check('ordine locale in modalità demo', /Modalità dimostrativa/.test(r.okText) && /^AL-/.test(r.orderId), r.okText);
      check('totale locale = riferimento', r.okText.includes(normSpaces(euro(exp))), `${r.okText} / ${euro(exp)}`);
    }
    check('carrello svuotato dopo ordine', (await cartCount(page)) === 0);
  });

  check('nessun errore in console/pagina', errors.length === 0, errors.join(' || '));
  if (SHOTS && ((width === 1440 && scheme === 'light') || (width === 390 && scheme === 'dark')) && mode === 'server') {
    const dir = path.join(ROOT, 'docs', 'screenshots');
    fs.mkdirSync(dir, { recursive: true });
    const p2 = await ctx.newPage();
    await p2.goto(base + '/');
    await waitGrid(p2);
    await p2.waitForTimeout(500);
    await p2.screenshot({ path: path.join(dir, `home-${width === 1440 ? 'desktop-light' : 'mobile-dark'}.png`) });
    if (width === 1440) {
      await p2.locator('#shop').scrollIntoViewIfNeeded();
      await p2.waitForTimeout(300);
      await p2.screenshot({ path: path.join(dir, 'catalogo-desktop-light.png') });
    }
  }
  await ctx.close();
}

/* =====================================================================
   Checkout: 3 spedizioni × 3 pagamenti, storico ordini
   ===================================================================== */
async function suiteCheckoutMatrix(browser, env) {
  currentSuite = `${env.mode} checkout 3×3`;
  const { ctx, page, errors } = await newPage(browser, env);
  const carts = [
    [{ id: 'piccoli-fieno-montagna-1kg', qty: 1 }],
    [{ id: 'cani-crocchette-adult-agnello', qty: 4 }],
  ].map((c) => c.filter((l) => BY_ID[l.id]));
  if (!carts[0].length) carts[0] = [{ id: PRODUCTS.find((p) => !p.variants?.length).id, qty: 1 }];
  if (!carts[1].length) carts[1] = [{ id: PRODUCTS.find((p) => !p.variants?.length).id, qty: 8 }];
  const withVariant = (ls) => ls.map((l) => ({ ...l, variant: BY_ID[l.id].variants?.[0]?.label ?? null }));
  let n = 0;
  const placed = [];
  for (const ship of ['standard', 'express', 'point']) {
    for (const pay of ['card', 'paypal', 'cod']) {
      await step(`${ship} + ${pay}`, async () => {
        const lines = withVariant(carts[n++ % 2]);
        await seedCart(page, lines);
        const r = await placeOrder(page, { ship, pay, expectServer: env.mode === 'server' });
        const exp = expectedTotal(lines, { ship });
        check(`${ship}+${pay}: totale mostrato prima dell'invio = riferimento`, r.shownTotal === normSpaces(euro(exp)), `${r.shownTotal} vs ${euro(exp)}`);
        if (env.mode === 'server') {
          check(`${ship}+${pay}: totale server = totale pagina`, r.apiBody.total === exp, `${r.apiBody.total} vs ${exp}`);
          check(`${ship}+${pay}: server ha registrato metodi`, r.apiBody.shippingMethod === ship && r.apiBody.paymentMethod === pay, JSON.stringify(r.apiBody));
          check(`${ship}+${pay}: conferma con totale server`, r.okText.includes(normSpaces(euro(r.apiBody.total))));
        }
        if (pay === 'cod') check(`${ship}+cod: nessun supplemento contrassegno`, /in contanti/.test(r.okText) && r.okText.includes(normSpaces(euro(exp))), r.okText);
        placed.push(r.orderId);
      });
    }
  }
  await step('storico ordini', async () => {
    await page.locator('#orders-btn').click();
    await page.locator('#dlg-orders[open]').waitFor();
    const ids = await page.locator('#orders-body .oc-id').allTextContents();
    check('9 ordini nello storico, il più recente in cima', ids.length === 9 && ids[0] === placed[placed.length - 1], ids.join(','));
    await reload(page);
    await page.locator('#orders-btn').click();
    check('storico persiste dopo il ricaricamento', (await page.locator('#orders-body .oc-id').count()) === 9);
    await closeAllDialogs(page);
    if (env.mode === 'server') {
      const st = await (await fetch(env.base + '/api/order-status', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ orderId: placed[0], email: ADDRESS['f-email'] }) })).json();
      check('stato ordine dal server con email', st.orderId === placed[0] && Array.isArray(st.items), JSON.stringify(st));
    }
  });
  await step('contrassegno oltre 500 € disattivato', async () => {
    const priciest = PRODUCTS.slice().sort((a, b) => b.price - a.price)[0];
    await seedCart(page, [{ id: priciest.id, qty: 20 }]);
    await page.locator('#cart-btn').click();
    await page.locator('#go-checkout').click();
    check('radio contrassegno disabilitato sopra 500 €', await page.locator('input[name="pay"][value="cod"]').isDisabled());
    await closeAllDialogs(page);
    await clearCart(page);
  });
  check('nessun errore in console/pagina', errors.length === 0, errors.join(' || '));
  await ctx.close();
}

/* =====================================================================
   Assistente IA
   ===================================================================== */
async function suiteAssistant(browser, env) {
  currentSuite = `${env.mode} assistente IA`;
  const { ctx, page, errors } = await newPage(browser, env);
  const ask = async (text) => {
    const before = await page.locator('#ai-msgs .msg.bot').count();
    await page.fill('#ai-input', text);
    await page.keyboard.press('Enter');
    await page.waitForFunction((b) => document.querySelectorAll('#ai-msgs .msg.bot:not(.typing)').length > b, before, { timeout: 30000 });
    return (await page.locator('#ai-msgs .msg.bot:not(.typing)').last().textContent()) || '';
  };
  await step('chat', async () => {
    await page.locator('#ai-fab').click();
    await page.locator('#ai-panel:not([hidden])').waitFor();
    check('saluto dichiara IA', /intelligenza artificiale/i.test(await page.locator('#ai-msgs .msg.bot').first().textContent()));
    const ship = await ask('Quanto costa la spedizione?');
    check('risposta spedizioni in italiano (4,90 / 49 €)', /spedizion/i.test(ship) && /4,90/.test(ship) && /49/.test(ship), ship);
    check('risposta spedizioni cita express 9,90 e Animol Point 2,90', /9,90/.test(ship) && /2,90/.test(ship), ship);
    const prod = await ask('Cerco crocchette per gatto');
    const minis = page.locator('#ai-msgs .ai-products .mini').last();
    check('propone schede prodotto', (await page.locator('#ai-msgs .ai-products .mini').count()) > 0, prod);
    const before = await cartCount(page);
    await minis.locator('[data-act="add"]').click();
    check('pulsante Aggiungi della chat aggiunge al carrello', (await cartCount(page)) === before + 1);
    const vet = await ask('Il mio cane vomita da ieri, che farmaco gli posso dare?');
    check('domanda veterinaria rifiutata con rimando al veterinario', /veterinari/i.test(vet) && !/ti consiglio il farmaco/i.test(vet), vet);
    const coupons = await ask('Avete codici sconto?');
    check('coupon ANIMOL10 e CUCCIOLO5 nella risposta', /ANIMOL10/.test(coupons) && /CUCCIOLO5/.test(coupons), coupons);
    await page.keyboard.press('Escape');
  });
  check('nessun errore in console/pagina', errors.length === 0, errors.join(' || '));
  await ctx.close();
}

/* =====================================================================
   Animol Plus: attivazione demo, live, marketplace, checkout coerente, disdetta
   ===================================================================== */
async function suitePlus(browser, env) {
  currentSuite = `${env.mode} Animol Plus`;
  const { ctx, page, errors } = await newPage(browser, env);
  const email = `plus.${env.mode}.${Date.now()}@example.it`;
  await step('marketplace bloccato senza Plus', async () => {
    await page.locator('#market-new').click();
    check('marketplace riservato ai membri', /Riservato ai membri Plus/.test(await page.locator('#gen-title').textContent()));
    await closeAllDialogs(page);
    await page.locator('#plus').scrollIntoViewIfNeeded();
    await page.locator('#live-list [data-live-unlock]').first().waitFor({ timeout: 8000 });
    check('live bloccate senza Plus', (await page.locator('#live-list [data-live-unlock]').count()) > 0);
  });
  await step('attivazione demo', async () => {
    await page.locator('#plus').scrollIntoViewIfNeeded();
    await page.locator('#plus-subscribe').click();
    await page.locator('#plus-email').waitFor();
    await page.fill('#plus-email', 'non-una-email');
    await page.locator('#gen-foot button.btn-plus').click();
    check('email non valida rifiutata', !(await page.locator('#plus-err').isHidden()));
    await page.fill('#plus-email', email);
    const reqP = env.mode === 'server' ? page.waitForRequest((r) => r.url().endsWith('/api/plus/subscribe')) : null;
    await page.locator('#gen-foot button.btn-plus').click();
    if (reqP) { const body = (await reqP).postDataJSON(); check('subscribe invia piano ed email', body.email === email && ['monthly', 'yearly'].includes(body.plan), JSON.stringify(body)); }
    await page.locator('#pricing .plus-status').waitFor();
    check('area Plus attiva', /Animol Plus è attivo/.test(await page.locator('#pricing').textContent()));
    check('nessun redirect fuori dalla pagina', new URL(page.url()).pathname === '/');
    const stored = await ls(page, 'al_plus');
    check('email Plus salvata', stored.email === email, JSON.stringify(stored));
    check('live sbloccate', (await page.locator('#live-list [data-live-unlock]').count()) === 0);
  });
  await step('live Plus', async () => {
    const join = page.locator('#live-list [data-live-join]').first();
    if (await join.count()) {
      await join.click();
      await page.locator('#dlg-live[open]').waitFor();
      check('stanza live aperta', true);
      await closeAllDialogs(page);
    } else {
      check('elenco live (server: solo prossime dirette con promemoria)', (await page.locator('#live-list [data-live-remind]').count()) > 0);
    }
  });
  await step('marketplace con Plus', async () => {
    await page.locator('#market-new').click();
    await page.fill('#mk-title', 'Antiparassitario pipetta cane');
    const minDate = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
    await page.fill('#mk-exp', minDate);
    await page.fill('#mk-city', 'Torino');
    await page.fill('#mk-name', 'Luca');
    for (const id of ['mk-r1', 'mk-r2', 'mk-r3']) await page.locator('#' + id).check();
    await page.locator('#gen-foot button.btn-plus').click();
    check('farmaci/antiparassitari vietati', /non consentito/i.test(await page.locator('#mk-err').textContent()));
    const soon = new Date(Date.now() + 5 * 864e5).toISOString().slice(0, 10);
    await page.fill('#mk-title', 'Crocchette gatto 2 kg');
    await page.fill('#mk-exp', soon);
    await page.locator('#gen-foot button.btn-plus').click();
    check('scadenza < 30 giorni rifiutata', /30 giorni/.test(await page.locator('#mk-err').textContent()));
    await page.fill('#mk-exp', minDate);
    await page.locator('#mk-r1').uncheck();
    await page.locator('#gen-foot button.btn-plus').click();
    check('regole obbligatorie', /regole/.test(await page.locator('#mk-err').textContent()));
    await page.locator('#mk-r1').check();
    await page.locator('#gen-foot button.btn-plus').click();
    check('annuncio valido pubblicato', /Crocchette gatto 2 kg/.test(await page.locator('#market-list').textContent()));
  });
  await step('checkout Plus coerente con il server', async () => {
    const lines = [{ id: BY_ID['piccoli-fieno-montagna-1kg'] ? 'piccoli-fieno-montagna-1kg' : PRODUCTS.find((p) => !p.variants.length).id, variant: null, qty: 1 }];
    await seedCart(page, lines);
    await page.locator('#cart-btn').click();
    await page.locator('#go-checkout').click();
    check('email Plus precompilata al checkout', (await page.inputValue('#f-email')) === email);
    await closeAllDialogs(page);
    for (const ship of ['standard', 'express']) {
      await seedCart(page, lines);
      const r = await placeOrder(page, { ship, pay: 'card', email, expectServer: env.mode === 'server' });
      const exp = expectedTotal(lines, { plus: true, ship });
      check(`Plus ${ship}: totale pagina = riferimento (−5%, ${ship === 'express' ? '9,90 €' : 'spedizione gratis'})`, r.shownTotal === normSpaces(euro(exp)), `${r.shownTotal} vs ${euro(exp)}`);
      if (env.mode === 'server') {
        check(`Plus ${ship}: server riconosce il membro`, r.apiBody.plusApplied === true, JSON.stringify(r.apiBody));
        check(`Plus ${ship}: totale server = totale pagina`, r.apiBody.total === exp, `${r.apiBody.total} vs ${exp}`);
        check(`Plus ${ship}: nessuna nota di ricalcolo`, !/ricalcolato/.test(r.okText), r.okText);
      }
    }
  });
  await step('disdetta', async () => {
    await page.locator('#plus-cancel').click();
    const reqP = env.mode === 'server' ? page.waitForRequest((r) => r.url().endsWith('/api/plus/cancel')) : null;
    const respP = env.mode === 'server' ? page.waitForResponse((r) => r.url().endsWith('/api/plus/cancel')) : null;
    await page.locator('#gen-foot button', { hasText: 'Conferma disdetta' }).click();
    if (reqP) {
      const body = (await reqP).postDataJSON();
      check('cancel invia {email}', body.email === email, JSON.stringify(body));
      const resp = await respP;
      check('server accetta la disdetta (202, canceled)', resp.status() === 202 && (await resp.json()).canceled === true, resp.status());
    }
    await page.locator('#plus-subscribe').waitFor();
    check('Plus disattivato sulla pagina', (await ls(page, 'al_plus')) === null);
    if (env.mode === 'server') {
      const res = await fetch(env.base + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer: { name: 'Mario Rossi', email, address: 'Via Roma 1', city: 'Milano', cap: '20121' }, items: [{ id: PRODUCTS.find((p) => !p.variants.length).id, qty: 1 }] }) });
      check('dopo la disdetta il server non applica più Plus', (await res.json()).plusApplied === false);
    }
  });
  await step('ritorno da Stripe Checkout', async () => {
    await page.evaluate((e) => localStorage.setItem('al_plus_pending', JSON.stringify({ plan: 'monthly', email: e, at: Date.now() })), email);
    await page.goto(env.base + '/plus/?checkout=success&session_id=cs_test_e2e');
    await page.locator('#pricing .plus-status').waitFor();
    const u = new URL(page.url());
    check('/plus/?checkout=success riporta a /#plus e attiva Plus', u.pathname === '/' && u.search === '' && u.hash === '#plus', page.url());
    const st = await ls(page, 'al_plus');
    check('Plus attivato con l\'email in sospeso', st && st.email === email && st.plan === 'monthly' && (await ls(page, 'al_plus_pending')) === null, JSON.stringify(st));
  });
  check('nessun errore in console/pagina', errors.length === 0, errors.join(' || '));
  await ctx.close();
}

/* =====================================================================
   Cookie, link legali, tastiera, contenuti
   ===================================================================== */
async function suiteCompliance(browser, env) {
  currentSuite = `${env.mode} cookie/legale/tastiera`;
  const { ctx, page, errors } = await newPage(browser, { ...env, consent: false });
  await step('cookie banner', async () => {
    check('banner visibile al primo accesso', await page.locator('#cookie-banner').isVisible());
    const st = await page.evaluate(() => ({ ls: Object.keys(localStorage).filter((k) => k !== '__e2e_init'), ss: Object.keys(sessionStorage).filter((k) => k !== '__e2e_init'), cookie: document.cookie }));
    check('nessun cookie né storage prima del consenso', st.ls.length === 0 && st.ss.length === 0 && st.cookie === '', JSON.stringify(st));
    await page.locator('#cookie-banner [data-cookie="reject"]').click();
    check('dopo "Rifiuta" il banner sparisce', await page.locator('#cookie-banner').isHidden());
    const c = await page.evaluate(() => JSON.parse(localStorage.getItem('al_consent')));
    check('scelta salvata senza consensi facoltativi', c && !c.preferences && !c.analytics && !c.marketing, JSON.stringify(c));
    await reload(page);
    check('banner non riproposto', await page.locator('#cookie-banner').isHidden());
    check('nessun cookie dopo il rifiuto', (await ctx.cookies()).length === 0);
    await page.locator('[data-open-cookies]').first().click();
    check('preferenze cookie riapribili dal footer', await page.locator('#dlg-cookies').evaluate((d) => d.open));
    await closeAllDialogs(page);
  });
  await step('link legali', async () => {
    const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.href).filter((h) => h.startsWith(location.origin) && !h.includes('#')))]);
    const legal = hrefs.filter((h) => /legal\//.test(h));
    check('footer con almeno 7 pagine legali', legal.length >= 7, legal.join(','));
    const bad = [];
    const seen = new Set();
    for (const h of hrefs) {
      seen.add(h);
      const r = await page.request.get(h);
      if (r.status() !== 200) bad.push(`${r.status()} ${h}`);
      if (/legal\/.*\.html$/.test(h)) {
        const html = await r.text();
        for (const m of html.matchAll(/href="([^"#]+)(#[^"]*)?"/g)) {
          if (/^(https?:|mailto:|tel:)/.test(m[1])) continue;
          const u = new URL(m[1], h).href;
          if (seen.has(u)) continue;
          seen.add(u);
          const r2 = await page.request.get(u);
          if (r2.status() !== 200) bad.push(`${r2.status()} ${u} (da ${h})`);
        }
      }
    }
    check(`tutti i link interni rispondono 200 (${seen.size} verificati)`, bad.length === 0, bad.join(' | '));
    const plusRedirect = await page.request.get(env.base + '/plus/');
    check('/plus/ risponde 200', plusRedirect.status() === 200);
  });
  await step('tastiera', async () => {
    await page.goto(env.base + '/');
    await waitGrid(page);
    await page.keyboard.press('Tab');
    const first = await page.evaluate(() => ({ cls: document.activeElement.className, text: document.activeElement.textContent }));
    check('primo Tab: link "Vai al contenuto principale"', /skip-link/.test(first.cls), JSON.stringify(first));
    await page.keyboard.press('Enter');
    check('skip link porta a #main', page.url().endsWith('#main'));
    const btn = page.locator('#grid .card .card-title button').first();
    await btn.focus();
    await page.keyboard.press('Enter');
    await page.locator('#dlg-product[open]').waitFor();
    check('Invio apre la scheda prodotto', true);
    await page.keyboard.press('Tab');
    check('focus resta dentro il dialog', await page.evaluate(() => !!document.activeElement.closest('#dlg-product')));
    await page.keyboard.press('Escape');
    check('Esc chiude il dialog', !(await page.locator('#dlg-product').evaluate((d) => d.open)));
    const focusVisible = await page.evaluate(() => { const b = document.querySelector('#cart-btn'); b.focus(); const s = getComputedStyle(b); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; });
    check('indicatore di focus visibile', focusVisible);
  });
  await step('contenuti veritieri', async () => {
    const text = await page.evaluate(() => document.documentElement.outerHTML);
    check('nessuna dichiarazione "recensioni verificate su ordini reali"', !/corrisponda a un ordine reale/i.test(text));
    check('nessun aggregateRating fittizio nei dati strutturati', !/aggregateRating/.test(text));
    check('nessun "n.1" / "il migliore"', !/\bn\.\s?1\b|numero 1|il miglior[ei]? /i.test(text.replace(/<script[\s\S]*?<\/script>/g, '')));
  });
  check('nessun errore in console/pagina', errors.length === 0, errors.join(' || '));
  await ctx.close();
}

/* =====================================================================
   API e webhook vocali (solo server)
   ===================================================================== */
async function suiteApi() {
  currentSuite = 'server API';
  await step('health', async () => {
    const h = await (await fetch(SERVER_URL + '/api/health')).json();
    check('GET /api/health: 24 prodotti da products.json', h.catalog.count === 24 && h.catalog.source === 'products.json', JSON.stringify(h.catalog));
  });
  await step('voice', async () => {
    const r = await fetch(SERVER_URL + '/voice/incoming', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CAe2e&From=%2B393331234567&Direction=inbound' });
    const xml = await r.text();
    check('/voice/incoming: TwiML valido', r.status === 200 && /xml/.test(r.headers.get('content-type')) && /^<\?xml[^>]*\?><Response>[\s\S]*<\/Response>$/.test(xml.trim()), xml.slice(0, 200));
    check('/voice/incoming: it-IT e annuncio IA', /language="it-IT"/.test(xml) && /intelligenza artificiale/.test(xml));
    const r2 = await fetch(SERVER_URL + '/voice/respond?step=consent', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: 'CallSid=CAe2e&SpeechResult=s%C3%AC&Direction=inbound' });
    const x2 = await r2.text();
    check('/voice/respond: TwiML in it-IT', r2.status === 200 && /<Response>/.test(x2) && /it-IT/.test(x2), x2.slice(0, 200));
  });
  await step('ordini API', async () => {
    const bad = await fetch(SERVER_URL + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer: { name: 'Mario Rossi', email: 'a@example.it', address: 'Via Roma 1', city: 'Milano', cap: '20121' }, items: [{ id: PRODUCTS[0].id, qty: 1 }], shippingMethod: 'drone' }) });
    check('shippingMethod non valido -> 400', bad.status === 400);
    const cap = await fetch(SERVER_URL + '/api/orders', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ customer: { name: 'Mario Rossi', email: 'a@example.it', address: 'Via Roma 1', city: 'Milano', cap: '2012' }, items: [{ id: PRODUCTS[0].id, qty: 1 }] }) });
    check('CAP non valido -> 400 anche lato server', cap.status === 400);
  });
}

/* ===================================================================== */
(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'animol-e2e-'));
  const server = startProc(process.execPath, ['src/index.js'], { cwd: SERVER_DIR, env: { ...process.env, PORT: String(PORT), DATA_DIR: dataDir, NODE_ENV: 'development', ANTHROPIC_API_KEY: '', STRIPE_SECRET_KEY: '', TWILIO_AUTH_TOKEN: '', RATE_LIMIT_ORDERS: '1000', RATE_LIMIT_FORMS: '1000', RATE_LIMIT_ASSISTANT: '1000', RATE_LIMIT_GENERAL: '10000' } });
  const stat = startProc('python3', ['-m', 'http.server', String(STATIC_PORT), '--bind', '127.0.0.1'], { cwd: PUBLIC });
  let browser;
  try {
    await waitFor(SERVER_URL + '/api/health');
    await waitFor(`http://127.0.0.1:${STATIC_PORT}/`);
    browser = await chromium.launch();
    await suiteApi();
    const origins = [{ base: SERVER_URL, mode: 'server' }, { base: STATIC_URL.replace('localhost', '127.0.0.1'), mode: 'static' }];
    const ONLY = process.env.E2E_ONLY || ''; // es. E2E_ONLY=basics,plus
    const want = (n) => !ONLY || ONLY.split(',').includes(n);
    for (const o of origins) {
      if (process.env.E2E_MODE && process.env.E2E_MODE !== o.mode) continue;
      if (want('basics')) for (const width of [1440, 390]) for (const scheme of ['light', 'dark']) await suiteBasics(browser, { ...o, width, scheme });
      if (want('checkout')) await suiteCheckoutMatrix(browser, { ...o, width: 1440, scheme: 'light' });
      if (want('assistant')) await suiteAssistant(browser, { ...o, width: 390, scheme: 'dark' });
      if (want('plus')) await suitePlus(browser, { ...o, width: 1440, scheme: 'light' });
      if (want('compliance')) await suiteCompliance(browser, { ...o, width: 1440, scheme: 'dark' });
    }
  } catch (err) {
    check('esecuzione', false, err.stack);
    console.error(server.getLog());
  } finally {
    if (browser) await browser.close();
    stopAll();
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} verifiche superate`);
  if (failed.length) {
    console.log('Fallite:');
    for (const f of failed) console.log(` - [${f.suite}] ${f.name}: ${f.detail}`);
  }
  if (/\[server\][\s\S]*Error/.test(server.getLog())) console.log('\nErrori nel log del server:\n' + server.getLog());
  process.exit(failed.length ? 1 : 0);
})();
