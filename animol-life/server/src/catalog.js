// Catalogo. Con un repository (server) i prodotti stanno nel database: al primo avvio vengono
// importati da public/products.json (o, se manca, da un piccolo campione) e ogni modifica dall'admin
// riscrive products.json per compatibilità. Senza repository (script, test) legge products.json,
// ricaricandolo se il file cambia.
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';

export const CATEGORIES = ['cani', 'gatti', 'uccelli', 'pesci', 'piccoli'];

export const SAMPLE_PRODUCTS = [
  {
    id: 'crocchette-cane-adulto-salmone', name: 'Crocchette Adult Salmone e Riso', brand: 'NaturaPet',
    category: 'cani', price: 39.9, salePrice: 34.9, lowestPrice30d: 34.9, rating: 4.7, reviews: 312, sold: 1840,
    description: 'Alimento completo per cani adulti di taglia media, con salmone come prima fonte proteica.',
    specs: { peso: '12 kg', eta: 'adulto', taglia: 'media' },
    variants: [{ label: '3 kg', price: 14.9, salePrice: null }, { label: '12 kg', price: 39.9, salePrice: 34.9 }],
  },
  {
    id: 'guinzaglio-retrattile-5m', name: 'Guinzaglio Retrattile 5 m', brand: 'WalkUp',
    category: 'cani', price: 19.9, salePrice: null, lowestPrice30d: 19.9, rating: 4.4, reviews: 128, sold: 640,
    description: 'Guinzaglio avvolgibile con freno a pulsante, per cani fino a 25 kg.',
    specs: { lunghezza: '5 m', portata: '25 kg' }, variants: [],
  },
  {
    id: 'umido-gatto-tonno-12x85', name: 'Umido Gatto Tonno in Gelatina 12x85 g', brand: 'Miagolì',
    category: 'gatti', price: 11.5, salePrice: 9.9, lowestPrice30d: 9.9, rating: 4.6, reviews: 540, sold: 3100,
    description: 'Bocconcini di tonno in gelatina per gatti adulti, confezione da 12 buste.',
    specs: { formato: '12 x 85 g', eta: 'adulto' }, variants: [],
  },
  {
    id: 'lettiera-agglomerante-10l', name: 'Lettiera Agglomerante Profumata 10 L', brand: 'CleanPaw',
    category: 'gatti', price: 8.9, salePrice: null, lowestPrice30d: 8.9, rating: 4.3, reviews: 210, sold: 2200,
    description: 'Lettiera minerale agglomerante con controllo degli odori.',
    specs: { volume: '10 L' }, variants: [{ label: '10 L', price: 8.9, salePrice: null }, { label: '20 L', price: 15.9, salePrice: 13.9 }],
  },
  {
    id: 'miscela-canarini-1kg', name: 'Miscela Semi per Canarini 1 kg', brand: 'AliVerdi',
    category: 'uccelli', price: 5.9, salePrice: null, lowestPrice30d: 5.9, rating: 4.5, reviews: 74, sold: 410,
    description: 'Miscela di semi selezionati per canarini ed esotici.', specs: { peso: '1 kg' }, variants: [],
  },
  {
    id: 'mangime-pesci-tropicali-250ml', name: 'Mangime in Scaglie Pesci Tropicali 250 ml', brand: 'AquaLife',
    category: 'pesci', price: 7.5, salePrice: 6.5, lowestPrice30d: 6.5, rating: 4.6, reviews: 95, sold: 520,
    description: 'Scaglie complete per pesci tropicali d\'acquario.', specs: { volume: '250 ml' }, variants: [],
  },
  {
    id: 'fieno-coniglio-1kg', name: 'Fieno di Prato per Conigli e Roditori 1 kg', brand: 'Erbolino',
    category: 'piccoli', price: 4.9, salePrice: null, lowestPrice30d: 4.9, rating: 4.8, reviews: 160, sold: 980,
    description: 'Fieno di prato stabile, ricco di fibre, per conigli, cavie e cincillà.', specs: { peso: '1 kg' }, variants: [],
  },
  {
    id: 'gabbia-criceto-deluxe', name: 'Gabbia Criceto Deluxe con Ruota', brand: 'RodiHome',
    category: 'piccoli', price: 49.9, salePrice: 44.9, lowestPrice30d: 44.9, rating: 4.2, reviews: 41, sold: 150,
    description: 'Gabbia a due piani con ruota silenziosa, beverino e casetta.', specs: { dimensioni: '60x40x45 cm' }, variants: [],
  },
];

function normalize(p) {
  if (!p || typeof p !== 'object' || p.id == null || !p.name) return null;
  const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
  const price = num(p.price);
  if (!Number.isFinite(price) || price < 0) return null;
  return {
    id: String(p.id),
    name: String(p.name),
    brand: p.brand ? String(p.brand) : '',
    category: CATEGORIES.includes(p.category) ? p.category : 'cani',
    price,
    salePrice: Number.isFinite(num(p.salePrice)) ? num(p.salePrice) : null,
    lowestPrice30d: Number.isFinite(num(p.lowestPrice30d)) ? num(p.lowestPrice30d) : null,
    rating: Number(p.rating) || 0,
    reviews: Number(p.reviews) || 0,
    sold: Number(p.sold) || 0,
    description: p.description ? String(p.description) : '',
    specs: p.specs && typeof p.specs === 'object' ? p.specs : {},
    variants: Array.isArray(p.variants)
      ? p.variants
          .filter((v) => v && v.label != null && Number.isFinite(num(v.price)))
          .map((v) => ({
            label: String(v.label), price: num(v.price), salePrice: Number.isFinite(num(v.salePrice)) ? num(v.salePrice) : null,
            lowestPrice30d: Number.isFinite(num(v.lowestPrice30d)) ? num(v.lowestPrice30d) : null,
          }))
      : [],
    stock: Number.isInteger(p.stock) ? p.stock : null,
  };
}

/** Forma pubblica completa usata da GET /api/products e da products.json (stesso ordine di chiavi del file storico). */
export function exportProduct(p) {
  const out = {
    id: p.id, name: p.name, brand: p.brand, category: p.category, price: p.price, salePrice: p.salePrice ?? null,
    lowestPrice30d: p.lowestPrice30d ?? null, rating: p.rating, reviews: p.reviews, sold: p.sold,
    description: p.description, specs: p.specs,
    variants: p.variants.map((v) => ({ label: v.label, price: v.price, salePrice: v.salePrice ?? null, lowestPrice30d: v.lowestPrice30d ?? null })),
  };
  if (p.stock !== null && p.stock !== undefined) out.stock = p.stock;
  return out;
}

function readSeedFile(file) {
  try {
    const raw = JSON.parse(fsSync.readFileSync(file, 'utf8'));
    const list = (Array.isArray(raw) ? raw : raw.products || []).map(normalize).filter(Boolean);
    return list.length ? list : null;
  } catch {
    return null;
  }
}

export class Catalog {
  constructor(publicDir, { repo = null, exportFile } = {}) {
    this.file = path.join(publicDir, 'products.json');
    this.exportFile = exportFile === undefined ? this.file : exportFile;
    this.repo = repo;
    this.cache = null;
    this.mtime = 0;
    this.version = -1;
    this.source = repo ? 'database' : 'sample';
    if (repo) {
      const seed = readSeedFile(this.file);
      repo.products.seed(seed || SAMPLE_PRODUCTS.map(normalize), seed ? 'products.json' : 'sample');
      this.seed = repo.meta.get('catalog_seed') || 'sample';
    }
  }

  async all() {
    if (this.repo) {
      if (!this.cache || this.version !== this.repo.products.version) {
        this.cache = this.repo.products.list().map(normalize).filter(Boolean);
        this.version = this.repo.products.version;
      }
      return this.cache;
    }
    try {
      const stat = await fs.stat(this.file);
      if (!this.cache || stat.mtimeMs !== this.mtime) {
        const raw = JSON.parse(await fs.readFile(this.file, 'utf8'));
        const list = (Array.isArray(raw) ? raw : raw.products || []).map(normalize).filter(Boolean);
        if (list.length === 0) throw new Error('catalogo vuoto');
        this.cache = list;
        this.mtime = stat.mtimeMs;
        this.source = 'products.json';
      }
      return this.cache;
    } catch (err) {
      if (err.code !== 'ENOENT' && !this.warned) {
        this.warned = true;
        console.warn(`[catalog] products.json non utilizzabile (${err.message}): uso il campione`);
      }
      this.source = 'sample';
      this.cache = null;
      return SAMPLE_PRODUCTS.map(normalize);
    }
  }

  async get(id) {
    return (await this.all()).find((p) => p.id === String(id)) || null;
  }

  /** Riscrive products.json dal database (scrittura atomica). Disattivabile con CATALOG_EXPORT_FILE=off. */
  async exportJson() {
    if (!this.repo || !this.exportFile) return null;
    const list = (await this.all()).map(exportProduct);
    const tmp = `${this.exportFile}.${process.pid}.${Date.now()}.tmp`;
    await fs.mkdir(path.dirname(this.exportFile), { recursive: true });
    await fs.writeFile(tmp, JSON.stringify(list, null, 2) + '\n');
    await fs.rename(tmp, this.exportFile);
    return this.exportFile;
  }

  /** Ricerca semplice per parole chiave, categoria e prezzo massimo (usata dall'IA e dal fallback). */
  async search({ query = '', category, maxPrice, limit = 5 } = {}) {
    const products = await this.all();
    const terms = expandSynonyms(tokenize(query));
    const scored = products
      .filter((p) => !category || p.category === category)
      .filter((p) => !maxPrice || effectivePrice(p) <= maxPrice)
      .map((p) => {
        const hay = tokenize(`${p.name} ${p.brand} ${p.category} ${p.description} ${Object.values(p.specs).join(' ')}`).join(' ');
        let score = 0;
        for (const t of terms) if (hay.includes(t)) score += t.length > 3 ? 2 : 1;
        return { p, score };
      })
      .filter(({ score }) => terms.length === 0 || score > 0)
      .sort((a, b) => b.score - a.score || b.p.sold - a.p.sold);
    return scored.slice(0, limit).map(({ p }) => p);
  }
}

// Sinonimi minimi per richieste generiche ("cibo", "gioco", ...).
const SYNONYMS = {
  cibo: ['aliment', 'crocchett', 'umid', 'mangim', 'semi', 'fieno', 'bocconcin'],
  mangiar: ['aliment', 'crocchett', 'umid', 'mangim'],
  pappa: ['aliment', 'crocchett', 'umid', 'mangim'],
  gioc: ['gioc', 'ruota', 'tiragraff', 'pallin'],
  passeggiat: ['guinzagl', 'collar', 'pettorin'],
  casa: ['gabbi', 'cuccia', 'casett', 'lettin'],
};

function expandSynonyms(terms) {
  const out = new Set(terms);
  for (const t of terms) for (const s of SYNONYMS[t] || []) out.add(s);
  return [...out];
}

const STOPWORDS = new Set(['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno', 'di', 'da', 'per', 'con', 'che', 'e', 'a', 'in', 'mi', 'ti', 'del', 'della', 'dei', 'delle', 'al', 'alla', 'cerco', 'vorrei', 'sotto', 'euro', 'meno', 'massimo', 'entro', 'avete', 'qualcosa', 'consigli', 'consigliami', 'mio', 'mia', 'suo', 'quale', 'cosa', 'sono', 'ho', 'un\'']);

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map((t) => (t.length > 4 ? t.replace(/(i|e|o|a)$/, '') : t)); // stemming minimo: cani/cane -> can
}

export function effectivePrice(p, variant) {
  if (variant) return variant.salePrice ?? variant.price;
  return p.salePrice ?? p.price;
}

export function publicProduct(p) {
  return {
    id: p.id, name: p.name, brand: p.brand, category: p.category,
    price: effectivePrice(p), listPrice: p.price, lowestPrice30d: p.lowestPrice30d,
    rating: p.rating, reviews: p.reviews,
    variants: p.variants.map((v) => ({ label: v.label, price: effectivePrice(p, v) })),
    description: p.description.slice(0, 300), specs: p.specs,
    ...(p.stock === 0 ? { available: false } : {}),
  };
}
