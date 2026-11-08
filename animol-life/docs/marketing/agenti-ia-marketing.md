# Animol Life — Agenti IA per il marketing e il servizio clienti

> Versione 1.0 — novembre 2026. Da allineare con `animol-backend-ai` (implementazione in `server/`) e `animol-legal` (conformità).
> Principio: **l'IA prepara e propone, le regole decidono, l'umano supervisiona**. Ogni agente ha limiti di spesa, liste di parole vietate, log completi e un "interruttore" per disattivarlo.

## 1. Mappa degli agenti

| Agente | Compito | Autonomia | Strumenti (esempi, intercambiabili) |
|---|---|---|---|
| A1 Contenuti prodotto | schede prodotto, meta tag, FAQ dai dati del produttore | bozza → pubblicazione dopo controllo automatico + revisione a campione | LLM (es. Claude via API), feed PIM/CSV, script di validazione |
| A2 Contenuti editoriali e social | articoli blog, caption, script video, newsletter | sempre approvazione umana prima della pubblicazione | LLM, Canva/Figma, generatori immagini/video con licenza commerciale, calendario (Notion/Sheets) |
| A3 Ads optimizer | analisi giornaliera, regole di budget, nuove varianti di copy, negative | entro limiti: ±20% budget/campagna, pausa annunci; nuove creatività solo dopo approvazione | Meta Marketing API, Google Ads API, TikTok API, BigQuery/GA4, n8n/Make |
| A4 Assistente chat (shopping + servizio) | consigli prodotto, stato ordini, resi, autoship, Plus | autonomo su FAQ e ordini; escalation su reclami, salute, rimborsi > 50 € | LLM con strumenti (catalogo, ordini), help desk (Gorgias/Zendesk/Freshdesk) |
| A5 Agente vocale telefonico | risposta 24/7, stato ordine, riordino, inoltro a umano | come A4; conferma via SMS/email di ogni ordine | telefonia (es. Twilio), speech-to-text + text-to-speech, LLM, stessi strumenti di A4 |
| A6 Recensioni | risposta a recensioni, analisi del sentiment, segnalazione problemi | risposte positive/neutre automatiche dopo 30 gg di rodaggio; negative sempre approvate | API piattaforma recensioni (Trustpilot/Feedaty/Google Business Profile) |
| A7 CRM e lifecycle | segmenti, previsione riordino, personalizzazione email, test oggetti | invio automatico dei flussi approvati; nuove campagne con approvazione | Klaviyo/Brevo, modello di previsione riordino, dati profilo animale |
| A8 Analytics e report | dashboard settimanale, anomalie, insight | solo lettura + alert | GA4, BigQuery, Looker Studio, LLM per commento |

## 2. Workflow concreti

### 2.1 A1 — Scheda prodotto
1. Nuovo SKU nel feed (GTIN, marca, composizione, costituenti analitici, dosi, specie/età) → trigger.
2. LLM genera: titolo secondo schema, "In breve" (3-5 punti), descrizione 100-200 parole, meta title/description, 3 FAQ. **Prompt vincolato**: usa solo i dati forniti; se un dato manca scrivi `[MANCANTE]`.
3. Validatore automatico: parole vietate (cura, previene, guarisce, terapeutico, miracoloso, "il migliore", "approvato dai veterinari"), lunghezze, presenza composizione da etichetta, coerenza specie/età con il feed.
4. Instradamento: categoria dietetica / integratori / antiparassitari → revisione umana 100%; altro → pubblicazione e revisione a campione 20%.
5. Log: versione, prompt, dati sorgente, revisore.
**KPI**: tempo per scheda < 2 min; tasso di correzione umana < 10%; 0 claim non ammessi pubblicati.

### 2.2 A2 — Calendario contenuti
1. Lunedì: A8 passa i temi in crescita (Search Console, domande frequenti in chat, prodotti in tendenza).
2. A2 propone il piano settimanale (blog + 5 post + 4 script TikTok) secondo [email-social.md](./email-social.md).
3. Approvazione del responsabile marketing (Slack/Notion) → produzione bozze → seconda approvazione → pubblicazione programmata.
4. Immagini/video realistici generati con IA etichettati come tali dove richiesto (AI Act art. 50); niente generazione di "clienti" o "veterinari" fittizi che diano testimonianze.

### 2.3 A3 — Ottimizzazione ads (ciclo giornaliero)
1. 07:00 estrae spesa, conversioni, CPA, ROAS, frequenza, termini di ricerca; unisce i dati CRM (autoship attivati, Plus) per calcolare **CAC per cliente ricorrente**.
2. Applica le regole di [campagne-ads.md §5](./campagne-ads.md#5-regole-di-ottimizzazione-anche-per-lagente-ia-ads): pausa annunci in perdita, aumenti di budget ≤ 20% ogni 3 giorni, negative settimanali.
3. Genera 3-5 nuove varianti di copy per gli annunci affaticati → coda di approvazione (validatore claim come A1).
4. Limiti rigidi: **tetto di spesa mensile per account impostato sulla piattaforma** (non solo nell'agente); nessuna modifica a targeting sensibile; nessun nuovo pubblico basato su dati personali senza base giuridica.
5. Report giornaliero in 5 righe + alert se CPA > 1,5× target per 3 giorni o spesa anomala.

### 2.4 A4/A5 — Assistente chat e agente vocale
**Apertura obbligatoria (voce)**: *"Ciao, sono l'assistente virtuale con intelligenza artificiale di Animol Life. La chiamata può essere registrata per migliorare il servizio: trovi l'informativa su animol.life/privacy. Se preferisci parlare con una persona, dimmi 'operatore'. Come posso aiutarti?"*
**Apertura chat**: *"Sono l'assistente virtuale di Animol Life (IA). Posso aiutarti a scegliere prodotti, seguire un ordine o gestire la consegna automatica."*

Flussi principali:
| Intento | Azione | Guardrail |
|---|---|---|
| Consiglio prodotto | domande su specie/età/peso/esigenze → 2-3 prodotti dal catalogo con motivazione oggettiva | mai diagnosi; sintomi (vomito, diarrea, letargia, perdita peso, non mangia) → "contatta il veterinario"; urgenze → "contatta subito un veterinario o un pronto soccorso veterinario" |
| Stato ordine | verifica identità (email + numero ordine o codice via SMS) → tracking | nessun dato personale senza verifica |
| Riordino (voce) | legge ultimo ordine, conferma prodotti e prezzo totale, invia link/SMS di conferma o addebita metodo salvato solo con conferma esplicita registrata | niente nuovi metodi di pagamento al telefono; nessuna carta dettata a voce |
| Autoship | sposta/salta/annulla | annullamento sempre possibile senza tentativi insistenti di trattenere (massimo 1 offerta alternativa) |
| Plus | spiega benefici e prezzo; disdetta | disdetta immediata se richiesta |
| Reso/rimborso | apre la pratica secondo condizioni di vendita | rimborsi > 50 € o contestazioni → umano |
| Reclamo / tono arrabbiato | scuse, raccolta dati, ticket prioritario | escalation entro 4 ore lavorative |

Upsell consentito: suggerire autoship/Plus **una volta** per conversazione, quando pertinente; mai a chi sta reclamando.
Telefonate in uscita a scopo promozionale: **non previste** (vincoli Registro pubblico delle opposizioni e consenso); solo chiamate di servizio richieste dal cliente.
**KPI**: risoluzione senza umano ≥ 70%; CSAT ≥ 4,3; tempo di attesa voce < 5 s; conversione chat → acquisto 4-6%; tasso di escalation su salute monitorato.

### 2.5 A6 — Risposte alle recensioni
1. Nuova recensione → classificazione (stelle, tema: consegna, prodotto, servizio, prezzo; sentiment).
2. 4-5 stelle: risposta personalizzata breve (no copia-incolla), pubblicata automaticamente dopo il periodo di rodaggio.
3. 1-3 stelle: bozza empatica con scuse, nessuna ammissione legale automatica, invito al contatto privato con riferimento ticket → **approvazione umana**; ticket aperto in automatico.
4. Mai: chiedere di modificare/rimuovere la recensione in cambio di vantaggi; pubblicare recensioni false; nascondere recensioni negative. Indicare sul sito come verifichiamo che le recensioni provengano da clienti reali (art. 22, c. 4-bis, Codice del Consumo, introdotto con la direttiva Omnibus).
5. Report settimanale dei temi negativi ricorrenti → operazioni/acquisti.

Esempio risposta negativa (bozza):
> Ciao {{nome}}, ci dispiace davvero che il pacco sia arrivato in ritardo e con la confezione danneggiata: non è l'esperienza che vogliamo offrirti. Abbiamo aperto la pratica n. {{ticket}} e ti abbiamo scritto via email per sostituire il prodotto. Grazie per la segnalazione, ci aiuta a migliorare. — Il team di Animol Life

### 2.6 A7 — CRM e previsione riordino
- Modello v1 (regole): giorni di durata = peso confezione (g) ÷ razione giornaliera (g, dalla tabella del produttore per il peso dell'animale) × fattore di correzione (0,9) ; se mancano dati → mediana dei giorni tra ordini dello stesso SKU.
- Modello v2 (mese 6+): regressione sui dati reali di riordino per SKU/segmento; aggiornamento mensile.
- Trigger: R1/R2 di [email-social.md](./email-social.md#4-riordino-clienti-senza-autoship); canale scelto dal cliente (email/SMS/WhatsApp con consenso).
- Test continui: oggetto email, orario d'invio, ordine dei blocchi; vince la variante con più ricavo per destinatario, non solo aperture.

### 2.7 A8 — Report settimanale (lunedì 08:00)
Contenuto: fatturato, ordini, AOV, nuovi clienti, CAC per canale, CAC per cliente ricorrente, % autoship/Plus, churn Plus, margine di contribuzione, top/flop prodotti, temi chat e recensioni, 3 azioni consigliate. Alert real-time: crollo conversioni (> 40% sotto media 7 gg), errori checkout, spesa ads anomala, picco di recensioni negative.

## 3. Guardrail trasversali

| Area | Regola |
|---|---|
| Trasparenza IA | dichiarazione all'inizio di ogni chat/chiamata; contenuti sintetici realistici etichettati (AI Act, obblighi art. 50 dal 2 agosto 2026) |
| Salute animale | nessuna diagnosi, dose di farmaci o sostituzione del veterinario; parole/sintomi trigger → messaggio standard e escalation |
| Claim pubblicitari | validatore con lista parole vietate + revisione umana per categorie sensibili; riferimento Codice IAP e Reg. CE 767/2009 |
| Prezzi e promo | l'IA non crea sconti fuori dalle regole configurate; prezzo barrato = minimo 30 giorni (calcolato dal sistema, non dall'LLM) |
| Privacy | minimizzazione dati nei prompt (niente dati di pagamento); fornitori LLM con DPA e trasferimenti extra-UE conformi; registrazioni conservate per periodo definito in informativa; consenso per marketing e profilazione |
| Sicurezza | protezione da prompt injection (istruzioni nelle recensioni o nei messaggi dei clienti trattate come dati); strumenti con permessi minimi; azioni con impatto economico confermate |
| Spesa | tetti di budget sulle piattaforme ads; limiti di costo API mensili con alert al 80% |
| Qualità | revisione settimanale di 50 conversazioni casuali; registro errori e correzioni della knowledge base |
| Umano nel ciclo | responsabile marketing approva creatività e campagne nuove; responsabile servizio clienti gestisce escalation; parere legale per nuove funzionalità (community marketplace, tele-vet) |

## 4. Costi indicativi mensili [STIMA]

| Voce | Lancio (mesi 1-3) | Mese 12 |
|---|---|---|
| LLM (chat, contenuti, ads, recensioni) | 150-400 € | 500-1.500 € |
| Voce (minuti telefonia + STT/TTS) | 150-400 € | 400-1.200 € |
| Automazione (n8n self-hosted / Make) | 0-50 € | 50-150 € |
| CRM email/SMS | 50-150 € | 300-800 € |
| Help desk + recensioni | 100-300 € | 300-600 € |
| Supervisione umana (part-time marketing + servizio clienti) | 1.500-2.500 € | 4.000-6.000 € |

Risparmio atteso rispetto a un team tradizionale equivalente (copywriter, media buyer junior, 2-3 operatori customer care su turni): **60-75%** [STIMA], con servizio 24/7.
