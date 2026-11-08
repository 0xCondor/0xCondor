// Verifica il ciclo tool-use di Claude con un client finto (nessuna chiamata di rete).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer } from './helpers.js';

function fakeClient(script) {
  const calls = [];
  return {
    calls,
    beta: {
      messages: {
        async create(params) {
          calls.push(structuredClone(params));
          const next = script.shift();
          if (next instanceof Error) throw next;
          return next;
        },
      },
    },
  };
}

const servers = [];
after(async () => { await Promise.all(servers.map((s) => s.close())); });

test('Claude: usa search_products e restituisce reply + products', async () => {
  const client = fakeClient([
    { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 'tu1', name: 'search_products', input: { query: 'lettiera', category: 'gatti' } }] },
    { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Sono un assistente IA. Ti consiglio la Lettiera Agglomerante a 8,90 €.' }] },
  ]);
  const t = await startTestServer({ env: { ANTHROPIC_API_KEY: 'sk-test-finta' }, anthropicClient: client });
  servers.push(t);
  const health = await (await t.get('/api/health')).json();
  assert.equal(health.integrations.ai, 'claude');

  const res = await t.post('/api/assistant', { messages: [{ role: 'user', content: 'Mi serve una lettiera' }], cart: [{ id: 'fieno-coniglio-1kg', qty: 1 }] });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.match(body.reply, /Lettiera/);
  assert.ok(body.products.includes('lettiera-agglomerante-10l'));

  const [first, second] = client.calls;
  assert.equal(first.model, 'claude-opus-5-5');
  assert.equal(first.fallbacks, 'default');
  assert.deepEqual(first.output_config, { effort: 'low' });
  assert.ok(first.tools.some((x) => x.name === 'get_order_status'));
  assert.match(first.system[0].text, /diagnosi/);
  assert.match(first.system[1].text, /Fieno/); // il carrello è nel contesto
  const toolResult = second.messages.at(-1).content[0];
  assert.equal(toolResult.type, 'tool_result');
  assert.equal(toolResult.tool_use_id, 'tu1');
  assert.match(toolResult.content, /lettiera-agglomerante-10l/);
});

test('Claude: in caso di errore API usa il fallback deterministico', async () => {
  const client = fakeClient([new Error('rete giù')]);
  const t = await startTestServer({ env: { ANTHROPIC_API_KEY: 'sk-test-finta' }, anthropicClient: client });
  servers.push(t);
  const orig = console.error;
  console.error = () => {};
  try {
    const body = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: 'Come funziona il reso?' }] })).json();
    assert.match(body.reply, /14 giorni/);
  } finally {
    console.error = orig;
  }
});

test('Claude: stop_reason refusal gestito', async () => {
  const client = fakeClient([{ stop_reason: 'refusal', content: [], stop_details: { type: 'refusal', category: null } }]);
  const t = await startTestServer({ env: { ANTHROPIC_API_KEY: 'sk-test-finta' }, anthropicClient: client });
  servers.push(t);
  const body = await (await t.post('/api/assistant', { messages: [{ role: 'user', content: 'boh' }] })).json();
  assert.match(body.reply, /non posso aiutarti/);
});
