// Contesto condiviso dei job di automazione (stessa configurazione del server).
import { loadConfig } from '../src/config.js';
import { Catalog } from '../src/catalog.js';
import { stores as makeStores } from '../src/store.js';
import { openRepo } from '../src/repo.js';

export function loadEnvFile() {
  try {
    process.loadEnvFile?.(new URL('../.env', import.meta.url).pathname);
  } catch {
    /* nessun .env */
  }
}

export function createContext(overrides = {}) {
  const cfg = overrides.cfg ?? loadConfig();
  const repo = overrides.repo ?? openRepo(cfg.dataDir);
  return {
    cfg,
    repo,
    // stesso catalogo del server: database (importato da products.json al primo avvio)
    catalog: overrides.catalog ?? new Catalog(cfg.publicDir, { repo, exportFile: cfg.catalogExportFile }),
    stores: overrides.stores ?? makeStores(cfg.dataDir, repo),
    log: overrides.log ?? ((...a) => console.log(...a)),
  };
}

export function parseArgs(argv) {
  const args = {};
  for (const a of argv) {
    const m = a.match(/^--([a-z-]+)(?:=(.*))?$/);
    if (m) args[m[1]] = m[2] ?? true;
  }
  return args;
}
