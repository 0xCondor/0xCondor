// Dirette private Plus. Struttura pronta per un provider reale (LiveKit, Daily, ...):
// basta implementare listUpcoming() e createJoinToken() in un nuovo adapter.

function at(daysFromNow, hour, minute = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hour - 1, minute, 0, 0); // orari pensati per l'Italia (CET ≈ UTC+1)
  return d.toISOString();
}

const demoAdapter = {
  name: 'demo',
  async listUpcoming() {
    return [
      { id: 'live-alimentazione-cucciolo', title: 'Come scegliere il cibo per il tuo cucciolo', host: 'Dott.ssa Giulia R., nutrizionista veterinaria', startsAt: at(2, 18, 30), durationMin: 45, topic: 'alimentazione', category: 'cani', productIds: ['crocchette-cane-adulto-salmone'] },
      { id: 'live-gatto-indoor', title: 'Gatto in appartamento: gioco, lettiera e benessere', host: 'Marco B., educatore felino', startsAt: at(5, 19, 0), durationMin: 40, topic: 'comportamento', category: 'gatti', productIds: ['lettiera-agglomerante-10l', 'umido-gatto-tonno-12x85'] },
      { id: 'live-acquario-base', title: 'Il primo acquario tropicale passo per passo', host: 'Luca T., acquariofilo', startsAt: at(9, 18, 0), durationMin: 50, topic: 'acquariofilia', category: 'pesci', productIds: ['mangime-pesci-tropicali-250ml'] },
      { id: 'live-coniglio-casa', title: 'Coniglio in casa: fieno, spazi e routine', host: 'Sara M., esperta di piccoli animali', startsAt: at(12, 17, 30), durationMin: 40, topic: 'piccoli animali', category: 'piccoli', productIds: ['fieno-coniglio-1kg'] },
    ];
  },
  async createJoinToken() {
    return null; // in demo non c'è una stanza reale
  },
};

const adapters = { demo: demoAdapter };

export function liveProvider(name) {
  return adapters[name] || demoAdapter;
}

export async function upcomingLives(cfg) {
  const provider = liveProvider(cfg.liveProvider);
  const now = Date.now();
  const lives = (await provider.listUpcoming())
    .filter((l) => Date.parse(l.startsAt) > now)
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .map((l) => ({ ...l, access: 'plus', provider: provider.name }));
  return { provider: provider.name, lives };
}
