# Animol Life - resoconto QA e integrazione

Data: 8 novembre 2026. Ambito: vetrina `public/index.html` (con `products.json`, `legal/*.html`, `plus/index.html`) e backend Express `server/` in modalità demo, senza chiavi.

## Come rieseguire i test

```bash
cd animol-life/server && npm test            # 48 test node:test (erano 41)
node animol-life/tests/e2e.cjs               # test end-to-end Playwright: 446 verifiche
E2E_SCREENSHOTS=1 node animol-life/tests/e2e.cjs     # rigenera anche docs/screenshots/
E2E_ONLY=plus,checkout E2E_MODE=server node animol-life/tests/e2e.cjs   # solo alcune suite
```

Lo script e2e avvia e chiude da solo il server reale (porta 3000, dati in una cartella temporanea) e un server statico senza backend (`python3 -m http.server` su 8765, dentro `public/`). Se una verifica fallisce esce con codice 1. Con `E2E_DEBUG=1` salva uno screenshot di ogni errore.

## Cosa è stato testato

Lo stesso set di verifiche gira su due origini: con il **server reale** su `http://localhost:3000` e con il **file servito in modo statico**, senza API, dove la pagina usa il fallback locale.

| Area | Dettaglio |
|---|---|
| Viewport e temi | Desktop 1440 px e mobile 390 px, ciascuno in tema chiaro e scuro (da `prefers-color-scheme`). Nessuno scroll orizzontale |
| Catalogo | 24 prodotti. Ricerca (con risultati e senza), filtro per categoria, filtro "solo offerte", ordinamento per prezzo crescente e decrescente e per valutazione |
| Preferiti | Toggle, contatore e persistenza dopo il ricaricamento |
| Scheda prodotto | Apertura, cambio variante con aggiornamento del prezzo, quantità, aggiunta al carrello con variante e quantità giuste, chiusura con Esc, nota onesta sulle recensioni |
| Carrello | Pulsanti +/−, limite di 20 pezzi, barra della spedizione gratuita con l'importo mancante esatto, soglia dei 49 € |
| Coupon | ANIMOL10 (−10%) e CUCCIOLO5 (−5%) anche scritti in minuscolo, codice non valido rifiutato, importi confrontati con un calcolo di riferimento indipendente |
| Checkout | CAP di 4 cifre e CAP 99999 rifiutati (anche dal server). **3 spedizioni × 3 pagamenti = 9 ordini**: il totale mostrato prima dell'invio, il totale restituito dal server e quello nella conferma coincidono con il riferimento. Contrassegno senza supplementi e disattivato sopra i 500 € |
| Storico ordini | 9 ordini in ordine cronologico, persistenza, stato ordine via `/api/order-status` con l'email |
| Assistente IA | Dichiarazione di IA. Risposte in italiano su spedizioni (4,90 / 9,90 / 2,90 €, soglia 49 €) e su coupon. Schede prodotto con pulsante "Aggiungi" funzionante. Domanda veterinaria rifiutata con rimando al veterinario |
| Animol Plus | Marketplace e live bloccati senza Plus. Attivazione demo con email (validata) via `/api/plus/subscribe`. Area Plus attiva, live sbloccate. Checkout con la stessa email: il server riconosce il membro (`plusApplied`) e il totale è identico a quello della pagina, anche con l'express. Disdetta con `{email}`: dopo la disdetta il server non applica più lo sconto. Ritorno da Stripe (`/plus/?checkout=success`) |
| Marketplace | Farmaci e antiparassitari vietati, scadenza minima di 30 giorni, tre conferme obbligatorie, pubblicazione di un annuncio valido |
| Cookie | Al primo accesso nessun cookie, nessun localStorage e nessun sessionStorage. Banner visibile; "Rifiuta" salva solo la scelta; il banner non viene riproposto; le preferenze si riaprono dal footer |
| Link | Tutti i link interni della home e delle pagine legali rispondono 200 (nessun 404), `/plus/` compreso |
| Tastiera | Il primo Tab porta allo skip link verso `#main`; Invio apre la scheda; il focus resta nel dialog; Esc chiude; il focus è visibile |
| Console | Nessun errore in console e nessun errore di pagina con il server. Nella versione statica sono ammessi solo i 404/501 delle chiamate `/api/*`, cioè il fallback previsto |
| API e voce | `GET /api/health` restituisce 24 prodotti con fonte `products.json`. `/voice/incoming` e `/voice/respond` restituiscono TwiML valido con `language="it-IT"` e annuncio IA. `shippingMethod` non valido produce 400 |

## Bug trovati e corretti

### Incongruenze tra pagina e server (il server fa fede sui soldi)

1. **Metodi di spedizione.** Il server conosceva solo "gratis da 49 € altrimenti 4,90 €". Ora accetta `shippingMethod` con i valori `standard` (4,90 €, gratis da 49 € dopo gli sconti o con Plus), `express` (9,90 €, mai gratis) e `point` (2,90 €, gratis da 49 € o con Plus). Il default è `standard`, un valore diverso restituisce 400. La regola sta in `SHIPPING_METHODS` e `computeTotals` (`server/src/policies.js`); anche `/api/cart/quote` accetta il campo. La risposta dell'ordine include `shippingMethod`, `paymentMethod` e `plusApplied`. La pagina invia `shippingMethod` con gli stessi valori.
2. **Formula dello sconto Plus diversa.** La pagina calcolava il −5% Plus dopo il coupon, in cascata; il server lo calcola sul subtotale. La pagina ora calcola in centesimi con la stessa formula del server, quindi il totale mostrato coincide al centesimo.
3. **Contrassegno.** Non aggiunge mai costi, con qualsiasi spedizione (test dedicato). Il limite di 500 € indicato nella pagina ora vale anche sul server. Nella pagina il limite si calcola sulla spedizione scelta, e se il totale lo supera il metodo torna su carta.
4. **Quantità.** La pagina permetteva fino a 99 pezzi per riga, il server ne accetta 20: un ordine da più di 20 pezzi falliva. La pagina ora usa lo stesso limite di 20 nel carrello e nella scheda.
5. **Attivazione Plus con il server rotta.** Con il server, la pagina seguiva l'URL demo `/plus/?checkout=demo`, che reindirizzava alla home senza attivare nulla, e non inviava l'email. Ora un dialog chiede l'email e la invia con il piano: in demo il server registra il membro in prova e la pagina attiva i vantaggi senza cambiare pagina. Al checkout l'email Plus viene precompilata. La conferma mostra sempre il totale del server, con una nota se differisce dalla stima del carrello (per esempio quando si ordina con un'email diversa da quella dell'abbonamento).
6. **Disdetta Plus.** La pagina chiamava `POST /api/plus/cancel` con `{}`, che produceva 400. Ora invia `{email}`. In demo, senza Stripe, i membri creati dalla demo vengono disdetti subito (`{canceled:true}`), così pagina e server restano allineati. Per gli abbonamenti reali resta la conferma via link email, e la pagina avvisa di controllare la posta.
7. **Ritorno da Stripe.** `plus/index.html` perdeva i parametri `?checkout=success|cancel`. Ora li conserva e la home attiva Plus con l'email salvata prima del pagamento.

### Dichiarazioni non veritiere (Omnibus, art. 21-23 Cod. Consumo)

8. Nella scheda prodotto c'era scritto "Verifichiamo che ogni recensione corrisponda a un ordine reale", che è falso. È stato sostituito con "Recensioni di esempio — il sistema di recensioni verificate sarà attivato al lancio…", e il titolo è diventato "Valutazioni (esempio)".
9. Hero: "4,7/5 da oltre 15.000 recensioni" è stato sostituito con "49 € soglia spedizione gratuita". Il titolo "a casa in 24/48h" è diventato "a casa tua anche in 24/48h", perché lo standard richiede 3-5 giorni.
10. Rimossi i 24 `aggregateRating` fittizi dai dati strutturati JSON-LD, che sarebbero recensioni false per i motori di ricerca.
11. Il badge "Più venduto", l'ordinamento "Più venduti" e "N venduti" si basavano su dati di esempio: ora si chiamano "In evidenza" e il conteggio delle vendite non viene più mostrato.
12. "Diritto di recesso garantito" presentava un diritto di legge come se fosse un vantaggio del negozio (art. 23 lett. l). Ora dice "diritto di recesso previsto dalla legge".
13. Il marketplace prometteva "scambi tra persone verificate" e "annuncio verificato dai moderatori", ma non esiste nessuna verifica. I testi ora dicono la verità (annuncio demo salvato solo sul dispositivo).
14. Orari dell'assistenza: la pagina diceva "lun–sab 9–19", il server e l'agente vocale "lun–ven 9–18". La pagina è stata allineata a "lun–ven 9–18".
15. Nei termini di vendita sono state inserite le tariffe di spedizione e il limite del contrassegno a 500 €, al posto dei segnaposto: ora coincidono con quelli applicati.

La ricerca di "verificat", "garantit", "migliore" e "n.1" non trova altre dichiarazioni: le occorrenze rimaste sono note legali corrette o testo interno.

### Verifiche senza modifiche

- `products.json` e il catalogo incluso in `index.html` coincidono: 24 prodotti, stessi id, etichette delle varianti e prezzi. Il server legge `products.json`. Un nuovo test (`server/test/misc.test.js`) controlla che restino allineati.
- Webhook vocali: TwiML valido in it-IT, annuncio IA e consenso alla trascrizione.

## Test aggiunti al server

`npm test` è passato da 41 a 48 test, tutti superati:

- prezzi e soglie dei 3 metodi di spedizione;
- soglia calcolata dopo gli sconti e metodo non valido che restituisce 400;
- Plus con standard e point gratis ed express a pagamento, con coupon e Plus sommati sul subtotale;
- contrassegno senza supplementi su ogni spedizione e limite di 500 €;
- `/api/cart/quote` con `shippingMethod`;
- disdetta immediata in demo;
- coerenza del catalogo reale tra `products.json` e `index.html`.

Il test della disdetta via link email ora usa un membro non demo.

## Limiti che restano

- **Plus si riconosce solo dall'email**, senza login. Chiunque conosca l'email di un membro ne ottiene i vantaggi, e in demo può disdirlo. Serve un magic link o un account prima del lancio.
- **Recensioni, valutazioni e "In evidenza" sono dati di esempio.** Prima del lancio servono un sistema di recensioni legate agli ordini e la relativa informativa (art. 22 c. 4-bis).
- **Live, marketplace, box mensile e storico ordini** sono salvati solo sul dispositivo (localStorage). Le dirette del server sono dati demo e non ce n'è nessuna in corso, quindi con il server non si può entrare in una stanza live; senza server sì.
- **Pagamenti:** carta e PayPal non sono collegati. L'ordine resta in stato `pending` e non c'è nessun redirect a un gateway.
- I **testi legali** sono ancora bozze con diversi `[DA COMPLETARE]` e `[DA VERIFICARE]`, per esempio dati societari, area di consegna e "area personale" citata nei termini ma inesistente. Vanno rivisti da un legale.
- Il **fallback dell'assistente** lato server usa parole chiave: a volte propone prodotti poco pertinenti, per esempio cibo umido per una richiesta di crocchette. Con `ANTHROPIC_API_KEY` si usa Claude.
- La versione statica, senza server, registra in console i 404/501 delle chiamate `/api/*`. Sono attesi, perché la pagina passa alla modalità dimostrativa.

## Screenshot

In `docs/screenshots/`, con deviceScaleFactor 2 (2,7 MB in tutto):

- `home-desktop-light.png`: home, desktop 1440, tema chiaro;
- `catalogo-desktop-light.png`: catalogo, desktop 1440, tema chiaro;
- `home-mobile-dark.png`: home, mobile 390, tema scuro.
