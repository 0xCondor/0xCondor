// Generazione IA di descrizioni prodotto e post social dal catalogo.
// Con ANTHROPIC_API_KEY usa Claude (output JSON strutturato); senza chiave usa modelli di testo.
// I contenuti sono sempre BOZZE da revisionare prima della pubblicazione.
import fs from 'node:fs/promises';
import path from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import { effectivePrice, publicProduct } from '../src/catalog.js';
import { formatEuro } from '../src/policies.js';

const SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          instagram: { type: 'string' },
          facebook: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
        required: ['id', 'description', 'instagram', 'facebook', 'hashtags'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

const PROMPT = `Sei il copywriter di Animol Life, negozio online italiano per animali.
Per ogni prodotto JSON fornito scrivi in italiano:
- "description": descrizione per la scheda prodotto (60-110 parole), calda ma concreta, basata SOLO su nome, marca, specifiche e descrizione forniti;
- "instagram": post Instagram (max 300 caratteri) con una call to action;
- "facebook": post Facebook (max 500 caratteri);
- "hashtags": 4-6 hashtag pertinenti in italiano.
Vincoli: non inventare caratteristiche, certificazioni o benefici non presenti nei dati; nessuna indicazione sulla salute per alimenti e snack (Reg. CE 767/2009: un mangime non può dichiarare di prevenire, trattare o curare malattie) e nessuna promessa terapeutica; niente superlativi assoluti non verificabili ("il migliore"); se citi uno sconto indica che il prezzo più basso degli ultimi 30 giorni è disponibile in scheda. Mantieni l'id del prodotto invariato.`;

function templateContent(p) {
  const price = formatEuro(Math.round(effectivePrice(p) * 100));
  const specs = Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(', ');
  const animal = { cani: 'cane', gatti: 'gatto', uccelli: 'uccellino', pesci: 'acquario', piccoli: 'piccolo amico' }[p.category];
  return {
    id: p.id,
    description: `${p.name}${p.brand ? ` di ${p.brand}` : ''}. ${p.description}${specs ? ` Caratteristiche: ${specs}.` : ''} ` +
      `Disponibile su Animol Life a ${price}, con spedizione gratuita sopra i 49 € e 14 giorni per il recesso.`,
    instagram: `Novità per il tuo ${animal}: ${p.name} a ${price}. Scoprilo su Animol Life, link in bio!`,
    facebook: `${p.name}${p.brand ? ` di ${p.brand}` : ''}: ${p.description} Ora a ${price} su Animol Life. Spedizione gratuita da 49 €.`,
    hashtags: ['#animollife', `#${p.category}`, `#${animal.replace(/\s+/g, '')}`, '#petshop', '#animalidomestici'],
  };
}

export async function runAiContent({ cfg, catalog, log }, args = {}, { client } = {}) {
  const all = await catalog.all();
  const limit = Math.min(Number(args.limit) || 3, 20);
  const selected = args.id ? all.filter((p) => p.id === args.id) : [...all].sort((a, b) => b.sold - a.sold).slice(0, limit);
  if (!selected.length) {
    log('[ai-content] nessun prodotto selezionato');
    return { mode: 'none', items: [] };
  }
  const anthropic = client ?? (cfg.anthropicApiKey ? new Anthropic({ apiKey: cfg.anthropicApiKey }) : null);
  let items;
  let mode = 'template';
  if (anthropic) {
    try {
      const response = await anthropic.beta.messages.create({
        model: cfg.anthropicModel,
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
        system: PROMPT,
        messages: [{ role: 'user', content: JSON.stringify(selected.map(publicProduct)) }],
      });
      if (response.stop_reason === 'refusal') throw new Error('richiesta rifiutata dal modello');
      const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      const ids = new Set(selected.map((p) => p.id));
      items = JSON.parse(text).items.filter((i) => ids.has(i.id));
      mode = 'claude';
    } catch (err) {
      log(`[ai-content] Claude non disponibile (${err.message}): uso i modelli di testo`);
    }
  }
  if (!items) items = selected.map(templateContent);
  const output = { generatedAt: new Date().toISOString(), mode, status: 'bozza - da revisionare prima della pubblicazione', items };
  if (!args['dry-run']) {
    const dir = path.join(cfg.dataDir, 'generated');
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `content-${output.generatedAt.slice(0, 10)}.json`);
    await fs.writeFile(file, JSON.stringify(output, null, 2));
    log(`[ai-content] ${items.length} contenuti (${mode}) salvati in ${path.relative(process.cwd(), file)}`);
  } else {
    log(JSON.stringify(output, null, 2));
  }
  return output;
}
