# Animol Life — Campagne pubblicitarie pronte all'uso

> Versione 1.0 — novembre 2026. Budget di riferimento: scenario **Base 3.000 €/mese** (ripartizioni per 1.000 e 10.000 € in [piano-marketing.md](./piano-marketing.md#3-scenari-di-budget-mensile)).
> Ipotesi coupon: ANIMOL10 = -10% primo ordine (min. 29 €); CUCCIOLO5 = -5% (come nel negozio). Valori allineati al negozio.

## 0. Regole di copy (valgono per tutti i canali)

- **Vietato**: "cura", "previene", "guarisce", "elimina le allergie", "il migliore d'Italia", "il più economico", "approvato dai veterinari" (senza prova), confronti di prezzo non verificati, urgenza falsa ("ultime ore" se non è vero).
- **Ammesso**: descrizioni oggettive ("monoproteico", "senza cereali", "per gatti sterilizzati"), benefici d'uso ("consegna a casa", "non resti mai senza"), claim nutrizionali solo se presenti in etichetta del produttore.
- Sconti: specificare condizioni (minimo d'ordine, scadenza, non cumulabilità) nella landing; prezzo barrato = prezzo più basso degli ultimi 30 giorni.
- Assistente IA: dire "assistente virtuale con intelligenza artificiale", mai far credere che sia una persona o un veterinario.
- Immagini generate con IA: niente animali "perfetti" che mostrano risultati irrealistici di un prodotto; contenuti sintetici realistici etichettati.
- Politiche piattaforma: Meta e TikTok vietano il targeting per attributi sensibili; non vendere farmaci veterinari con ricetta via ads (gli antiparassitari "farmaci da banco" seguono regole specifiche: escluderli dalle campagne finché `animol-legal` non conferma).

---

## 1. Meta (Facebook + Instagram) — 1.050 €/mese

### 1.1 Struttura

| Campagna | Obiettivo | Budget | Pubblico |
|---|---|---|---|
| M1 Prospecting Advantage+ Shopping | Vendite | 550 € (18 €/giorno) | Advantage+ con suggerimenti: interessi cani, gatti, adozione animali, Zooplus/Arcaplanet (come segnale), 25-55 anni, Italia |
| M2 Prospecting Lead "Profilo animale / Quiz" | Lead / Iscrizioni | 150 € | Lookalike 1-3% clienti + iscritti lista d'attesa |
| M3 Retargeting dinamico (DPA) | Vendite | 250 € | visitatori 30 gg, carrello abbandonato 14 gg, visualizzazione prodotto 7 gg; esclusi acquirenti 7 gg |
| M4 Retention Plus/Autoship | Vendite | 100 € | clienti con 1 ordine e senza autoship (lista CRM con consenso / base giuridica corretta), 30-120 gg dal primo ordine |

### 1.2 Copy pronti

**A — "Non resti mai senza" (gatto, carosello)**
- Testo principale: *Lettiera finita alle 22? Mai più. Con Animol Life imposti la consegna automatica: ti avvisiamo prima, la sposti o salti in un clic e risparmi il 5% su ogni consegna. Spedizione gratuita da 49 €.*
- Titolo: **La spesa del tuo gatto arriva da sola**
- Descrizione: -10% sul primo ordine con ANIMOL10
- CTA: Acquista ora

**B — "Ti conosce" (cane, video 15")**
- Hook (0-3s, testo a schermo): *"Quante crocchette deve mangiare il tuo cane?"*
- Testo: *Dicci razza, età e peso: il nostro assistente con IA ti suggerisce prodotti e una razione indicativa basata sulle tabelle del produttore. Per dubbi di salute, sempre il tuo veterinario. Prova gratis su animol.life.*
- Titolo: **Consigli su misura, in 30 secondi**
- CTA: Scopri di più

**C — "Risponde anche al telefono" (target 45+)**
- Testo: *Preferisci telefonare? Chiamaci quando vuoi: risponde il nostro assistente virtuale con intelligenza artificiale, 24 ore su 24, per ordini, riordini e spedizioni. E se serve, ti passa una persona del team.*
- Titolo: **Il pet shop che risponde sempre**
- CTA: Chiama ora (pulsante chiamata) / Acquista ora

**D — "Cucciolo nuovo" (CUCCIOLO5)**
- Testo: *Benvenuto in famiglia! Crea il profilo del tuo cucciolo: ti ricordiamo le scadenze importanti indicate dal tuo veterinario e ti proponiamo il kit giusto. -5% sul tuo ordine con CUCCIOLO5.*
- Titolo: **Il kit per il primo mese, senza stress**

**E — Plus (retention)**
- Testo: *Ordini spesso? Con Animol Plus la spedizione è sempre gratis, anche sotto i 49 €, hai un 5% in più di sconto e accedi alle dirette con esperti. Prova gratuita 14 giorni, poi 5,99 €/mese. Disdici quando vuoi dall'area personale.*
- Titolo: **14 giorni di Plus, gratis**

**F — Rifugi (brand, luglio)**
- Testo: *Per ogni ordine dei soci Plus doniamo l'1% ai rifugi partner. Il resoconto delle donazioni è pubblico sul nostro sito.* (solo con rifugi effettivamente contrattualizzati)

### 1.3 Creatività
- Formati: 9:16 Reels/Stories (prioritario), 4:5 feed, carosello prodotti, DPA da catalogo.
- UGC: unboxing di creator, "giornata tipo" del gatto, schermata della chat IA che consiglia.
- Regola: un animale vero nei primi 2 secondi; sottotitoli sempre; logo a fine video.

### 1.4 Test A/B Meta (2 settimane ciascuno, budget ≥ 15 €/giorno per variante)
1. Angolo comodità (A) vs personalizzazione (B) vs telefono (C).
2. Offerta -10% vs spedizione gratuita sul primo ordine.
3. UGC creator vs video prodotto generato con IA.
4. Advantage+ pubblico aperto vs interessi.

---

## 2. Google Ads — 1.500 €/mese

### 2.1 Struttura

| Campagna | Budget | Note |
|---|---|---|
| G1 Performance Max "Food ricorrente" | 700 € | feed: alimenti cane/gatto top 300 SKU; segnali di pubblico: clienti, ricerche "crocchette", "umido gatto"; asset group per cane e gatto |
| G2 Shopping standard "Margine alto" | 350 € | accessori, giochi, lettiere, uccelli/pesci/piccoli animali; offerte per margine (etichette personalizzate) |
| G3 Search categoria | 300 € | gruppi sotto |
| G4 Search brand | 50 € | "animol life", "animol plus" |
| G5 Search servizio/differenziazione | 100 € | "abbonamento cibo gatto", "consegna crocchette a domicilio" |

Offerte: Massimizza valore di conversione con tROAS dopo 30 conversioni (partenza tROAS 350% PMax, 400% Shopping). Conversione principale: acquisto; secondarie: iscrizione Plus, autoship attivato (valore stimato LTV).

### 2.2 Parole chiave Search (corrispondenza a frase/esatta)

| Gruppo | Parole chiave | Negative |
|---|---|---|
| Crocchette cane | "crocchette cane online", "crocchette cane taglia grande", "crocchette monoproteiche cane", "crocchette cane senza cereali" | ricetta, fai da te, gratis, lavoro |
| Cibo gatto | "umido gatto offerta", "crocchette gatto sterilizzato", "cibo gatto online consegna" | randagi, colonia (se non B2B), video |
| Lettiera | "lettiera gatto agglomerante", "lettiera silicio", "lettiera vegetale" | |
| Ricorrenza | "abbonamento cibo gatto", "consegna periodica crocchette", "riordino automatico cibo cane" | |
| Nicchie | "mangime canarini", "mangime pesci acquario", "fieno conigli" | |

### 2.3 Annunci adattabili (RSA) — titoli (max 30 caratteri)
1. Crocchette Cane a Domicilio
2. Spedizione Gratis da 49 €
3. -10% sul Primo Ordine
4. Consegna Automatica -5%
5. Il Pet Shop Che Ti Conosce
6. Consigli Su Misura con IA
7. Ti Avvisiamo Prima Che Finisca
8. Reso Facile Entro 14 Giorni
9. Assistenza 24/7 Chat e Telefono
10. Cibo Gatto: Umido e Secco
11. Oltre 1.000 Prodotti Pet
12. Codice ANIMOL10
13. Animol Life Pet Shop Online
14. Salta o Sposta in Un Clic
15. Prova Plus Gratis 14 Giorni

**Descrizioni (max 90 caratteri)**
1. Imposta la consegna automatica: risparmi il 5% e non resti mai senza. Spedizione da 49 €.
2. Crea il profilo del tuo animale e ricevi consigli su misura dal nostro assistente con IA.
3. -10% sul primo ordine con ANIMOL10 (min. 29 €). Pagamenti sicuri e reso entro 14 giorni.
4. Animol Plus: spedizione gratis senza minimo e -5% extra. 14 giorni di prova, disdici quando vuoi.

Estensioni: sitelink (Cane, Gatto, Autoship, Animol Plus, Offerte), callout ("Spedizione gratis da 49 €", "Assistenza 24/7", "Reso 14 giorni"), snippet strutturati (Animali: Cani, Gatti, Uccelli, Pesci, Piccoli animali), estensione di chiamata (solo se agente vocale attivo), promozione (ANIMOL10).

### 2.4 Feed prodotti (Merchant Center)
- Titolo: `[Marca] [Linea] [Specie] [Età/Esigenza] [Gusto] [Formato]` → es. "Marca X Adult Gatto Sterilizzato Salmone Crocchette 1,5 kg".
- Campi: GTIN obbligatorio, prezzo/kg (unit_pricing_measure), disponibilità, spedizione, etichette personalizzate (margine, best seller, autoship-eligible).
- Promozioni Merchant per ANIMOL10. Recensioni prodotto collegate dopo 50 recensioni.

### 2.5 Test A/B Google
1. PMax con solo feed vs PMax con asset video/immagini.
2. tROAS 350% vs 450%.
3. Landing categoria vs landing "autoship" per gruppo Ricorrenza.

---

## 3. TikTok — 300 €/mese (base)

### 3.1 Struttura
- **T1 Spark Ads** (post di creator con autorizzazione e #adv già visibile): 200 €, obiettivo Conversioni web, 18-44 anni, interessi Pets.
- **T2 Video Shopping Ads da catalogo**: 100 €, solo dopo 50 conversioni pixel.

### 3.2 Script video (15-30")
1. **"POV: il tuo gatto quando arriva la scatola Animol"** — gatto che entra nella scatola; testo: "Lui ama la scatola. Tu ami non dover più portare 10 kg di lettiera." CTA "Link in bio, -10% con ANIMOL10".
2. **"Ho chiesto all'IA quante crocchette dare al mio beagle"** — registrazione schermo della chat, poi il cane; disclaimer a schermo "indicazioni generali, per la salute chiedi al tuo veterinario".
3. **"Ho telefonato a un pet shop alle 3 di notte"** — creator chiama l'agente vocale; mostra che si dichiara come assistente IA e gestisce il riordino.
4. **"3 cose che nessuno ti dice sul primo cucciolo"** (educativo) → CUCCIOLO5.
5. **Trend audio + "routine mattutina del mio gatto"** con prodotti taggati.

### 3.3 Test
- Hook domanda vs hook POV; creator micro (10-50k) vs nano (1-10k); CTA coupon vs CTA quiz.

---

## 4. Ripartizione e calendario operativo (scenario base)

| Settimana | Azione |
|---|---|
| 1 | Pixel/CAPI Meta, tag Google + conversioni avanzate, TikTok pixel + Events API; Merchant Center approvato; consenso cookie (Consent Mode v2) |
| 1-2 | Lancio M1, M3, G1, G3, G4; raccolta dati |
| 3-4 | Test A/B Meta #1, attivazione T1 con 3 creator |
| 5-6 | Ottimizzazione: taglio annunci con CPA > 1,5× target; avvio M4 e G5 |
| 7-8 | tROAS su PMax; test offerta #2; report CAC per cliente ricorrente |

## 5. Regole di ottimizzazione (anche per l'agente IA ads)

| Segnale | Azione |
|---|---|
| Annuncio con spesa > 2× CPA target e 0 acquisti | pausa |
| CPA < 0,7× target per 7 giorni | +20% budget (max 1 aumento ogni 3 giorni) |
| Frequenza Meta > 3,5 in prospecting | nuove creatività |
| CTR Search < 3% | rivedere titoli/parole chiave |
| ROAS 1° ordine basso ma tasso autoship alto | **non tagliare**: valutare su LTV |
| Termini di ricerca irrilevanti | negative settimanali |
