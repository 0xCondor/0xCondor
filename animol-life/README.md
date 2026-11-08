# Animol Life — negozio online per animali alimentato dall'IA

Progetto sviluppato da un team di agenti IA, uno per settore (definizioni in `.claude/agents/`):

| Agente | Settore | Cartella |
|---|---|---|
| `animol-frontend` | Negozio, carrello, checkout, area Plus | `public/index.html` |
| `animol-backend-ai` | Server, assistente IA, agente vocale telefonico, abbonamenti, automazioni | `server/` |
| `animol-legal` | Conformità alle norme italiane e UE, testi legali | `public/legal/`, `docs/conformita-legale.md` |
| `animol-marketing` | Analisi di mercato, vendite, pubblicità, SEO, email | `docs/` |
| `animol-qa` | Test end-to-end e correzione dei bug | `docs/qa-report.md` |

## Avvio rapido

- **Solo vetrina**: apri `public/index.html` nel browser. Funziona anche senza server, con un assistente e degli ordini di ripiego.
- **Completo, con IA e ordini**: segui `server/README.md` (`cd server && npm install && npm start`, poi apri http://localhost:3000).

## Struttura

```
public/            negozio (file unico), catalogo products.json, pagine legali
server/            API Express: /api/assistant, /api/orders, /api/plus/*, /voice/* (Twilio)
docs/              analisi di mercato, roadmap, conformità legale, marketing
```

> Prima della messa online i testi legali vanno fatti validare da un avvocato e vanno completati i dati societari (segnati con [DA COMPLETARE]).
