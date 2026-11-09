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
- **Completo, con IA, account, pagamenti e pannello**: segui `server/README.md` (`cd server && npm install && npm start`, poi apri http://localhost:3000; il pannello di amministrazione è su http://localhost:3000/admin/ e la password del primo avvio viene stampata nel log).

## Struttura

```
public/            negozio (file unico), catalogo products.json (esportato dal database), pagine legali,
                   admin/ (pannello di amministrazione), pagamento/ (pagina demo ed esito del pagamento)
server/            API Express: account, ordini e pagamenti (Stripe/PayPal), /api/admin/*, /api/assistant, /api/plus/*, /voice/* (Twilio)
docs/              analisi di mercato, roadmap, conformità legale, marketing
```

> Prima della messa online i testi legali vanno fatti validare da un avvocato e vanno completati i dati societari (segnati con [DA COMPLETARE]).
