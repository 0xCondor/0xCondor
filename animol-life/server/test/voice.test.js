import { test, describe, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { startTestServer, CUSTOMER } from './helpers.js';
import { twilioSignature } from '../src/voice.js';

const servers = [];
after(async () => { await Promise.all(servers.map((s) => s.close())); });

async function server(opts) {
  const s = await startTestServer(opts);
  servers.push(s);
  return s;
}

describe('agente vocale Twilio (senza firma)', () => {
  test('incoming: annuncio IA, consenso e Gather in italiano', async () => {
    const t = await server();
    const res = await t.postForm('/voice/incoming', { CallSid: 'CA1', From: '+390000000' });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /xml/);
    const xml = await res.text();
    assert.match(xml, /^<\?xml/);
    assert.match(xml, /<Gather input="speech" language="it-IT"[^>]*action="\/voice\/respond\?step=consent"/);
    assert.match(xml, /<Say language="it-IT">/);
    assert.match(xml, /intelligenza artificiale/);
    assert.match(xml, /consenso/);
    assert.match(xml, /operatore/);
  });

  test('conversazione: consenso, domande, stato ordine, saluto', async () => {
    const t = await server();
    const order = await (await t.post('/api/orders', { customer: CUSTOMER, items: [{ id: 'fieno-coniglio-1kg', qty: 1 }], paymentMethod: 'cod' })).json();
    await t.postForm('/voice/incoming', { CallSid: 'CA2' });

    let xml = await (await t.postForm('/voice/respond?step=consent', { CallSid: 'CA2', SpeechResult: 'Sì' })).text();
    assert.match(xml, /conserveremo la trascrizione/);
    assert.match(xml, /<Gather input="speech" language="it-IT"/);

    xml = await (await t.postForm('/voice/respond?step=chat', { CallSid: 'CA2', SpeechResult: 'Quanto costa la spedizione?' })).text();
    assert.match(xml, /49/);
    assert.doesNotMatch(xml, /€/, 'il simbolo euro viene letto a parole');

    const spoken = order.orderId.split('').join(' ').replace(/-/g, ' ');
    xml = await (await t.postForm('/voice/respond?step=chat', { CallSid: 'CA2', SpeechResult: `Il mio ordine è ${spoken}` })).text();
    assert.match(xml, new RegExp(order.orderId));
    assert.match(xml, /ricevuto/);

    xml = await (await t.postForm('/voice/respond?step=chat', { CallSid: 'CA2', SpeechResult: 'Arrivederci' })).text();
    assert.match(xml, /<Hangup\/>/);

    const transcript = await fs.readFile(path.join(t.dataDir, 'call-transcripts.jsonl'), 'utf8');
    assert.ok(transcript.includes('spedizione'));
    assert.ok(!transcript.includes('CA2'), 'CallSid non salvato in chiaro');
  });

  test('senza consenso non salva nulla', async () => {
    const t = await server();
    await t.postForm('/voice/incoming', { CallSid: 'CA3' });
    const xml = await (await t.postForm('/voice/respond?step=consent', { CallSid: 'CA3', SpeechResult: 'No' })).text();
    assert.match(xml, /non conserveremo/);
    await t.postForm('/voice/respond?step=chat', { CallSid: 'CA3', SpeechResult: 'come faccio un reso' });
    await assert.rejects(fs.access(path.join(t.dataDir, 'call-transcripts.jsonl')));
  });

  test('silenzio: richiede di nuovo, poi chiude', async () => {
    const t = await server();
    await t.postForm('/voice/incoming', { CallSid: 'CA4' });
    let xml = await (await t.postForm('/voice/respond?step=chat&noinput=1', { CallSid: 'CA4' })).text();
    assert.match(xml, /non ho sentito/);
    xml = await (await t.postForm('/voice/respond?step=chat&noinput=1', { CallSid: 'CA4' })).text();
    assert.match(xml, /<Hangup\/>/);
  });

  test('operatore senza numero configurato: informa e continua', async () => {
    const t = await server();
    const xml = await (await t.postForm('/voice/respond?step=chat', { CallSid: 'CA5', SpeechResult: 'Voglio parlare con un operatore' })).text();
    assert.doesNotMatch(xml, /<Dial/);
    assert.match(xml, /lunedì al venerdì/);
  });
});

describe('agente vocale Twilio (con firma e trasferimento)', () => {
  test('firma obbligatoria quando TWILIO_AUTH_TOKEN è impostato; Dial verso operatore', async () => {
    const token = 'test-auth-token';
    const t = await server({ env: { TWILIO_AUTH_TOKEN: token, HUMAN_PHONE_NUMBER: '+390212345678', PUBLIC_BASE_URL: 'https://shop.example.it' } });

    const params = { CallSid: 'CA9', SpeechResult: 'Passami un operatore per favore' };
    assert.equal((await t.postForm('/voice/respond?step=chat', params)).status, 403);
    assert.equal((await t.postForm('/voice/respond?step=chat', params, { 'X-Twilio-Signature': 'sbagliata' })).status, 403);

    const sig = twilioSignature(token, 'https://shop.example.it/voice/respond?step=chat', params);
    const res = await t.postForm('/voice/respond?step=chat', params, { 'X-Twilio-Signature': sig });
    assert.equal(res.status, 200);
    const xml = await res.text();
    assert.match(xml, /<Dial timeout="30">\+390212345678<\/Dial>/);

    const inParams = { CallSid: 'CA10' };
    const sig2 = twilioSignature(token, 'https://shop.example.it/voice/incoming', inParams);
    assert.equal((await t.postForm('/voice/incoming', inParams, { 'X-Twilio-Signature': sig2 })).status, 200);
  });

  test('twilioSignature corrisponde all\'esempio della documentazione Twilio', () => {
    // Esempio ufficiale Twilio ("Validating Signatures from Twilio").
    const sig = twilioSignature('12345', 'https://mycompany.com/myapp.php?foo=1&bar=2', {
      CallSid: 'CA1234567890ABCDE', Caller: '+12349013030', Digits: '1234', From: '+12349013030', To: '+18005551212',
    });
    assert.equal(sig, '0/KCTR6DLpKmkAf8muzZqo1nDgQ=');
  });
});

describe('agente vocale: requisiti legali', () => {
  test('rifiuta le chiamate in uscita (solo inbound)', async () => {
    const t = await server();
    const xml = await (await t.postForm('/voice/incoming', { CallSid: 'CO1', Direction: 'outbound-api' })).text();
    assert.match(xml, /<Reject/);
    assert.doesNotMatch(xml, /<Gather/);
    const ok = await (await t.postForm('/voice/incoming', { CallSid: 'CI1', Direction: 'inbound' })).text();
    assert.match(ok, /<Gather/);
  });

  test('non accetta dati di carta a voce e non li salva', async () => {
    const t = await server();
    await t.postForm('/voice/incoming', { CallSid: 'CC1' });
    await t.postForm('/voice/respond?step=consent', { CallSid: 'CC1', SpeechResult: 'sì' });
    const xml = await (await t.postForm('/voice/respond?step=chat', { CallSid: 'CC1', SpeechResult: 'il numero della carta è 4111 1111 1111 1111' })).text();
    assert.match(xml, /non posso ricevere i dati della carta/);
    const file = path.join(t.dataDir, 'call-transcripts.jsonl');
    const content = await fs.readFile(file, 'utf8').catch(() => '');
    assert.ok(!content.includes('4111'));
  });
});
