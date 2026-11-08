# Animol Life — Email, social e programma creator

> Versione 1.0 — novembre 2026.
> **Consensi**: le email promozionali partono solo a chi ha dato consenso esplicito (checkbox non preselezionata, separata da quella per SMS/WhatsApp) o, per i clienti, in regime di "soft spam" (art. 130, c. 4, Codice Privacy: prodotti analoghi, opt-out offerto alla raccolta e in ogni messaggio). Email transazionali (conferma ordine, promemoria autoship, avviso fine prova Plus) sono di servizio e partono sempre, senza contenuti promozionali prevalenti.
> Ogni email: mittente "Animol Life", link di disiscrizione, indirizzo e dati societari [DA COMPLETARE], link privacy.
> Variabili: `{{nome}}`, `{{nome_animale}}`, `{{specie}}`, `{{prodotto}}`, `{{data}}`, `{{link}}`.
> Ipotesi coupon: ANIMOL10 = -10% primo ordine (min. 29 €, validità 30 giorni); CUCCIOLO5 = -5% (come nel negozio).

---

## 1. Sequenza di benvenuto (iscritto newsletter, non ancora cliente)

**W1 — subito**
- Oggetto: *Benvenuto in Animol Life: ecco il tuo -10%*
- Preheader: *E un posto speciale per {{nome_animale}}.*
- Testo:
> Ciao {{nome}},
> grazie per esserti iscritto! Da oggi hai un pet shop che lavora per te: ti consigliamo, ti ricordiamo le cose importanti e, se vuoi, riordiniamo noi quando la crocchetta sta per finire.
> Il tuo regalo di benvenuto: **-10% sul primo ordine con il codice ANIMOL10** (minimo 29 €, valido 30 giorni, non cumulabile con altri codici).
> **[Inizia lo shopping]**
> Ci vuole un minuto per creare il profilo di {{nome_animale}}: ci dici specie, età e peso e i nostri consigli diventano su misura.
> **[Crea il profilo]**
> A presto,
> il team di Animol Life

**W2 — giorno 2: come funziona**
- Oggetto: *3 cose che facciamo per te (e che gli altri non fanno)*
- Testo:
> Ciao {{nome}},
> 1. **Ti consigliamo**: chiedi al nostro assistente virtuale con IA quali prodotti sono adatti a {{nome_animale}}. Per domande di salute ti indicheremo sempre di sentire il veterinario.
> 2. **Non resti mai senza**: con la consegna automatica risparmi il 5% su ogni consegna, ti avvisiamo 3 giorni prima e puoi saltare o spostare in un clic.
> 3. **Rispondiamo sempre**: in chat o al telefono, 24 ore su 24 con il nostro assistente virtuale, e una persona del team quando serve.
> Il tuo codice ANIMOL10 ti aspetta. **[Scopri i best seller per {{specie}}]**

**W3 — giorno 5: riprova sociale**
- Oggetto: *Cosa dicono di noi i pet parent italiani*
- Testo: 3 recensioni reali verificate (mai inventate o modificate) + foto UGC con autorizzazione.
> "{{recensione_1}}" — {{autore_1}}
> ...
> Il tuo -10% scade il {{data}}. **[Usa ANIMOL10]**

**W4 — giorno 10: contenuto utile**
- Oggetto: *Quante crocchette deve mangiare {{nome_animale}}?*
- Testo: estratto dell'articolo blog #1/#2 + link al calcolatore razione con disclaimer: *"Le indicazioni sono generali e basate sulle tabelle dei produttori: per esigenze di salute rivolgiti al tuo veterinario."*

**W5 — giorno 25: promemoria scadenza (reale)**
- Oggetto: *Il tuo -10% scade tra 5 giorni*
- Testo:
> Ciao {{nome}}, ti ricordiamo che il codice ANIMOL10 è valido fino al {{data}}. Spedizione gratuita da 49 €. **[Acquista ora]**

Variante cucciolo (se nel profilo età < 12 mesi): sostituire ANIMOL10 con CUCCIOLO5 in W1-W5 e W4 con "Checklist del primo mese".

---

## 2. Carrello abbandonato

**C1 — dopo 1 ora**
- Oggetto: *Hai dimenticato qualcosa nel carrello*
- Testo:
> Ciao {{nome}}, il tuo carrello ti aspetta: {{prodotto}} e altri {{n}} articoli.
> **[Torna al carrello]**
> Hai un dubbio su taglia, gusto o formato? Rispondi a questa email o chiedi al nostro assistente: ti aiutiamo a scegliere.

**C2 — dopo 24 ore**
- Oggetto: *{{prodotto}}: ti serve una mano a scegliere?*
- Testo:
> Ti mancano solo {{mancante}} € per la spedizione gratuita (da 49 €). Ecco 3 prodotti che spesso vengono acquistati insieme: {{suggerimenti}}.
> Ricorda: puoi anche impostare la **consegna automatica** e risparmiare il 5%.
> **[Completa l'ordine]**

**C3 — dopo 72 ore (solo nuovi clienti che non hanno già usato un codice)**
- Oggetto: *Un piccolo aiuto per il tuo primo ordine*
- Testo:
> Ciao {{nome}}, se è il tuo primo ordine puoi usare **ANIMOL10** per avere il 10% di sconto (minimo 29 €). Il carrello resterà salvato ancora per qualche giorno.
> **[Completa con il -10%]**

Nota: niente falsa scarsità ("ultimi pezzi") se non corrisponde allo stock reale.

---

## 3. Post-acquisto

**P1 — conferma ordine (transazionale, immediata)**: riepilogo, tempi, link tracking, recesso 14 giorni, contatti.

**P2 — spedito (transazionale)**: tracking.

**P3 — 2 giorni dopo la consegna: attivazione**
- Oggetto: *Com'è andata con {{prodotto}}?*
- Testo:
> Ciao {{nome}}, speriamo che {{nome_animale}} abbia gradito!
> Due consigli per il cambio di alimento: introducilo gradualmente in 7-10 giorni, mescolandolo con il precedente. Per qualsiasi dubbio sulla salute, il riferimento resta il tuo veterinario.
> Se non l'hai ancora fatto, **completa il profilo di {{nome_animale}}**: ti avviseremo quando il sacco sta per finire.
> **[Completa il profilo]**

**P4 — 10-14 giorni dopo la consegna: recensione**
- Oggetto: *Ci aiuti con 30 secondi?*
- Testo:
> La tua opinione aiuta altri pet parent a scegliere. Lascia una recensione su {{prodotto}} (positiva o negativa: pubblichiamo tutte le recensioni verificate).
> **[Scrivi la recensione]**
> (Nessun incentivo condizionato al giudizio positivo; eventuali punti fedeltà vanno dati per qualsiasi recensione e dichiarati.)

**P5 — 21 giorni: autoship/Plus**
- Oggetto: *Vuoi che pensiamo noi al prossimo ordine?*
- Testo:
> Ciao {{nome}}, in base al formato acquistato e al profilo di {{nome_animale}}, {{prodotto}} potrebbe finire intorno al **{{data_stimata}}** (stima).
> Attiva la consegna automatica: **-5% su ogni consegna**, promemoria 3 giorni prima, salti o annulli in un clic.
> **[Attiva la consegna automatica]**

---

## 4. Riordino (clienti senza autoship)

**R1 — 7 giorni prima della data stimata di esaurimento**
- Oggetto: *{{prodotto}} sta per finire?*
- Testo:
> Ciao {{nome}}, secondo la nostra stima la confezione di {{prodotto}} acquistata il {{data_ordine}} potrebbe finire tra circa una settimana.
> **[Riordina in un clic]** — oppure chiamaci e di' "riordina": il nostro assistente vocale prepara l'ordine e te lo conferma via SMS.
> Vuoi non pensarci più? **[Passa alla consegna automatica -5%]**

**R2 — giorno della data stimata (se non ha riordinato)**
- Oggetto: *Non restare senza: riordino pronto*
- Testo: carrello precompilato + "Spedizione in 24/48 ore" (solo se vero) + Plus: "con Plus la spedizione è gratuita anche sotto i 49 €".

**Autoship — promemoria transazionale (3 giorni prima)**
- Oggetto: *La tua consegna automatica parte il {{data}}*
- Testo: prodotti, prezzo (con eventuali variazioni evidenziate), pulsanti **[Conferma] [Sposta] [Salta] [Modifica]**. Se il prezzo è aumentato oltre il 5%, chiedere conferma esplicita prima di addebitare.

---

## 5. Animol Plus — prova gratuita 14 giorni

**PL1 — giorno 0: benvenuto**
- Oggetto: *Benvenuto in Animol Plus: ecco cosa sblocchi*
- Testo:
> Ciao {{nome}}, la tua prova gratuita è attiva fino al **{{data_fine_prova}}**.
> Cosa ottieni da oggi:
> - spedizione gratuita su tutti gli ordini, **senza minimo**
> - **-5% extra** (non cumulabile con altri codici) — **-10% sugli ordini in consegna automatica**
> - accesso alle **dirette con esperti** e all'archivio "Esperto risponde"
> - la community Animol (in arrivo: scambio e donazione di cibo sigillato)
> Dopo la prova, l'abbonamento si rinnova a **5,99 €/mese** (oppure 49,90 €/anno se lo scegli). Ti avviseremo 3 giorni prima di qualsiasi addebito e puoi disdire in qualsiasi momento dall'area personale.
> **[Fai il primo ordine Plus]**

**PL2 — giorno 3: la prossima diretta**
- Oggetto: *Giovedì in diretta: {{tema_live}} con {{esperto}}*
- Testo: data, ora, link, come fare domande in anticipo.

**PL3 — giorno 7: quanto hai risparmiato**
- Oggetto: *I tuoi primi 7 giorni di Plus*
- Testo:
> Finora hai risparmiato **{{risparmio}} €** tra spedizioni e sconti. Hai già visto l'archivio delle dirette? **[Guarda ora]**
> Suggerimento: abbina Plus alla consegna automatica per il -10%.

**PL4 — giorno 11 (3 giorni prima dell'addebito, transazionale obbligatoria)**
- Oggetto: *La tua prova Plus termina il {{data_fine_prova}}*
- Testo:
> Ciao {{nome}}, la prova gratuita di Animol Plus termina il {{data_fine_prova}}. Da quel giorno ti addebiteremo **5,99 €** sul metodo di pagamento {{metodo}}, e poi ogni mese.
> - Vuoi continuare? Non devi fare nulla.
> - Preferisci risparmiare? **[Passa all'annuale a 49,90 €]** (equivale a 4,16 €/mese)
> - Non ti interessa? **[Disdici in un clic]** — nessun costo.

**PL5 — giorno 15: conferma** (se continua: ricevuta e benefici; se disdetto: conferma disdetta + feedback "perché hai disdetto?" in 1 clic, senza ostacoli).

**PL6 — mese 2 (mensili): upgrade annuale**
- Oggetto: *Plus annuale: 2 mesi e mezzo in regalo*
- Testo: confronto 71,88 €/anno (mensile) vs 49,90 €/anno; benefici esclusivi annuale (tele-vet quando disponibile).

---

## 6. Calendario social 30 giorni (Instagram, TikTok, Facebook)

Frequenza: IG 5 post/settimana + stories quotidiane; TikTok 4-5 video/settimana; FB riuso IG + gruppi. Ogni contenuto sponsorizzato da terzi con "#adv"/"Pubblicità".

| Giorno | Formato | Tema | Pillar |
|---|---|---|---|
| 1 | Reel | "Ciao, siamo Animol Life": il pet shop che ti conosce | Brand |
| 2 | Carosello | 5 segnali che la lettiera va cambiata | Educativo |
| 3 | TikTok | POV: il gatto e la scatola Animol | Intrattenimento |
| 4 | Stories | Sondaggio: cane o gatto? → quiz profilo | Community |
| 5 | Reel | Demo chat IA: "quante crocchette per un beagle?" (con disclaimer) | Prodotto |
| 6 | Post | UGC cliente (con permesso) | Community |
| 7 | Live IG | Q&A con educatore cinofilo (anteprima Plus) | Esperti |
| 8 | Carosello | Alimenti tossici per cani: salva il post | Educativo |
| 9 | TikTok | Ho chiamato un pet shop alle 3 di notte (agente vocale IA dichiarato) | Prodotto |
| 10 | Reel | Come funziona la consegna automatica in 20 secondi | Prodotto |
| 11 | Post | Rifugio partner: storia di un'adozione | Sociale |
| 12 | Stories | Domande box "chiedi all'esperto" | Community |
| 13 | TikTok | Trend audio: routine del mattino del gatto | Intrattenimento |
| 14 | Carosello | Kit cucciolo: la checklist del primo mese (CUCCIOLO5) | Promo |
| 15 | Reel | Unboxing creator (#adv) | Creator |
| 16 | Post | Meme: "il mio gatto quando apro la bustina" | Intrattenimento |
| 17 | Carosello | Lettiera agglomerante vs silicio vs vegetale | Educativo |
| 18 | TikTok | Dietro le quinte: come prepariamo un ordine | Brand |
| 19 | Reel | Animol Plus: cosa include (prezzo e condizioni chiari) | Promo |
| 20 | Stories | Quiz: indovina la razza | Community |
| 21 | Live IG | Veterinario partner: "prevenzione tutto l'anno" (informativa) | Esperti |
| 22 | Carosello | Uccelli: 5 errori nell'alimentazione dei canarini | Nicchia |
| 23 | TikTok | Acquario per principianti in 30 secondi | Nicchia |
| 24 | Post | Recensione cliente verificata | Prova sociale |
| 25 | Reel | Gatto sterilizzato: come gestire l'appetito | Educativo |
| 26 | Stories | Contest foto "Il mio Animol" (senza premi o con regolamento DPR 430/2001) | Community |
| 27 | TikTok | Creator: "una settimana con la consegna automatica" (#adv) | Creator |
| 28 | Carosello | Resoconto donazioni del mese ai rifugi | Sociale |
| 29 | Reel | Coniglio: fieno, verdure e spazi | Nicchia |
| 30 | Post | Grazie! Il primo mese in numeri + invito alla community | Brand |

---

## 7. Programma creator e influencer

### 7.1 Struttura
| Livello | Follower | Compenso | Obiettivo |
|---|---|---|---|
| Nano | 1k-10k | prodotto in omaggio + codice affiliato 10% commissione | autenticità, UGC riutilizzabile |
| Micro | 10k-100k | 150-600 € a contenuto + commissione 8% | conversioni, Spark Ads |
| Esperti (vet, educatori, toelettatori) | qualsiasi | fee per live Plus 150-300 € | credibilità, contenuti Plus |
| Macro | > 100k | solo fase 3, su campagna | awareness |

Codici creator personali (es. `GIULIA10` = -10% primo ordine) tracciati per attribuzione; diritti d'uso dei contenuti per ads 3-6 mesi da contratto.

### 7.2 Regole obbligatorie (nel contratto e nel brief)
1. **Trasparenza**: ogni contenuto con accordo commerciale (anche solo prodotto gratuito) deve riportare in modo chiaro e immediato "Pubblicità", "Advertising", "#adv", "Sponsorizzato da Animol Life" o "Prodotto inviato da Animol Life" — **all'inizio** della didascalia/nel video (in sovrimpressione per video e stories, ripetuto in ogni storia) e usando gli strumenti di "partnership retribuita" della piattaforma. Riferimenti: Codice di Autodisciplina IAP (art. 7 e Regolamento Digital Chart), **Linee guida AGCOM delibera 7/24/CONS e Codice di condotta delibera 197/25/CONS** per influencer "rilevanti" (≥ 500.000 follower o ≥ 1 milione di visualizzazioni medie mensili), che devono anche iscriversi all'elenco AGCOM — [Teleborsa](https://www.teleborsa.it/DettaglioNews/17_2025-07-25_TLB/Influencer-Agcom-approva-Linee-guida-e-Codice-di-Condotta.html), [Altroconsumo](https://www.altroconsumo.it/hi-tech/internet-telefono/news/influencer-agcom), [Agenda Digitale](https://www.agendadigitale.eu/mercati-digitali/influencer-ci-sono-le-regole-agcom-quali-effetti-per-il-settore/), [Money.it](https://www.money.it/influencer-aggiornate-le-linee-guida-e-il-codice-di-condotta-per-evitare-sanzioni). Applichiamo gli stessi standard di trasparenza anche ai creator sotto soglia (best practice IAP e Codice del Consumo sulle pratiche commerciali scorrette).
2. **Claim**: niente affermazioni salutistiche ("mi ha guarito il cane dalla dermatite"); esperienze personali solo se veritiere e senza attribuire effetti terapeutici al prodotto.
3. **Minori**: niente contenuti che sfruttino minori come testimonial commerciali; nessun target sotto i 18 anni nelle campagne.
4. **Benessere animale**: nessun animale in situazioni di stress, pericolo o costumi forzati; nessun cucciolo "come regalo impulsivo".
5. **Approvazione**: brief scritto, revisione del contenuto prima della pubblicazione (claim e #adv), archivio dei contenuti per 12 mesi.
6. **Recensioni**: i creator non pubblicano recensioni sul sito o su Trustpilot come clienti normali.
7. **Fine rapporto**: rimozione codice e contenuti pinnati entro 15 giorni se richiesto.
