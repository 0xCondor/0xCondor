#!/usr/bin/env node
// Esecuzione job: node automation/run.js <abandoned-cart|low-stock|daily-report|ai-content|all> [--dry-run] [...]
// Pensato per cron (es. Render Cron Job, Railway cron, crontab sulla VPS).
import { createContext, loadEnvFile, parseArgs } from './context.js';
import { runAbandonedCart } from './abandoned-cart.js';
import { runLowStock } from './low-stock.js';
import { runDailyReport } from './daily-report.js';
import { runAiContent } from './ai-content.js';

export const JOBS = {
  'abandoned-cart': runAbandonedCart,
  'low-stock': runLowStock,
  'daily-report': runDailyReport,
  'ai-content': runAiContent,
};

async function main() {
  loadEnvFile();
  const [name, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  const ctx = createContext();
  const names = name === 'all' ? Object.keys(JOBS) : [name];
  if (!names.every((n) => JOBS[n])) {
    console.error(`Uso: node automation/run.js <${Object.keys(JOBS).join('|')}|all> [--dry-run]`);
    process.exit(2);
  }
  for (const n of names) await JOBS[n](ctx, args);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
