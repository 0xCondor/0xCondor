// Piccolo archivio JSON su file con scrittura atomica e coda per file (no DB in demo).
import fs from 'node:fs/promises';
import path from 'node:path';

const queues = new Map();

function enqueue(file, fn) {
  const prev = queues.get(file) || Promise.resolve();
  const next = prev.then(fn, fn);
  queues.set(file, next.catch(() => {}));
  return next;
}

export class JsonStore {
  constructor(dataDir, name, fallback) {
    this.file = path.join(dataDir, `${name}.json`);
    this.fallback = fallback;
  }

  async read() {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') return structuredClone(this.fallback);
      throw err;
    }
  }

  async write(data) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, this.file);
  }

  /** Legge, applica fn(data) e salva, serializzando le scritture sullo stesso file. */
  update(fn) {
    return enqueue(this.file, async () => {
      const data = await this.read();
      const result = await fn(data);
      await this.write(data);
      return result;
    });
  }
}

export async function appendJsonLine(dataDir, name, record) {
  const file = path.join(dataDir, `${name}.jsonl`);
  await fs.mkdir(dataDir, { recursive: true });
  return enqueue(file, () => fs.appendFile(file, JSON.stringify(record) + '\n'));
}

export function stores(dataDir) {
  return {
    orders: new JsonStore(dataDir, 'orders', []),
    newsletter: new JsonStore(dataDir, 'newsletter', []),
    plus: new JsonStore(dataDir, 'plus', { members: [], tokens: [] }),
    carts: new JsonStore(dataDir, 'carts', []),
    inventory: new JsonStore(dataDir, 'inventory', null),
  };
}
