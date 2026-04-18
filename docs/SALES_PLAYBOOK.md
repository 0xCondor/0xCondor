# Condor EASM — Sales Playbook

## Obiettivo 5 mesi: 20 clienti paganti, €6-15k MRR

---

## ICP (Ideal Customer Profile) — in ordine di priorità

### 1. MSP italiani 5-50 dipendenti (focus primario)
- Portfolio: 30-200 clienti PMI
- Dolore: serve un nuovo servizio ricorrente da vendere, no R&D team
- Budget: €200-€800/mese su tool software
- Acquirente: founder / CTO / head of MSP ops
- Ciclo decisionale: 2-4 settimane
- Canale: LinkedIn Sales Navigator, AssoIT, eventi regionali

### 2. vCISO / consulenti freelance
- Portfolio: 3-10 clienti retainer
- Dolore: deve giustificare retainer mensili
- Budget: €50-€200/mese
- Ciclo: 1-2 settimane
- Canale: Twitter/X infosec IT, Telegram cyber

### 3. Auditor / compliance partner
- Dolore: controlli continuativi per audit
- Ciclo: lungo (partnership più che vendita diretta)
- Canale: diretto, eventi CLUSIT

---

## Cadenza outreach (14 giorni, 5 touch)

**Giorno 1** — Cold email con **gift upfront**: ho scansionato 3 domini di un tuo cliente pubblico, ecco il mini-report
**Giorno 3** — LinkedIn connect request con nota personalizzata (2 righe)
**Giorno 6** — Follow-up email: case study MSP simile + metrica margine (70%)
**Giorno 10** — LinkedIn message: 1 domanda diretta ("quanto fatturi oggi in continuous monitoring?")
**Giorno 14** — Break-up email: "chiudo la tua pratica, se cambi idea risponde in 2h"

Conversione attesa: 3-5% email → demo, 20-30% demo → trial, 40-50% trial → pay.

---

## Email template

### Template A — Cold outreach con gift

```
Oggetto: [Cliente] ha 3 domini esposti (mini-report gratis)

Ciao [Nome],

ho visto che [NomeMSP] ha [NomeCliente] tra i clienti citati sul vostro
sito. Ho fatto un'occhiata veloce in OSINT pubblico e ho trovato:

- 3 sottodomini con certificati SSL scaduti da 2+ settimane
- 1 pannello phpMyAdmin raggiungibile senza VPN
- DMARC in p=none (qualunque spammer può inviare email a nome del cliente)

Ti allego il mini-report PDF (2 pagine). Zero pitch, te lo dovevo.

Se sei aperto, sto costruendo Condor EASM proprio per fare questo
automaticamente ogni settimana su tutti i tuoi clienti, con dashboard
multi-tenant e PDF brandizzato col tuo logo.

Founder Plan per i primi 20 MSP: 50% lifetime, bloccato per sempre.
15 minuti di demo questa settimana?

[Nome] — condor-easm.example
```

### Template B — Follow-up

```
Oggetto: Re: [Cliente] ha 3 domini esposti

[Nome], ti riscrivo perché ho parlato con [altro MSP simile] e
abbiamo calcolato che al piano MSP a €299/mese (20 clienti) il costo
è €15/cliente. Se rivendi a €50/mese il margine è 70%.

Se preferisci, posso mandarti un video di 3 minuti che mostra la
dashboard invece di fare una call. Rispondi OK e te lo invio.
```

### Template C — Break-up

```
Oggetto: Chiudo la pratica [NomeMSP]

Ciao [Nome], ti ho scritto 3 volte e non ho ricevuto risposta — chiudo
la pratica, nessun problema. Se cambi idea rispondi a questa mail
(non ti rispondo entro 2 ore se non sono in vacanza).

Due cose utili anche senza Condor:
1. Check DMARC dei tuoi clienti con dmarcian (gratis fino a 3 domini)
2. Certificati scadenti con https://www.ssllabs.com/ssltest/

Buona fortuna.
[Nome]
```

---

## Discovery call script (25 min)

**0:00–3:00 — Contesto**
- Ringrazia, tempo box (25 min)
- Chi sei: ex-pentester, background bug bounty, costruisco Condor perché gli MSP italiani mi chiedevano uno strumento così e non esisteva a prezzo accessibile
- Obiettivo della call: capire se ha senso per lui

**3:00–12:00 — Domande (ascolto 80%)**
1. Quanti clienti attivi hai oggi?
2. Che mix di servizi cyber vendi? (assessment puntuali, managed, consulenza)
3. Come monitori oggi l'esposizione esterna?
4. Hai mai avuto un cliente che ti ha chiesto "ma l'avete controllato?" dopo un incidente?
5. Usi già qualche tool EASM o rating esterno?
6. Che prezzo ricorrente mensile riesci a far accettare a una PMI di 30-50 dip per un servizio cyber?

**12:00–18:00 — Demo (NON tour, solo ciò che risolve i SUOI dolori)**
- Se dolore "non so cosa mi sono dimenticato": mostra discovery sottodomini su cliente reale
- Se dolore "devo giustificare canone": mostra dashboard multi-tenant + PDF brandizzato
- Se dolore "DMARC non capisco": mostra modulo email posture con spiegazione rimediazione

**18:00–22:00 — Proposta**
- "Per te ha senso il piano X a €Y. Fanno €Z/cliente. Se rivendi a €W margine N%."
- "Primi 20 clienti sono in Founder Plan 50% lifetime. Ne mancano [X]."

**22:00–25:00 — Closing**
Non dire mai "ti mando info". Sempre:
- Opzione A: "Ti creo l'account ora e lunedì aggiungiamo 2 tuoi clienti pilota insieme"
- Opzione B: "Ti mando PDF di riepilogo + pricing e ci risentiamo giovedì alle 15, ok?"

---

## Demo flow 15 min (standalone)

| Minuto | Cosa | Focus |
|---|---|---|
| 0:00–1:00 | Intro personale + 1 frase prodotto | Credibilità tecnica |
| 1:00–3:00 | Problema in 1 slide: "cosa vede l'attaccante?" | Dolore |
| 3:00–5:00 | Aggiunta dominio live + DNS TXT verification | Serietà legale |
| 5:00–8:00 | Scan live con findings reali | Wow factor |
| 8:00–11:00 | Dashboard MSP, diff settimanale, score trend | Valore ricorrente |
| 11:00–13:00 | Generazione PDF brandizzato | Pronto da rivendere |
| 13:00–14:00 | Pricing + Founder Plan | Urgenza |
| 14:00–15:00 | Trial account creato live | Chiusura |

---

## KPI settimanali

| Settimana | Email inviate | LinkedIn | Meeting | Demo | Trial | Paying |
|---|---|---|---|---|---|---|
| W1 | 50 | 50 | 3 | 2 | 1 | 0 |
| W4 | 200 | 150 | 8 | 5 | 3 | 1 |
| W8 | 400 | 300 | 15 | 10 | 6 | 3 |
| W12 | 600 | 450 | 25 | 18 | 10 | 7 |
| W20 | 1000 | 800 | 50 | 35 | 20 | 20 |

---

## CRM setup (HubSpot free)

Pipeline stages:
1. **Lead** — identificato, non ancora contattato
2. **Contacted** — primo touch inviato
3. **Engaged** — ha risposto o clickato
4. **Meeting booked** — demo/discovery fissata
5. **Demo done** — demo fatta, in valutazione
6. **Trial** — account trial attivo
7. **Proposal** — proposta inviata
8. **Closed Won** / **Closed Lost**

Automazioni:
- Lead score +10 se apre email 2x
- Task reminder a te se "Engaged" senza aggiornamento da 4 giorni
- Sequenza email automatica 5-touch per stage "Contacted"
