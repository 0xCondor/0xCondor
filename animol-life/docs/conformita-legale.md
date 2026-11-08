# Animol Life – Checklist di conformità legale e analisi dei rischi (lancio in Italia)

> **Avvertenza.** Documento interno predisposto dalla funzione compliance come **base di lavoro**. Non è un parere legale. Ogni voce, e in particolare i testi pubblicati in `public/legal/`, **va validata da un avvocato** (consumer, privacy/IT) e, per gli aspetti fiscali e societari, da un **commercialista** prima del lancio. I riferimenti normativi indicati con **(da verificare)** richiedono un controllo puntuale sul testo vigente. I dati societari mancanti sono indicati come **[DA COMPLETARE]**.
>
> Data: 8 novembre 2026 · Versione 0.1

**Legenda priorità:** **P0** = bloccante, da chiudere prima del lancio · **P1** = entro il lancio o subito dopo (≤ 30 giorni) · **P2** = da pianificare.
**Legenda stato:** ☐ Da fare · ◐ In corso / bozza pronta · ☑ Fatto.

**Documenti collegati (bozze):** `public/legal/privacy.html`, `cookie.html`, `termini.html`, `recesso.html`, `note-legali.html`, `plus-regolamento.html`, `ai-trasparenza.html`.

---

## 0. Sintesi esecutiva: i 5 rischi principali

| # | Rischio | Perché | Mitigazione raccomandata |
|---|---|---|---|
| 1 | **Marketplace di scambio di alimenti tra privati** | Sicurezza dei mangimi e tracciabilità (Reg. CE 178/2002), prodotti richiamati o mal conservati, possibile perdita del safe harbour DSA se Animol ha un "ruolo attivo", rischio reputazionale in caso di intossicazione di animali, DAC7 se c'è corrispettivo | Lanciare **senza scambio di alimenti tra privati**. Partire con donazioni ai rifugi gestite da Animol e scambio di soli accessori. Vedi §14 |
| 2 | **Abbonamento Plus con prova gratuita e rinnovo automatico** ("subscription trap") | Sanzioni AGCM per pratiche commerciali scorrette o aggressive (artt. 20-26 Cod. Consumo, fino a 10 M€ e, per le infrazioni diffuse, fino al 4% del fatturato, da verificare), regole dei circuiti di pagamento sulle prove gratuite, funzione di recesso della dir. (UE) 2023/2673 | Pulsante di attivazione con prezzo esplicito, promemoria prima della fine della prova e del rinnovo annuale, disdetta online in 2 clic, nessun ostacolo di retention |
| 3 | **Agente vocale IA e chat IA: dati, registrazioni, trasparenza** | GDPR (DPIA, basi giuridiche, trasferimenti extra-UE verso USA), art. 50 AI Act (in vigore dal 2/8/2026), registrazione delle chiamate, art. 4 L. 300/1970 se registrano anche operatori dipendenti, risposte errate su salute animale o prezzi | DPIA prima del lancio, disclosure all'inizio della chiamata, minimizzazione dei dati, DPA e SCC con Anthropic, Twilio e fornitori STT/TTS, escalation umana, guardrail "nessuna consulenza veterinaria" |
| 4 | **Live shopping con brand e allevatori** | Pubblicità occulta (art. 23 lett. m Cod. Consumo; IAP; AGCOM), claim salutistici vietati sui mangimi (Reg. CE 767/2009 art. 13), rischio di proposte di vendita di cuccioli in live, registrazioni con immagini di utenti e minori | Etichetta "Pubblicità" persistente, contratti con gli ospiti con clausole su claim e divieto di vendita di animali, moderazione, consenso per le registrazioni, live 18+ |
| 5 | **Prezzi, promozioni e coupon (Omnibus)** | Art. 17-bis Cod. Consumo (prezzo più basso dei 30 giorni), prezzo per unità di misura, prezzi barrati e "-5% Plus" ingannevoli, supplemento per il contrassegno (art. 62 Cod. Consumo) | Motore prezzi con storico a 30 giorni, €/kg su tutte le schede, regole coupon trasparenti, nessun supplemento per i mezzi di pagamento salvo validazione legale |

Altri rischi rilevanti: obblighi DSA, accessibilità (EAA) se Animol supera le soglie di microimpresa, RAEE e imballaggi, vendita di antiparassitari (biocidi o medicinali veterinari).

---

## 1. Costituzione e avvio dell'impresa

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Costituzione della società (es. S.r.l.), iscrizione al Registro delle Imprese, PEC, REA | Artt. 2463 ss., 2188 ss. c.c.; L. 580/1993 | Atto costitutivo, iscrizione presso la CCIAA, PEC, capitale sociale. Dati: **[DA COMPLETARE]** | P0 | ☐ |
| Apertura P.IVA e scelta del codice ATECO | D.P.R. 633/1972 art. 35; classificazione **ATECO 2025** (ISTAT, operativa dal 1° aprile 2025) | Il codice tradizionale dell'e-commerce era **47.91.10** (ATECO 2007, "commercio al dettaglio di qualsiasi tipo di prodotto via internet"). Con ATECO 2025 (NACE Rev. 2.1) il commercio al dettaglio è classificato in base al prodotto, indipendentemente dal canale. Codice principale candidato nella **classe 47.76** (animali domestici e alimenti per animali), più eventuali codici secondari per l'abbonamento e per l'intermediazione (marketplace). **Da verificare con il commercialista** l'esatta sottocategoria | P0 | ☐ |
| SCIA per il commercio elettronico | D.lgs. 114/1998 art. 18; D.lgs. 59/2010 artt. 65 e 71 | SCIA al SUAP del Comune della sede, con i requisiti morali (art. 71, c. 1). Per il settore alimentare servono anche i requisiti professionali (art. 71, c. 6): **da verificare** se il pet food rientra nel settore "alimentare" ai fini commerciali (prassi prevalente: settore non alimentare). Verificare con la CCIAA o il SUAP | P0 | ☐ |
| Posizioni INPS/INAIL, contratti di lavoro | Normativa previdenziale | Se assume dipendenti: posizioni INPS/INAIL, CCNL (es. Commercio), DVR (D.lgs. 81/2008) per il magazzino | P1 | ☐ |
| Assicurazioni | Prudenziale | Polizza RC prodotti, RC generale, cyber risk (data breach, interruzioni) | P1 | ☐ |
| Marchio | D.lgs. 30/2005; Reg. UE 2017/1001 | Ricerca di anteriorità e deposito del marchio "Animol Life" (UIBM o EUIPO) e del dominio. Verificare l'assenza di conflitti con marchi esistenti | P1 | ☐ |
| Note legali sul sito | D.lgs. 70/2003 art. 7; art. 2250 c.c. | Pubblicare ragione sociale, sede, P.IVA, REA, capitale, PEC (`note-legali.html`) | P0 | ◐ |

## 2. Mangimi e alimenti per animali (pet food)

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Registrazione come operatore del settore dei mangimi (OSM) | Reg. CE 183/2005 art. 9; Reg. CE 178/2002 art. 3 | **Attenzione:** l'art. 2, par. 2, **lett. e)** del Reg. 183/2005 esclude dal suo campo di applicazione la **vendita al dettaglio di alimenti per animali da compagnia**. La registrazione presso ASL/Regione (tramite SUAP) può però essere richiesta se Animol: vende anche all'ingrosso o B2B; deposita merce per conto terzi; vende mangimi per **animali da reddito** (es. galline ovaiole tenute in casa, conigli da carne); riconfeziona o produce con proprio marchio; oppure se la prassi regionale lo prevede. **Azione:** interpello scritto al Servizio Veterinario dell'ASL (area igiene degli allevamenti e delle produzioni zootecniche) prima del lancio e conservazione della risposta | P0 | ☐ |
| Tracciabilità "un passo indietro / un passo avanti", ritiro e richiamo | Reg. CE 178/2002 artt. 18 e 20 (si applicano anche ai dettaglianti di mangimi) | Registrare fornitori e lotti in entrata. Gestire i lotti nel WMS. Procedura scritta di ritiro e richiamo, con contatto ai clienti che hanno acquistato il lotto e comunicazione all'autorità | P0 | ☐ |
| Informazioni di etichettatura e vendita a distanza | Reg. CE 767/2009 (artt. 11-22; art. 13 sui claim); Codice FEDIAF di buona pratica di etichettatura (art. 25) | Pubblicare in ogni scheda le indicazioni obbligatorie (specie, tipo completo o complementare, composizione, componenti analitici, additivi, istruzioni). **Da verificare** se per la vendita a distanza esista un obbligo espresso di renderle disponibili prima dell'acquisto: in ogni caso è buona prassi e serve per l'art. 49 Cod. Consumo (caratteristiche principali). Nessun claim terapeutico ("previene/cura") | P0 | ☐ |
| Alimenti dietetici (PARNUTS) | Reg. UE 2020/354 | Schede con fini nutrizionali e avvertenze ("si raccomanda il parere del veterinario"). L'assistente IA non deve consigliarli come terapia | P1 | ☐ |
| Condizioni di stoccaggio | Reg. 178/2002; buone pratiche | Magazzino asciutto, protetto da infestanti e a temperatura controllata. Gestione FEFO delle scadenze. Contratti con il 3PL che includano clausole di tracciabilità | P1 | ☐ |
| Controlli ufficiali sulle vendite a distanza | Reg. UE 2017/625 art. 36 | Collaborare con i campionamenti "anonimi" delle autorità | P2 | ☐ |
| Medicinali veterinari | Reg. UE 2019/6 art. 104; D.lgs. 218/2023 | **Non vendere** medicinali veterinari: la vendita online è consentita solo ai soggetti autorizzati e solo per i medicinali senza ricetta. Attenzione agli **antiparassitari**: alcuni sono medicinali veterinari, altri sono biocidi (Reg. UE 528/2012) con regole proprie. Verificare la classificazione prodotto per prodotto | P0 | ☐ |
| Sicurezza degli accessori | Reg. UE 2023/988 (GPSR, applicabile dal 13/12/2024) | Per gli accessori: dati del fabbricante e della persona responsabile UE nelle schede (art. 19), avvertenze, procedura per incidenti e richiami (Safety Business Gateway). I giochi per animali non sono "giocattoli" ai sensi della dir. 2009/48 | P1 | ☐ |

## 3. IVA, fiscalità e fatturazione

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Aliquota IVA | D.P.R. 633/1972, Tabella A | Il pet food è di regola al **22%**: le aliquote ridotte riguardano i mangimi per animali da reddito (**da verificare** caso per caso, es. mangimi per volatili da cortile). Accessori al 22%. Abbonamento Plus al 22% | P0 | ☐ |
| Certificazione dei corrispettivi | Art. 22 D.P.R. 633/1972; art. 2 D.P.R. 696/1996; D.M. 10/5/2019 | Il commercio elettronico indiretto è esonerato da scontrino e ricevuta e dalla trasmissione telematica dei corrispettivi (**da verificare** con il commercialista). Annotare nel registro dei corrispettivi (art. 24). Fattura elettronica (SdI) se richiesta dal cliente | P0 | ☐ |
| Vendite a distanza intra-UE e OSS | Dir. (UE) 2017/2455 e 2019/1995; D.lgs. 83/2021; art. 41 D.L. 331/1993 (da verificare) | Oltre **10.000 €** annui complessivi di vendite B2C verso altri Stati UE si applica l'IVA del Paese di destinazione: adesione al regime **OSS** (dichiarazione trimestrale). Monitorare la soglia | P1 | ☐ |
| DAC7 (piattaforme) | Dir. (UE) 2021/514; D.lgs. 32/2023 | Se nel marketplace i venditori ricevono un **corrispettivo** (anche un rimborso spese), Animol può essere "gestore di piattaforma" con obblighi di due diligence e comunicazione annuale all'Agenzia delle Entrate. Se gli scambi sono senza corrispettivo, verificare l'esclusione | P1 | ☐ |
| Coupon e buoni | Art. 6-bis ss. D.P.R. 633/1972 (buoni monouso e multiuso) | Trattare correttamente sconti e buoni regalo ai fini IVA | P2 | ☐ |
| Donazioni ai rifugi | L. 166/2016; art. 10 n. 12 D.P.R. 633/1972 (da verificare) | Se si attiva la donazione di alimenti a canili e gattili: verificare l'applicabilità della L. 166/2016 alle cessioni gratuite di alimenti per animali e i relativi benefici e adempimenti | P2 | ☐ |

## 4. Prezzi e promozioni (Omnibus)

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Prezzo finale IVA inclusa, spese evidenziate | Art. 49, c. 1, lett. e) Cod. Consumo; D.lgs. 70/2003 | Prezzi finali in tutte le pagine. Spese di spedizione visibili prima del checkout | P0 | ◐ |
| Prezzo per unità di misura (€/kg, €/l) | Artt. 13-17 Cod. Consumo (dir. 98/6/CE) | Calcolo automatico del prezzo al kg o al litro su tutte le schede di prodotti venduti a peso o volume e negli elenchi | P0 | ☐ |
| Annuncio di riduzione di prezzo | **Art. 17-bis Cod. Consumo** (D.lgs. 26/2023) | Mostrare il **prezzo più basso applicato nei 30 giorni precedenti** quando si annuncia uno sconto (prezzo barrato, "-20%"). Tenere uno storico dei prezzi. Eccezioni per i prodotti deperibili. Attenzione: lo "sconto extra Plus -5%" e i coupon generalizzati possono rientrare negli annunci di riduzione (da verificare) | P0 | ☐ |
| Prezzi personalizzati | Art. 49, c. 1, lett. e-bis Cod. Consumo | Se l'IA o il motore promozioni personalizza i prezzi, informarne il consumatore. Raccomandazione: **non** personalizzare i prezzi, solo le offerte | P1 | ☐ |
| Classificazione dei risultati e recensioni | Art. 22, c. 4-bis e 4-ter Cod. Consumo (da verificare); pratiche vietate nell'Allegato / art. 23 | Spiegare i parametri principali dell'ordinamento dei risultati di ricerca. Se si pubblicano recensioni, indicare come si verifica che provengano da acquirenti reali. Mai recensioni false o incentivate senza disclosure | P1 | ☐ |
| Vendite sottocosto, saldi | D.P.R. 218/2001; leggi regionali sui saldi (da verificare se applicabili all'online) | Rispettare limiti e comunicazioni se si usano le diciture "sottocosto" o "saldi" | P2 | ☐ |
| Concorsi e operazioni a premio | D.P.R. 430/2001 | Regolamento, cauzione e comunicazione al MIMIT per i giveaway (anche in live e nella newsletter). I semplici coupon di sconto ne sono esclusi | P1 | ☐ |
| Supplemento per il contrassegno | **Art. 62 Cod. Consumo** | Divieto di imporre spese per l'uso di strumenti di pagamento. Il supplemento per il contrassegno è a rischio: **da evitare** o da qualificare in modo trasparente come servizio del corriere (validazione legale) | P0 | ☐ |

## 5. Tutela del consumatore e contratti a distanza

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Informazioni precontrattuali | Artt. 48-49 e Allegato I Cod. Consumo; art. 12 D.lgs. 70/2003 | Condizioni di vendita (`termini.html`), riepilogo al checkout, conferma su supporto durevole (art. 51, c. 7) | P0 | ◐ |
| Pulsante d'ordine | Art. 51, c. 2 Cod. Consumo | "Ordine con obbligo di pagamento". Per Plus: "Inizia la prova gratuita – poi 5,99 €/mese" | P0 | ☐ |
| Diritto di recesso 14 giorni ed eccezioni | Artt. 52-59 Cod. Consumo; Allegato I parte B (modulo) | `recesso.html`. Eccezioni: art. 59 lett. **e)** (sigillati aperti, motivi igienici), **d)** (deperibili), **c)** (personalizzati). Rimborso entro 14 giorni (art. 56). Per il contrassegno: rimborso con bonifico, senza costi | P0 | ◐ |
| **Funzione di recesso online** ("pulsante di recesso") | Dir. (UE) 2023/2673 (nuovo art. 11-bis dir. 2011/83/UE), applicabile dal **19 giugno 2026** | Implementare nell'area clienti una funzione "Recedi dal contratto" ben visibile, con conferma su supporto durevole, per gli ordini e per Plus. **Verificare il decreto italiano di recepimento** e i requisiti testuali | P0 | ☐ |
| Consegna e passaggio del rischio | Artt. 61 e 63 Cod. Consumo | Consegna entro 30 giorni salvo accordo diverso. Rischio a carico del venditore fino alla consegna | P0 | ◐ |
| Garanzia legale di conformità | Artt. 128-135-septies Cod. Consumo (D.lgs. 170/2021) | **24 mesi** dalla consegna (non 26). Presunzione di difetto preesistente nel primo anno. Denuncia entro 2 mesi dalla scoperta e prescrizione in 26 mesi (**da verificare** il testo vigente dell'art. 133): da qui l'equivoco sui "26 mesi". Procedure per alimenti scaduti o danneggiati alla consegna | P0 | ◐ |
| Servizi digitali (live video in Plus) | Artt. 135-octies ss. Cod. Consumo (dir. (UE) 2019/770) | La componente "accesso alle live" è un servizio digitale: si applicano gli obblighi di conformità e aggiornamento e i rimedi per mancata fornitura | P1 | ☐ |
| Abbonamento: rinnovo automatico, prova gratuita, disdetta | Artt. 20-26 Cod. Consumo (pratiche scorrette e aggressive, incluso l'art. 25 sugli ostacoli non contrattuali); artt. 33 ss. (clausole vessatorie); prassi AGCM; regole dei circuiti di carte (da verificare) | Promemoria prima della fine della prova e prima del rinnovo annuale. Disdetta online con la stessa facilità dell'iscrizione. Modifiche di prezzo con preavviso e diritto di disdetta. Monitorare la futura proposta UE "Digital Fairness Act" sui contratti di abbonamento (da verificare lo stato) | P0 | ◐ |
| Clausole vessatorie | Artt. 33-38 Cod. Consumo | Revisione legale di T&C e Regolamento Plus (limitazioni di responsabilità, modifiche unilaterali, foro) | P0 | ☐ |
| ADR e ODR | Artt. 141 ss. Cod. Consumo; Reg. (UE) 2024/3228 | La piattaforma ODR UE è **chiusa dal 20 luglio 2025**: eliminare il vecchio link ODR. Informare sugli organismi ADR (art. 141-sexies) | P0 | ◐ |
| Foro del consumatore | Art. 66-bis Cod. Consumo; Reg. UE 1215/2012; Reg. CE 593/2008 art. 6 | Nessuna clausola sul foro contraria al consumatore | P0 | ◐ |
| Geoblocking | Reg. (UE) 2018/302 | Non discriminare i clienti UE per nazionalità o residenza nell'accesso al sito e nelle condizioni (non c'è obbligo di consegnare ovunque) | P2 | ☐ |
| Lingua | Art. 49 Cod. Consumo e prassi | Informazioni e conferme in italiano | P0 | ◐ |

## 6. Protezione dei dati personali (GDPR)

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Informativa | Artt. 12-14 GDPR | `privacy.html` più informative brevi contestuali: checkout, chat IA, messaggio vocale all'inizio della chiamata, ingresso nelle live, marketplace | P0 | ◐ |
| Registro dei trattamenti | Art. 30 GDPR | **Obbligatorio** anche sotto i 250 dipendenti, perché i trattamenti non sono occasionali e includono profilazione. Redigere il registro come titolare (e come responsabile se si trattano dati per conto terzi) | P0 | ☐ |
| **DPIA** | Art. 35 GDPR; elenco del Garante (provv. n. 467 dell'11/10/2018); Linee guida WP248 | **Raccomandata e probabilmente obbligatoria** per: agente vocale con registrazione e trascrizione tramite IA (tecnologia innovativa combinata con altri criteri), chat IA, profilazione su larga scala, marketplace con monitoraggio dei contenuti. Svolgerla prima del lancio. Se il rischio residuo resta elevato serve la consultazione preventiva (art. 36) | P0 | ☐ |
| DPO | Art. 37 GDPR; Linee guida WP243 | Obbligatorio se le attività principali consistono in un monitoraggio regolare e sistematico su larga scala (es. profilazione comportamentale estesa). Al lancio probabilmente non obbligatorio, ma va fatta e **documentata la valutazione**. Consigliata la nomina, anche esterna, vista la presenza di IA e voce | P1 | ☐ |
| Basi giuridiche e consensi | Artt. 6-7 GDPR; art. 130 Codice privacy | Consensi separati e non preselezionati per newsletter, profilazione, registrazione dell'audio delle chiamate e immagine nelle live. Double opt-in per la newsletter. Soft spam (art. 130, c. 4) solo per prodotti analoghi, con opposizione facile. LIA documentate per i legittimi interessi | P0 | ◐ |
| Tempi di conservazione | Art. 5.1.e GDPR; prassi del Garante (12 mesi per la profilazione e 24 per il marketing, provv. 24/2/2005 fidelity card, da verificare se ancora di riferimento) | Definire la retention per chat, audio, trascrizioni, live e marketplace (segnaposto nell'informativa). Cancellazione automatica | P0 | ☐ |
| Responsabili del trattamento | Art. 28 GDPR | DPA con Anthropic, Twilio, fornitori STT/TTS, hosting, piattaforma video, newsletter, 3PL e customer care. Stripe e PayPal: verificare il ruolo (titolari autonomi per gli obblighi regolamentari) | P0 | ☐ |
| Trasferimenti extra-UE | Capo V GDPR; decisione di adeguatezza EU-US DPF del 10/7/2023; SCC 2021/914 | Mappare i flussi verso gli USA (Anthropic, Twilio, eventualmente Stripe e PayPal). Verificare la certificazione DPF o le SCC. Svolgere una **TIA**. Preferire, ove possibile, regioni di trattamento UE | P0 | ☐ |
| Sicurezza e data breach | Artt. 32-34 GDPR | Cifratura, MFA per l'admin, log, procedura di notifica entro 72 ore, minimizzazione dei dati inviati all'LLM (niente dati di pagamento) | P0 | ☐ |
| Soggetti autorizzati | Art. 2-quaterdecies Codice privacy; art. 29 GDPR | Nomine e istruzioni per dipendenti, moderatori e operatori | P1 | ☐ |
| Monitoraggio dei lavoratori | Art. 4 L. 300/1970; art. 114 Codice privacy | Se le chiamate gestite da **operatori umani** sono registrate o se sistemi IA valutano gli operatori, serve un accordo sindacale o l'autorizzazione dell'INL e un'informativa ai lavoratori | P1 | ☐ |
| Minori | Art. 8 GDPR; art. 2-quinquies Codice privacy | Servizi per maggiorenni. Age gate per Plus e live | P1 | ◐ |
| Diritti degli interessati | Artt. 15-22 GDPR | Procedura interna con risposta entro 1 mese. Export dei dati dall'area clienti | P1 | ☐ |

## 7. Cookie e tracciamento

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Banner e consenso | Art. 122 Codice privacy; Linee guida cookie del Garante, provv. 10/6/2021 n. 231 | CMP con "Accetta" e "Rifiuta" di pari evidenza, la "X" vale come rifiuto, niente cookie wall, banner riproposto non prima di 6 mesi, link "Preferenze cookie" nel footer | P0 | ☐ |
| Cookie policy e mappatura | Linee guida 2021 | Scansione dei cookie in produzione e compilazione della tabella in `cookie.html`. Analytics anonimizzati (IP mascherato, nessun incrocio) per l'esenzione dal consenso | P0 | ◐ |
| Pixel social e advertising | Artt. 26 e 44 ss. GDPR | Contitolarità con le piattaforme per i pixel. Nessun caricamento prima del consenso. Verificare i trasferimenti extra-UE | P1 | ☐ |

## 8. Intelligenza artificiale (AI Act e L. 132/2025)

**Calendario del Reg. (UE) 2024/1689:** in vigore dal 1/8/2024. Pratiche vietate (art. 5) e alfabetizzazione (art. 4) dal **2/2/2025**. Obblighi per i modelli GPAI dal 2/8/2025. Trasparenza (art. 50) e gran parte degli obblighi dal **2/8/2026**. Sistemi ad alto rischio dell'Allegato I dal 2/8/2027. La proposta "Digital Omnibus" (novembre 2025) prevede rinvii, soprattutto per l'alto rischio: **verificare lo stato dell'iter**. In Italia: **L. 23 settembre 2025, n. 132** (in vigore dal 10/10/2025), con AgID e ACN come autorità.

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Classificazione dei sistemi | Artt. 5-6, Allegato III AI Act | Chatbot di shopping, agente vocale di assistenza, raccomandazioni e moderazione: **non ad alto rischio** e non vietati (nessun riconoscimento delle emozioni, nessuna manipolazione, nessuna biometria). Documentare la valutazione | P0 | ◐ |
| Ruolo | Art. 3 AI Act | Animol è **deployer** dei modelli di Anthropic e verosimilmente **fornitore** del sistema di chat e voce messo in servizio con il proprio nome (gli obblighi dell'art. 50, par. 1 gravano sul fornitore). Da confermare con il legale | P1 | ☐ |
| Informare che si interagisce con un'IA | **Art. 50, par. 1** | Etichetta permanente in chat. Messaggio iniziale nella telefonata (`ai-trasparenza.html`) | P0 | ◐ |
| Contenuti sintetici | Art. 50, par. 2 e 4 | Voce sintetica dell'agente: verificare la marcatura machine-readable a cura del fornitore TTS. Etichettare immagini e video generati con l'IA usati nel marketing se possono sembrare reali (deepfake) | P1 | ☐ |
| Alfabetizzazione in materia di IA | Art. 4 (dal 2/2/2025) | Formazione documentata per il personale che gestisce o supervisiona i sistemi | P1 | ☐ |
| Guardrail di contenuto | Cod. Consumo artt. 20-23; Reg. 767/2009 art. 13; Reg. UE 2019/6 | System prompt e test: nessuna diagnosi o dosaggio veterinario, rinvio al veterinario per i sintomi, nessuna promessa su prezzi o rimborsi non presenti nel sistema, niente dark pattern, prodotti sponsorizzati dichiarati. Log di valutazione periodica | P0 | ☐ |
| Intervento umano | Art. 22 GDPR; art. 20 DSA; buona prassi | Escalation all'operatore in chat e al telefono. Le decisioni rilevanti restano umane | P0 | ◐ |
| Obblighi dei fornitori GPAI | Artt. 53 ss. AI Act | A carico di Anthropic. Acquisire la documentazione o le policy d'uso e verificare i termini commerciali (uso dei dati, conservazione) | P2 | ☐ |

## 9. Digital Services Act (live e marketplace)

Animol Life fornisce un servizio di **hosting** (art. 3 lett. g) e, poiché contenuti e annunci degli iscritti sono diffusi a un pubblico potenzialmente illimitato di abbonati, verosimilmente una **piattaforma online** (art. 3 lett. i). Se e quando si ammettono venditori professionali, diventa una **piattaforma che consente contratti a distanza B2C** (artt. 30-32). Coordinatore dei servizi digitali in Italia: **AGCOM** (D.L. 123/2023).
**Esenzione dimensionale:** le sezioni 3 e 4 del Capo III (artt. 19-32) **non si applicano alle micro e piccole imprese** (artt. 19 e 29; Racc. 2003/361/CE: meno di 50 dipendenti e fatturato o bilancio fino a 10 M€), salvo l'art. 24, par. 3. Restano sempre applicabili gli artt. 11-18 (art. 15 escluso per le micro e piccole imprese). Si consiglia comunque di adottare gli artt. 20, 23, 28 e 30 come buona prassi, perché l'esenzione cessa con la crescita (con un periodo transitorio di 12 mesi, art. 19, par. 2).

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Esenzione di responsabilità dell'hosting | Art. 6 DSA | Mantenere un ruolo **neutro**: non selezionare o garantire i beni scambiati, rimuovere prontamente i contenuti illegali una volta a conoscenza. Le verifiche volontarie non fanno perdere l'esenzione (art. 7). Attenzione all'art. 6, par. 3 (presentazione che induce a credere che sia la piattaforma a fornire il bene) | P0 | ◐ |
| Punti di contatto | Artt. 11-12 | E-mail per le autorità e canale per gli utenti (`note-legali.html`) | P0 | ◐ |
| Termini e condizioni | Art. 14 | Regole di moderazione, strumenti automatizzati, reclamo interno (`plus-regolamento.html`). Linguaggio comprensibile | P0 | ◐ |
| Notice and action | Art. 16 | Pulsante "Segnala" su annunci, messaggi e live. Conferma di ricezione e decisione | P0 | ☐ |
| Motivazione delle decisioni | Art. 17 | Statement of reasons per ogni rimozione o limitazione. Per le piattaforme online, invio alla banca dati della Commissione (art. 24, par. 5, da verificare l'applicabilità alle micro e piccole imprese) | P0 | ☐ |
| Segnalazione di reati | Art. 18 | Procedura per notificare alle autorità i sospetti di reato che minacciano la vita o la sicurezza | P1 | ☐ |
| Reclamo interno, ADR, abusi, segnalatori attendibili | Artt. 20-23 | Raccomandati anche se esenti. Già previsti nel Regolamento Plus | P1 | ◐ |
| Dark pattern | Art. 25 | Interfacce di iscrizione e disdetta non manipolative (rilevante anche per Plus) | P0 | ☐ |
| Pubblicità sulle piattaforme | Art. 26 | Nelle live e nel marketplace: indicare che si tratta di pubblicità, per conto di chi e chi la paga | P1 | ☐ |
| Sistemi di raccomandazione | Art. 27 | Spiegare i parametri principali nei T&C | P1 | ◐ |
| Protezione dei minori | Art. 28; Linee guida della Commissione (luglio 2025, da verificare) | Servizi 18+, age assurance proporzionata, nessuna pubblicità profilata ai minori | P1 | ◐ |
| Tracciabilità dei professionisti (KYBC) | **Art. 30** | Oggi: marketplace riservato ai privati, con divieto per i professionisti e controlli su volumi e frequenza. Se si aprono ai professionisti: raccolta e verifica di nome, indirizzo, telefono, e-mail, documento d'identità, conto di pagamento, registro delle imprese, autocertificazione di conformità; sospensione se le informazioni sono incomplete o false | P1 | ◐ |
| Conformità by design e informazione sui prodotti illegali | Artt. 31-32 | In caso di apertura ai professionisti: campi obbligatori (identificazione del prodotto, etichettatura) e informazione agli acquirenti sui prodotti illegali venduti negli ultimi 6 mesi | P2 | ☐ |
| Relazioni di trasparenza | Art. 15; art. 24 | Esenti le micro e piccole imprese (art. 15, par. 2). Pubblicare comunque gli utenti attivi medi se richiesto (art. 24, par. 2-3, da verificare) | P2 | ☐ |
| Sicurezza dei prodotti nei marketplace | Reg. UE 2023/988 art. 22 | Se ci sono venditori professionali: punto di contatto, registrazione sul Safety Gate, rimozione entro 2 giorni lavorativi degli ordini delle autorità | P2 | ☐ |
| Rapporti P2B | Reg. UE 2019/1150 | Applicabile solo con utenti commerciali (venditori professionali o brand partner che vendono tramite la piattaforma). Termini P2B, motivazione delle sospensioni, reclami | P2 | ☐ |

## 10. Live shopping e comunicazione commerciale

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Riconoscibilità della pubblicità | Artt. 20-23 Cod. Consumo (in particolare art. 23, c. 1, lett. m); D.lgs. 145/2007; Codice di Autodisciplina IAP (art. 7) e Digital Chart IAP | Indicazione "Pubblicità" o "Live sponsorizzata con [brand]" visibile per tutta la durata e nelle registrazioni. Dichiarare i rapporti con brand e allevatori | P0 | ◐ |
| Influencer | AGCOM delibera n. 7/24/CONS (linee guida) e successivo Codice di condotta (delibera n. 197/25/CONS, **da verificare** ambito e soglie) | Se gli ospiti sono influencer "rilevanti" secondo le soglie AGCOM, si applicano obblighi TUSMA (D.lgs. 208/2021). Clausole contrattuali sul rispetto delle regole | P1 | ☐ |
| Natura di servizio di media audiovisivo | D.lgs. 208/2021 (TUSMA) | Valutare (probabilmente no, trattandosi di contenuti accessori all'e-commerce riservati agli iscritti) se le live configurino un servizio di media audiovisivo a richiesta. **Da verificare** | P2 | ☐ |
| Claim sui mangimi | Reg. CE 767/2009 artt. 11 e 13 | Vietati i claim di prevenzione o cura delle malattie. I claim devono essere supportati da evidenze. Briefing scritto agli ospiti con revisione dei contenuti | P0 | ☐ |
| Veterinari ed esperti | Codice deontologico dei medici veterinari (FNOVI) | Nessuna diagnosi o prescrizione in live. Disclaimer. Verificare i limiti deontologici alla partecipazione di veterinari a eventi commerciali (pubblicità sanitaria) | P1 | ◐ |
| Prezzi in live | Art. 17-bis Cod. Consumo | Gli sconti mostrati in live seguono le regole Omnibus | P0 | ☐ |
| Divieto di vendita di animali in live | Policy aziendale; vedi §16 | Clausola contrattuale con gli allevatori e moderazione attiva | P0 | ◐ |
| Diritti d'immagine e registrazioni | Artt. 96-97 L. 633/1941; GDPR | Liberatorie per ospiti e conduttori. Consenso degli utenti in video. Tutela dei minori | P0 | ◐ |
| Musica e diritti d'autore | L. 633/1941 | Licenze SIAE/SCF o musica royalty-free per le live | P2 | ☐ |

## 11. Telefonate, agente vocale e telemarketing

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Informativa e disclosure all'inizio della chiamata | Art. 13 GDPR; art. 50 AI Act | Messaggio iniziale: IA, registrazione, finalità, link all'informativa, opzione operatore | P0 | ◐ |
| Registrazione delle chiamate | GDPR artt. 5-6; prassi del Garante sui call center (da verificare) | Base giuridica documentata (consenso per conservare l'audio o legittimo interesse con LIA). Retention breve (es. 30 giorni). Possibilità di chiamata senza registrazione | P0 | ☐ |
| Chiamate in uscita (eventuali) | Art. 130 Codice privacy; L. 5/2018; **Registro Pubblico delle Opposizioni** (D.P.R. 178/2010 mod. D.P.R. 26/2022, esteso ai cellulari dal 27/7/2022); Codice di condotta per il telemarketing approvato dal Garante (da verificare gli estremi) | Oggi l'agente gestisce solo chiamate **in entrata**. Le chiamate promozionali in uscita richiedono consenso e consultazione del RPO. Le chiamate **automatizzate senza operatore** (es. un agente vocale IA in uscita) richiedono il **consenso preventivo** (art. 130, c. 1). Raccomandazione: **non** attivare l'outbound con IA | P0 | ◐ |
| Numerazione e CLI | Regole AGCOM su numerazione e contrasto allo spoofing (da verificare) | Usare numeri italiani regolarmente assegnati (Twilio). Verificare gli obblighi AGCOM | P2 | ☐ |
| Pagamenti al telefono | PCI DSS; GDPR | Non raccogliere dati di carta tramite l'agente vocale. Usare solo link di pagamento | P0 | ☐ |

## 12. Pagamenti

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Autenticazione forte (SCA) | Dir. (UE) 2015/2366 (PSD2); D.lgs. 218/2017; Reg. delegato (UE) 2018/389 | Gestita da Stripe e PayPal (3-D Secure). Per Plus: SCA alla sottoscrizione, poi addebiti come transazioni avviate dall'esercente (MIT). Gestire gli addebiti che richiedono una nuova autenticazione | P0 | ☐ |
| Divieto di surcharge | Art. 62 Cod. Consumo | Nessun supplemento per carta o PayPal. Valutare il contrassegno (§4) | P0 | ◐ |
| Contrassegno e contanti | Limite all'uso del contante (art. 49 D.lgs. 231/2007, soglia 5.000 € dal 2023) | Fissare un importo massimo per gli ordini in contrassegno. Contratto con il corriere per l'incasso e il riversamento | P1 | ☐ |
| PCI DSS | Standard contrattuale dei circuiti | Usare campi di pagamento ospitati (Stripe Elements o Checkout). Questionario SAQ A | P1 | ☐ |
| Regole dei circuiti per prove gratuite e abbonamenti | Regole Visa e Mastercard (da verificare) | Promemoria prima della fine della prova, descrittore chiaro sull'estratto conto, link di disdetta | P0 | ☐ |
| Coupon e antifrode | GDPR art. 6.1.f | Regole antifrode documentate, con revisione umana sugli ordini bloccati | P2 | ☐ |

## 13. Accessibilità

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| European Accessibility Act | Dir. (UE) 2019/882; **D.lgs. 82/2022**, applicabile dal **28 giugno 2025** ai servizi di commercio elettronico | Requisiti di accessibilità (standard EN 301 549 / WCAG 2.1 AA), informazioni sull'accessibilità del servizio e dichiarazione. **Esenzione**: le microimprese che forniscono servizi (meno di 10 dipendenti e fatturato o bilancio fino a 2 M€) sono esenti (**da verificare** l'applicazione). Raccomandazione: conformarsi comunque fin dal lancio, perché l'esenzione cessa con la crescita e l'accessibilità è anche un fattore commerciale. Vigilanza: AgID | P1 (P0 se non microimpresa) | ☐ |
| Legge Stanca | L. 4/2004, art. 3, c. 1-bis (D.L. 76/2020) | Per i privati si applica solo con un fatturato medio superiore a 500 M€ nell'ultimo triennio: **non applicabile** al lancio | — | ☑ |
| Accessibilità di live, chat e voce | EAA; buona prassi | Sottotitoli nelle live registrate. Chat usabile con screen reader. Alternativa testuale (chat ed e-mail) all'assistenza vocale | P2 | ☐ |

## 14. Marketplace di scambio di alimenti tra privati: legalità e rischi

### 14.1 Inquadramento
- **Mangimi e sicurezza:** il pet food è "mangime" (Reg. CE 767/2009; Reg. CE 178/2002 art. 3, n. 4). Il privato che occasionalmente regala o scambia una confezione sigillata **non è, di regola, un "operatore del settore dei mangimi"** (la nozione richiede un'"impresa", anche senza scopo di lucro). Lo scambio occasionale tra privati non è quindi vietato in sé (**da verificare** con il legale e l'ASL).
- **Ruolo di Animol:** finché resta intermediario neutro (hosting), Animol non diventa OSM. Lo diventerebbe se **gestisse fisicamente i prodotti** (raccolta, stoccaggio, spedizione) e in quel caso si applicherebbero registrazione, tracciabilità e responsabilità da distributore.
- **Responsabilità civile:** tra privati non si applica il Codice del Consumo (né garanzia di conformità né recesso). Si applicano le norme del codice civile (donazione, art. 798 c.c.; permuta, art. 1552 c.c.). Animol può rispondere ex art. 2043 c.c. per negligenza propria (es. mancata rimozione di annunci di prodotti richiamati segnalati) e perde l'esenzione dell'art. 6 DSA se assume un ruolo attivo.
- **Pratiche commerciali:** presentare lo scambio come vantaggio "sicuro" di Plus a pagamento crea aspettative. Ogni affermazione sulla sicurezza deve essere veritiera (art. 21 Cod. Consumo).
- **Fisco e DAC7:** in assenza di corrispettivo il rischio è basso. Con pagamenti o rimborsi tra utenti scattano DAC7 e il rischio di attività commerciale non dichiarata degli utenti abituali.

### 14.2 Rischi specifici
| Rischio | Probabilità | Impatto | Note |
|---|---|---|---|
| Prodotto mal conservato (calore, umidità, micotossine, infestanti) nonostante il sigillo integro | Media | Alto (salute animale, reputazione) | Il sigillo non garantisce le condizioni di conservazione |
| Prodotto oggetto di richiamo | Bassa-media | Alto | Serve un registro di lotto e scadenza per gli avvisi (Regolamento C.6) |
| Manomissione o contraffazione | Bassa | Alto | Le foto di sigillo e lotto non sono una prova certa |
| Diete veterinarie usate senza controllo | Media | Medio-alto | Vietate nel regolamento |
| Scambio di farmaci o antiparassitari mascherati da "accessori" | Media | Alto | Moderazione e filtri sulle parole chiave |
| Annunci di animali vivi o cucciolate | Media | Alto (reati, benessere, reputazione) | Divieto assoluto e moderazione proattiva |
| Utenti professionali mascherati | Media | Medio | Art. 30 DSA, soglie di volume |
| Perdita dell'esenzione dell'hosting per ruolo attivo | Bassa-media | Medio | Non "certificare" i prodotti degli utenti |

### 14.3 Alternative più sicure (raccomandate)
1. **"Dona al rifugio" (consigliata per il lancio):** gli iscritti donano confezioni sigillate e non scadute a canili e gattili convenzionati, con consegna diretta al rifugio o tramite punti di raccolta. Oppure Animol stessa dona le proprie scorte vicine alla scadenza o con confezione esterna danneggiata. Vantaggi: impatto sociale e minore rischio C2C. Verifiche: L. 166/2016, accordi scritti con i rifugi, eventuale qualifica di OSM se Animol raccoglie e immagazzina.
2. **Rivendita solo da parte di venditori verificati:** marketplace aperto solo a professionisti registrati (P.IVA, eventuale registrazione OSM) con KYBC ex art. 30 DSA, termini P2B, GPSR art. 22 e DAC7. Più oneroso, ma con responsabilità chiare e garanzie per il consumatore.
3. **"Ricompra Animol" (reverse logistics):** Animol riprende le confezioni sigillate, le ispeziona e le rivende come seconda scelta con piena garanzia. Animol resta l'unico venditore e le tutele restano integre (richiede SOP di ispezione e tracciabilità del lotto).
4. **Scambio C2C limitato ai soli accessori** (cucce, trasportini, giochi), escludendo gli alimenti: rischio sanitario molto minore, con i requisiti GPSR per i prodotti usati da valutare.

**Raccomandazione compliance:** lanciare Plus con l'opzione 1 e lo scambio dei soli accessori (opzione 4). Rinviare lo scambio di alimenti tra privati a dopo un parere legale scritto e un confronto con l'ASL. Se si decide comunque di procedere: solo donazioni senza corrispettivo, regole del Regolamento Plus Parte C, registro di lotto e scadenza, moderazione preventiva degli annunci alimentari.

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Decisione sul modello del marketplace | Reg. 178/2002; DSA; Cod. Consumo; D.lgs. 32/2023 | Parere legale scritto più interpello all'ASL. Scegliere tra le opzioni 1-4 | P0 | ☐ |
| Regole sui contenuti vietati e ammessi | DSA art. 14 | Regolamento Plus Parte C (bozza pronta) | P0 | ◐ |
| Moderazione preventiva degli annunci alimentari | DSA artt. 7, 16 | Revisione degli annunci di cibo prima della pubblicazione (foto di sigillo, lotto e scadenza) | P0 | ☐ |
| Procedura di richiamo | Reg. 178/2002 art. 20 (per analogia) | Integrare il feed dei richiami (Ministero della Salute, produttori) e avvisare i riceventi | P1 | ☐ |

## 15. Imballaggi, RAEE, pile e ambiente

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Adesione al CONAI | Art. 221 D.lgs. 152/2006 | Gli "utilizzatori" di imballaggi (inclusi i commercianti e chi spedisce con imballaggi propri) devono aderire al CONAI. Il contributo ambientale viene di norma applicato a monte dal fornitore degli imballaggi (verificare le procedure semplificate) | P0 | ☐ |
| Etichettatura ambientale degli imballaggi | Art. 219, c. 5 D.lgs. 152/2006 (D.lgs. 116/2020) | Codifica dei materiali (Decisione 97/129/CE) e indicazioni per la raccolta sugli imballaggi di spedizione propri (anche digitali, ove ammesso) | P1 | ☐ |
| Regolamento UE imballaggi (PPWR) | Reg. (UE) 2025/40, applicabile in generale dal **12/8/2026** con obblighi scaglionati (da verificare: rapporto di spazio vuoto massimo del 50% per gli imballaggi di e-commerce dal 2030) | Scegliere scatole dimensionate. Monitorare gli atti di esecuzione | P2 | ☐ |
| EPR negli altri Stati UE | Normative nazionali (es. VerpackG in Germania, Triman e REP in Francia) | Se si spedisce all'estero: registrazioni EPR per imballaggi, RAEE e pile nei Paesi di destinazione o mandatario | P2 | ☐ |
| RAEE (accessori elettrici: pompe, filtri, riscaldatori, luci per acquari, fontanelle) | D.lgs. 49/2014 (artt. 11-12); D.M. 65/2010 | Ritiro "uno contro uno" anche per le vendite a distanza. Iscrizione dei distributori all'Albo Nazionale Gestori Ambientali (da verificare la procedura). Se Animol importa con proprio marchio diventa **produttore di AEE**: iscrizione al Registro AEE e adesione a un sistema collettivo | P1 | ☐ |
| Pile e batterie | Reg. (UE) 2023/1542; D.lgs. 188/2008 (in parte sostituito) | Se si vendono prodotti con batterie (es. collari luminosi, giochi): obblighi di ritiro e informazione per i distributori | P2 | ☐ |
| Claim ambientali | Art. 21 Cod. Consumo; Dir. (UE) 2024/825 (da recepire e applicare dal 27/9/2026, da verificare il recepimento italiano) | Niente claim generici ("eco", "green") senza prove. Per gli imballaggi "riciclabili" servono evidenze | P1 | ☐ |

## 16. Benessere animale

| Obbligo | Norma | Cosa deve fare Animol Life | Priorità | Stato |
|---|---|---|---|---|
| Nessuna vendita di animali vivi | Policy aziendale; Reg. (UE) 2016/429 (Animal Health Law); D.lgs. 134/2022 e 135/2022; L. 201/2010 (traffico illecito di animali da compagnia); artt. 544-bis ss. e 727 c.p. | Animol **non vende né intermedia animali vivi** (pesci, uccelli, roditori inclusi), né in negozio né in live né nel marketplace. Filtri e moderazione. Clausole nei contratti con gli allevatori | P0 | ◐ |
| Futuro regolamento UE su benessere e tracciabilità di cani e gatti | Proposta COM(2023) 769 (accordo politico raggiunto, **da verificare** adozione e date) | Monitorare gli obblighi per le piattaforme online relativi agli annunci di cani e gatti (verifica dell'identità degli inserzionisti, tracciabilità) se in futuro si ospitano contenuti di allevatori | P2 | ☐ |
| Specie protette | Reg. CE 338/97 (CITES); L. 150/1992 | Divieto di annunci di specie protette e dei loro prodotti (piume, parti) | P1 | ◐ |
| Accessori vietati o limitati | Normative regionali, giurisprudenza su art. 727 c.p. (da verificare) | Valutare l'esclusione dal catalogo di collari elettrici o a strozzo e di altri strumenti controversi | P1 | ☐ |
| Contenuti video con animali | Policy aziendale; art. 544-ter c.p. | Linee guida per le live: niente stress o maltrattamenti, animali non usati come "oggetti" promozionali | P1 | ◐ |

---

## 17. Piano d'azione pre-lancio (P0 in sintesi)

1. Società, P.IVA, ATECO, SCIA e-commerce. Dati in note legali **[DA COMPLETARE]**.
2. Interpello all'ASL sulla registrazione OSM. Procedura di tracciabilità e richiamo.
3. Validazione legale di T&C, recesso, Regolamento Plus, privacy, cookie e trasparenza IA (bozze in `public/legal/`).
4. Checkout: prezzo al kg, Omnibus a 30 giorni, pulsante d'ordine, nessun surcharge, funzione di recesso online.
5. Plus: pulsante di attivazione esplicito, promemoria della prova e del rinnovo, disdetta in 2 clic, recesso.
6. GDPR: registro dei trattamenti, DPIA (voce, chat, profilazione), DPA e SCC/TIA con Anthropic, Twilio e altri fornitori, valutazione DPO, CMP dei cookie.
7. AI: disclosure in chat e al telefono, guardrail veterinari, escalation umana, formazione art. 4.
8. DSA: pulsante Segnala, statement of reasons, punti di contatto, moderazione delle live.
9. Marketplace: decisione sul modello (raccomandato: donazioni ai rifugi più accessori) prima dell'apertura.
10. Live: contratti con brand e allevatori (claim, pubblicità, divieto di animali), etichetta "Pubblicità", liberatorie.
11. CONAI. Classificazione degli antiparassitari (biocidi o medicinali veterinari) ed esclusione dei medicinali.

> **Ricorda:** tutti i testi e le valutazioni di questo documento devono essere **validati da un avvocato** prima della pubblicazione o del lancio. I riferimenti marcati "da verificare" richiedono un controllo sul testo vigente (Normattiva, EUR-Lex) alla data del lancio.
