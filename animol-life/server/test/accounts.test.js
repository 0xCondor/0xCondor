import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, CUSTOMER, createAgent } from './helpers.js';
import { outbox } from '../src/email.js';
import { hashPassword, verifyPassword, parseCookies } from '../src/auth.js';

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

const PASSWORD = 'Passw0rd-Lunga!';

describe('password e cookie', () => {
  test('hash scrypt verificabile, salt diverso, formato atteso', async () => {
    const a = await hashPassword('una password qualsiasi', { cost: 1024 });
    const b = await hashPassword('una password qualsiasi', { cost: 1024 });
    assert.match(a, /^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    assert.notEqual(a, b);
    assert.equal(await verifyPassword('una password qualsiasi', a), true);
    assert.equal(await verifyPassword('una password sbagliata', a), false);
    assert.equal(await verifyPassword('x', 'plain-text'), false);
    assert.equal(await verifyPassword('x', 'scrypt$99999999$8$1$a$b'), false, 'parametri abnormi rifiutati');
  });

  test('parseCookies ignora valori malformati', () => {
    const c = parseCookies('a=1; b=%E0%A4%A; a=2; =x');
    assert.equal(c.a, '1');
    assert.equal(c.b, undefined);
  });
});

describe('registrazione, accesso, uscita', () => {
  test('registrazione: validazioni, cookie httpOnly SameSite=Lax, niente hash nelle risposte', async () => {
    const a = createAgent(t.base);
    const bad = [
      { email: 'reg@example.it', password: 'corta', name: 'Mario', privacy: true },
      { email: 'reg@example.it', password: 'password123', name: 'Mario', privacy: true },
      { email: 'reg@example.it', password: 'reg@example.it', name: 'Mario', privacy: true },
      { email: 'non-email', password: PASSWORD, name: 'Mario', privacy: true },
      { email: 'reg@example.it', password: PASSWORD, name: 'Mario' },
      { email: 'reg@example.it', password: 'x'.repeat(129), name: 'Mario', privacy: true },
    ];
    for (const b of bad) assert.equal((await a.post('/api/auth/register', b)).status, 400, JSON.stringify(b).slice(0, 80));
    const res = await a.post('/api/auth/register', { email: 'Reg@Example.it', password: PASSWORD, name: 'Mario Rossi', privacy: true });
    assert.equal(res.status, 201);
    const cookie = res.headers.getSetCookie().find((c) => c.startsWith('al_sid='));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    assert.match(cookie, /Path=\//);
    const body = await res.json();
    assert.equal(body.user.email, 'reg@example.it');
    assert.equal(body.user.emailVerified, false);
    assert.equal(JSON.stringify(body).includes('scrypt'), false);
    assert.ok(body.csrfToken.length >= 20);
    assert.ok(outbox.some((m) => m.tag === 'account-verify' && m.to === 'reg@example.it'));
    // email già registrata (anche con maiuscole diverse)
    assert.equal((await createAgent(t.base).post('/api/auth/register', { email: 'REG@example.it', password: PASSWORD, name: 'Altro', privacy: true })).status, 400);
  });

  test('verifica email con link monouso', async () => {
    const mail = outbox.findLast((m) => m.tag === 'account-verify' && m.to === 'reg@example.it');
    const link = new URL(mail.text.match(/https?:\/\/\S+/)[0]);
    const r1 = await fetch(t.base + link.pathname + link.search, { redirect: 'manual' });
    assert.equal(r1.status, 303);
    assert.match(r1.headers.get('location'), /account=verificato/);
    const r2 = await fetch(t.base + link.pathname + link.search, { redirect: 'manual' });
    assert.match(r2.headers.get('location'), /link-non-valido/);
  });

  test('login, me, logout; password errata con messaggio generico', async () => {
    const a = createAgent(t.base);
    const anon = await (await a.get('/api/auth/me')).json();
    assert.equal(anon.user, null);
    const wrong = await a.post('/api/auth/login', { email: 'reg@example.it', password: 'sbagliata-davvero' });
    assert.equal(wrong.status, 401);
    const unknown = await a.post('/api/auth/login', { email: 'nessuno@example.it', password: 'sbagliata-davvero' });
    assert.equal(unknown.status, 401);
    assert.equal((await wrong.json()).message, (await unknown.json()).message, 'nessuna enumerazione degli account');
    const ok = await a.post('/api/auth/login', { email: 'reg@example.it', password: PASSWORD });
    assert.equal(ok.status, 200);
    const me = await (await a.get('/api/auth/me')).json();
    assert.equal(me.user.email, 'reg@example.it');
    assert.equal(me.user.emailVerified, true);
    assert.equal((await a.post('/api/auth/logout', {})).status, 200);
    assert.equal((await (await a.get('/api/auth/me')).json()).user, null);
  });

  test('ogni login crea un nuovo id di sessione e il logout invalida il vecchio cookie', async () => {
    const a = createAgent(t.base);
    await a.post('/api/auth/login', { email: 'reg@example.it', password: PASSWORD });
    const first = a.jar.get('al_sid');
    await a.post('/api/auth/login', { email: 'reg@example.it', password: PASSWORD });
    assert.notEqual(a.jar.get('al_sid'), first);
    const stale = await fetch(t.base + '/api/auth/me', { headers: { cookie: `al_sid=${first}` } });
    assert.equal((await stale.json()).user, null);
  });

  test('blocco dopo 5 tentativi falliti per la stessa email (anche con la password giusta)', async () => {
    await t.registerUser('lock@example.it');
    const a = createAgent(t.base);
    for (let i = 0; i < 5; i += 1) assert.equal((await a.post('/api/auth/login', { email: 'lock@example.it', password: `errata-${i}-xxxxx` })).status, 401);
    const locked = await a.post('/api/auth/login', { email: 'lock@example.it', password: PASSWORD });
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get('retry-after')) > 0);
  });

  test('rate limit per IP sugli endpoint di accesso', async () => {
    const s = await startTestServer({ env: { RATE_LIMIT_AUTH: '3' } });
    try {
      const codes = [];
      for (let i = 0; i < 5; i += 1) codes.push((await s.post('/api/auth/login', { email: `x${i}@example.it`, password: 'qualcosa-di-lungo' })).status);
      assert.deepEqual(codes.slice(0, 3), [401, 401, 401]);
      assert.equal(codes[4], 429);
    } finally { await s.close(); }
  });
});

describe('CSRF e origine', () => {
  test('con sessione: POST senza X-CSRF-Token -> 403; con token -> ok', async () => {
    const a = await t.registerUser('csrf@example.it');
    const noToken = await a.post('/api/account/profile', { name: 'Nuovo Nome' }, { 'x-csrf-token': '' });
    assert.equal(noToken.status, 403);
    assert.equal((await noToken.json()).error, 'csrf');
    const ok = await a.post('/api/account/profile', { name: 'Nuovo Nome' });
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).user.name, 'Nuovo Nome');
  });

  test('Origin di un altro sito o Sec-Fetch-Site cross-site -> 403 (anche sul login)', async () => {
    const evil = await t.post('/api/auth/login', { email: 'reg@example.it', password: PASSWORD }, { origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
    const cross = await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }] }, { 'sec-fetch-site': 'cross-site' });
    assert.equal(cross.status, 403);
    const same = await t.post('/api/auth/login', { email: 'reg@example.it', password: PASSWORD }, { origin: t.base });
    assert.equal(same.status, 200);
  });
});

describe('reimpostazione password', () => {
  test('risposta identica per email esistenti e non; token monouso; vecchie sessioni chiuse', async () => {
    const victim = await t.registerUser('reset@example.it');
    const r1 = await t.post('/api/auth/forgot', { email: 'reset@example.it' });
    const r2 = await t.post('/api/auth/forgot', { email: 'sconosciuto@example.it' });
    assert.equal(r1.status, 202);
    assert.deepEqual(await r1.json(), await r2.json());
    const mail = outbox.findLast((m) => m.tag === 'password-reset' && m.to === 'reset@example.it');
    const token = mail.text.match(/#reset=([\w-]+)/)[1];
    assert.equal((await t.post('/api/auth/reset', { token, password: 'corta' })).status, 400);
    const res = await t.post('/api/auth/reset', { token: 'x'.repeat(43), password: 'Nuova-Password-Sicura-1' });
    assert.equal(res.status, 400);
    const token2 = token; // la password troppo corta non ha consumato il token
    const ok = await t.post('/api/auth/reset', { token: token2, password: 'Nuova-Password-Sicura-1' });
    assert.equal(ok.status, 200);
    assert.equal((await t.post('/api/auth/reset', { token: token2, password: 'Altra-Password-Sicura-2' })).status, 400, 'monouso');
    assert.equal((await (await victim.get('/api/auth/me')).json()).user, null, 'sessioni precedenti invalidate');
    assert.equal((await createAgent(t.base).post('/api/auth/login', { email: 'reset@example.it', password: 'Nuova-Password-Sicura-1' })).status, 200);
  });

  test('cambio password dall\'area personale richiede la password attuale', async () => {
    const a = await t.registerUser('change@example.it');
    assert.equal((await a.post('/api/account/password', { currentPassword: 'sbagliata', newPassword: 'Nuova-Password-Sicura-1' })).status, 400);
    assert.equal((await a.post('/api/account/password', { currentPassword: PASSWORD, newPassword: 'Nuova-Password-Sicura-1' })).status, 200);
    assert.equal((await (await a.get('/api/auth/me')).json()).user.email, 'change@example.it', 'resta connesso con una sessione nuova');
  });
});

describe('ordini dell\'account e IDOR', () => {
  let alice;
  let bob;
  let aliceOrder;
  before(async () => {
    alice = await t.registerUser('alice@example.it');
    bob = await t.registerUser('bob@example.it');
    const res = await alice.post('/api/orders', { customer: { ...CUSTOMER, email: 'alice@example.it' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], paymentMethod: 'cod' });
    aliceOrder = (await res.json()).orderId;
    await t.post('/api/orders', { customer: { ...CUSTOMER, email: 'alice@example.it' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], paymentMethod: 'cod' }); // da ospite
  });

  test('I miei ordini: solo gli ordini dell\'account (non quelli da ospite con la stessa email)', async () => {
    const list = (await (await alice.get('/api/account/orders')).json()).orders;
    assert.deepEqual(list.map((o) => o.orderId), [aliceOrder]);
    assert.equal(list[0].paymentStatus, 'cod');
    assert.equal(list[0].customer, undefined, 'la lista non espone l\'indirizzo');
    const detail = await (await alice.get(`/api/account/orders/${aliceOrder}`)).json();
    assert.equal(detail.order.customer.cap, CUSTOMER.cap);
    assert.equal((await (await bob.get('/api/account/orders')).json()).orders.length, 0);
  });

  test('un altro utente non vede, né paga l\'ordine altrui (404 come se non esistesse)', async () => {
    assert.equal((await bob.get(`/api/account/orders/${aliceOrder}`)).status, 404);
    assert.equal((await bob.get('/api/account/orders/AL-2026-ZZZZZZ')).status, 404);
    assert.equal((await bob.post(`/api/account/orders/${aliceOrder}/pay`, {})).status, 404);
    assert.equal((await t.get(`/api/account/orders/${aliceOrder}`)).status, 401, 'senza accesso');
    assert.equal((await t.get('/api/account/orders')).status, 401);
  });

  test('stato ordine pubblico: senza email nessun dato personale', async () => {
    const pub = await (await t.post('/api/order-status', { orderId: aliceOrder })).json();
    assert.equal(pub.items, undefined);
    assert.equal(pub.customer, undefined);
  });
});

describe('GDPR: esportazione e cancellazione', () => {
  test('export JSON scaricabile con i soli dati dell\'utente', async () => {
    const a = await t.registerUser('gdpr@example.it');
    await a.post('/api/plus/subscribe', { plan: 'monthly' });
    await a.post('/api/orders', { customer: { ...CUSTOMER, email: 'gdpr@example.it' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], paymentMethod: 'cod' });
    const res = await a.get('/api/account/export');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /attachment; filename="animol-life-dati-/);
    const data = await res.json();
    assert.equal(data.account.email, 'gdpr@example.it');
    assert.equal(data.orders.length, 1);
    assert.equal(data.plus.status, 'trialing');
    assert.equal(JSON.stringify(data).includes('scrypt'), false);
    assert.equal(JSON.stringify(data).includes('alice@example.it'), false);
  });

  test('cancellazione: serve la password; poi accesso impossibile, ordini scollegati ma conservati', async () => {
    const a = await t.registerUser('bye@example.it');
    await t.post('/api/newsletter', { email: 'bye@example.it', consent: true });
    await a.post('/api/plus/subscribe', { plan: 'yearly' });
    const o = await (await a.post('/api/orders', { customer: { ...CUSTOMER, email: 'bye@example.it' }, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], paymentMethod: 'cod' })).json();
    assert.equal((await a.post('/api/account/delete', { password: 'sbagliata' })).status, 400);
    const res = await a.post('/api/account/delete', { password: PASSWORD });
    assert.equal(res.status, 200);
    assert.match((await res.json()).message, /obblighi fiscali/);
    assert.equal((await (await a.get('/api/auth/me')).json()).user, null);
    assert.equal((await createAgent(t.base).post('/api/auth/login', { email: 'bye@example.it', password: PASSWORD })).status, 401);
    const stored = t.app.locals.repo.orders.get(o.orderId);
    assert.equal(stored.userId, null);
    const plus = await t.app.locals.stores.plus.read();
    assert.equal(plus.members.some((m) => m.email === 'bye@example.it'), false);
    const nl = await t.app.locals.stores.newsletter.read();
    assert.equal(nl.some((m) => m.email === 'bye@example.it'), false);
    // l'email si può registrare di nuovo, senza ereditare nulla
    const again = await t.registerUser('bye@example.it');
    assert.equal((await (await again.get('/api/account/orders')).json()).orders.length, 0);
  });
});
