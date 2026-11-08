import { createApp } from './app.js';
import { loadConfig } from './config.js';

// Carica .env se presente (Node >= 20.12), senza dipendenze esterne.
try {
  process.loadEnvFile?.(new URL('../.env', import.meta.url).pathname);
} catch {
  /* nessun .env: si usano le variabili d'ambiente del sistema */
}

const cfg = loadConfig();
const app = createApp({ config: cfg });
const server = app.listen(cfg.port, () => {
  console.log(`Animol Life server in ascolto su http://localhost:${cfg.port} (AI: ${app.locals.assistant.mode}, Stripe: ${cfg.stripeSecretKey ? 'on' : 'demo'})`);
});

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => server.close(() => process.exit(0)));
}
