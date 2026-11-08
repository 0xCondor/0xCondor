# Animol Life — Roadmap di prodotto

> Versione 1.0 — novembre 2026. Autore: agente `animol-marketing`, da allineare con `animol-backend-ai`, `animol-frontend`, `animol-legal`.
> Tutti i costi sono **[STIMA]** su prezzi di listino 2025-2026 di SaaS/servizi comuni, IVA esclusa, e vanno confermati con preventivi. Le funzionalità derivano dalla classifica in [analisi-mercato.md](./analisi-mercato.md#9-funzionalità-differenzianti--classifica).

## Principi

1. **Ricorrenza prima di tutto**: ogni funzione deve aumentare frequenza d'acquisto o ritenzione.
2. **IA con rete di sicurezza**: ogni automazione ha soglie, revisione umana a campione e passaggio a operatore.
3. **Conformità by design**: consensi, recesso, prezzi Omnibus, trasparenza IA, disclaimer veterinario già nell'MVP.
4. **Misurare tutto**: eventi GA4/server-side dal giorno 1.

---

## Fase 1 — MVP (mesi 0-3): "Vendere, riordinare, rispondere"

| Area | Funzionalità | Note |
|---|---|---|
| Negozio | catalogo 800-1.500 SKU (cane, gatto prioritari; uccelli, pesci, piccoli animali con top 100), filtri per specie/età/taglia/esigenza, ricerca | dropshipping/grossista + magazzino ridotto per top 100 SKU |
| Checkout | carta, PayPal, Satispay, Apple/Google Pay, Klarna/Scalapay su ordini > 60 € | spedizione gratuita da 49 €, coupon ANIMOL10 e CUCCIOLO5 |
| Profilo animale | specie, razza, data di nascita, peso, sterilizzato, allergie | richiesto in modo leggero (dopo il primo ordine o nella chat) |
| Autoship v1 | frequenza scelta dal cliente (2-8 settimane), -5%, salta/posticipa/annulla in un clic, email promemoria 3 giorni prima | regole chiare di rinnovo e disdetta |
| Assistente IA chat | consigli prodotto, FAQ, stato ordine, passaggio a umano (email/WhatsApp in orario) | dichiarato come IA |
| Agente vocale v1 | risponde al numero, stato ordine, FAQ, riordino dell'ultimo ordine con conferma via SMS/email, inoltro a umano | registrazione solo con informativa |
| Contenuti IA | schede prodotto, meta tag, FAQ, con revisione umana | vedi agenti-ia-marketing.md |
| Plus (beta) | spedizione senza minimo, -5% extra, prova 14 giorni; live e community "in arrivo" | prezzo di lancio: vedi piano marketing |
| Marketing | Meta + Google Shopping/PMax, email welcome/carrello/post-acquisto, recensioni (Trustpilot o simili) | |
| Legale | condizioni di vendita, recesso 14 giorni, privacy/cookie, condizioni Plus, informativa IA | con `animol-legal` |

**KPI di uscita fase 1 (fine mese 3)**
- 600-1.000 ordini cumulati; AOV ≥ 45 €; conversion rate sito ≥ 1,5%
- ≥ 15% dei clienti attivi in autoship; ≥ 150 membri Plus (prova inclusa)
- CSAT chat/voce ≥ 4,3/5; ≥ 70% conversazioni risolte senza umano; errori di consiglio gravi = 0
- Rating recensioni ≥ 4,5 con ≥ 100 recensioni

**Costi stimati fase 1 (one-off + 3 mesi)**

| Voce | Costo |
|---|---|
| Sviluppo/configurazione (team agenti IA + 1 sviluppatore freelance part-time per integrazioni) | 6.000-12.000 € |
| Piattaforma e-commerce/hosting, plugin, dominio | 300-900 € |
| LLM (chat, contenuti) — ~20-40 mila conversazioni + 1.500 schede | 300-900 € |
| Voce (telefonia + speech-to-text/text-to-speech + numero) | 300-800 € |
| Email/SMS (es. Klaviyo/Brevo), recensioni, help desk | 300-700 € |
| Brand identity, foto/video base (in parte generati con IA, con licenze) | 1.500-3.000 € |
| Consulenza legale (validazione testi) | 1.500-3.000 € |
| Scorta iniziale magazzino top SKU | 8.000-15.000 € (capitale circolante) |
| Marketing (scenario base 3.000 €/mese) | 9.000 € |
| **Totale** | **~27.000-45.000 €** (di cui ~10-15 k€ capitale circolante) |

---

## Fase 2 — Mesi 3-6: "Personalizzare e fidelizzare"

| Funzionalità | Dettaglio |
|---|---|
| **Riordino intelligente v2** | previsione da formato × razione × peso; suggerimento automatico frequenza; "ti sta per finire?" via email/SMS/WhatsApp (con consenso) |
| **Calendario salute** | vaccini, antiparassitari, sverminazione, controllo peso; promemoria e prodotti correlati (senza indicazioni terapeutiche) |
| **AI Nutrition Planner v1** | razione indicativa da tabelle del produttore + profilo; disclaimer veterinario; segnalazione "chiedi al vet" per patologie, cuccioli < 3 mesi, gravidanza, perdita peso |
| **Fedeltà "Zampette" + referral** | punti, livelli, 10 € a te / 10 € all'amico su primo ordine ≥ 39 € |
| **Plus completo** | prime live mensili (veterinario/educatore), sezione "Esperto risponde", contenuti esclusivi |
| **Donazioni ai rifugi** | 1% degli ordini Plus + arrotondamento facoltativo; report trimestrale pubblico |
| Recensioni e UGC | richiesta automatica a 10-21 giorni; risposte IA con approvazione |
| CRO | test A/B su pagina prodotto, checkout, banner soglia spedizione |

**KPI fine mese 6**: 2.500-4.000 ordini cumulati; 25% clienti attivi in autoship; 500-800 Plus paganti; ripetizione a 90 giorni ≥ 35%; CAC blended ≤ 30 €; margine di contribuzione positivo sul secondo ordine.

**Costi stimati (3 mesi)**: sviluppo 6.000-10.000 €; strumenti/IA/voce 1.500-3.000 €; esperti per live (4-6 dirette × 150-300 €) 900-1.800 €; donazioni (variabili, ~1% venduto Plus); marketing 9.000-30.000 € secondo scenario. **Totale ~18.000-45.000 €.**

---

## Fase 3 — Mesi 6-12: "Ecosistema e scala"

| Funzionalità | Dettaglio |
|---|---|
| **Tele-vet in partnership** | consulti video con piattaforma/clinica partner; 1 consulto incluso nel Plus annuale; Animol non eroga atti veterinari |
| **Live shopping** | dirette con carrello integrato, co-sponsorizzate dai marchi |
| **B2B** | area riservata allevatori/rifugi/toelettatori/pet sitter: listino a scaglioni, fattura elettronica, consegne programmate |
| **Box mensile** | per specie/taglia, add-on del Plus |
| **Community marketplace** | scambio/donazione di cibo sigillato e non scaduto, con verifica foto lotto/scadenza, moderazione IA + umana, priorità rifugi; solo dopo parere legale |
| **Marca privata** | 10-20 SKU (snack, lettiera, accessori) con margine 40-55% [STIMA] |
| **Consegna in giornata** | pilota in 1 città se ≥ 30 ordini/giorno nell'area |
| **App mobile (PWA)** | notifiche push per riordino e calendario |
| Sostenibilità | imballi riciclati/riciclabili certificati; nessun claim generico "green" |

**KPI fine mese 12**: 12.000-20.000 ordini cumulati; fatturato annualizzato (run-rate) 0,9-1,5 mln €; 35-40% del fatturato da autoship; 2.000-3.500 Plus paganti; churn mensile Plus ≤ 6%; LTV/CAC ≥ 3; NPS ≥ 50.

**Costi stimati (6 mesi)**: sviluppo 15.000-30.000 €; tele-vet (setup partnership, revenue share) 2.000-5.000 €; marca privata (MOQ e design) 10.000-25.000 € capitale circolante; app PWA 5.000-10.000 €; marketing 18.000-60.000 €. **Totale ~50.000-130.000 €.**

---

## Riepilogo investimenti 12 mesi

| Scenario | Marketing | Prodotto/strumenti/altro | Totale 12 mesi [STIMA] |
|---|---|---|---|
| Lean (1.000 €/mese ads) | 12.000 € | 45.000 € | ~57.000 € |
| Base (3.000 €/mese) | 36.000 € | 60.000 € | ~96.000 € |
| Crescita (10.000 €/mese) | 120.000 € | 90.000 € | ~210.000 € |

## Dipendenze e rischi

| Rischio | Mitigazione |
|---|---|
| Consigli IA errati su salute | knowledge base controllata, rifiuto di diagnosi, escalation al vet, log e revisione settimanale |
| Costi di spedizione su ordini piccoli Plus | spedizione senza minimo per Plus solo standard; monitoraggio ordini < 25 € (vedi piano marketing) |
| Rottura di stock su autoship | buffer di scorta per SKU in autoship, sostituti proposti con consenso |
| Normativa (AI Act, GDPR, Codice del Consumo, mangimi) | revisione `animol-legal` ad ogni rilascio |
