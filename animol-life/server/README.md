# Animol Life - server

Backend Node.js (Express) del negozio online **Animol Life**: serve il sito statico di `../public` (e la landing B2B `../vendita` su `/vendita/`), espone le API del negozio, gli **account clienti**, i **pagamenti** (Stripe Checkout, PayPal, contrassegno), il **pannello di amministrazione** su `/admin`, l'assistente di shopping con IA (Claude), l'agente vocale telefonico (Twilio), l'abbonamento **Animol Plus** e i job di automazione.

Tutto funziona **senza chiavi in modalità demo**: l'assistente usa risposte a parole chiave, i pagamenti con carta e PayPal passano da una pagina **simulata ed etichettata DEMO**, Plus si attiva senza addebiti, le email vengono solo registrate nel log (con i link stampati in console).

## Requisiti e avvio

- Node.js **20.12+** (testato con Node 22)
- `better-sqlite3` installa binari precompilati per Linux, macOS e Windows (x64/arm64); su piattaforme senza binari `npm install` lo compila e servono `python3`, `make` e un compilatore C++

```bash
cd animol-life/server
npm install
cp .env.example .env      # facoltativo: compila solo ciò che ti serve
npm start                 # http://localhost:3000
npm run dev               # riavvio automatico durante lo sviluppo
npm test                  # 96 test node:test, tutti in modalità demo
```

### Dati

- **Database SQLite** `data/animol.db` (libreria `better-sqlite3`, modalità WAL): account, sessioni, token monouso, ordini, prodotti, storico prezzi, coupon, contatti B2B, registro azioni admin, eventi webhook già elaborati. Lo schema si crea e si aggiorna da solo all'avvio (`PRAGMA user_version`).
- **File JSON** (scrittura atomica) in `data/`: iscritti newsletter, membri Plus, carrelli salvati, inventario, report, trascrizioni.
- Tutto l'accesso ai dati relazionali passa da `src/repo.js`: per usare PostgreSQL o MySQL basta reimplementare quell'interfaccia, il resto del server non contiene SQL.
- La cartella `data/` è esclusa da git. In produzione va su un disco persistente **con backup** (vedi la checklist di deploy).

### Catalogo

Al primo avvio il catalogo viene importato nel database da `../public/products.json` (se manca, da un piccolo campione interno), insieme a uno storico prezzi coerente con i `lowestPrice30d` già pubblicati. Da quel momento **il database è la fonte di verità**: i prodotti si gestiscono dal pannello `/admin`, la vetrina li carica da `GET /api/products` (e usa il catalogo incorporato in `index.html` solo se il server non risponde) e dopo ogni modifica `products.json` viene riscritto dal database per compatibilità (`CATALOG_EXPORT_FILE`).

## API

| Metodo | Percorso | Descrizione |
|---|---|---|
| GET | `/api/health` | Stato del server, catalogo e integrazioni attive |
| GET | `/api/products` | Catalogo pubblico (prodotti attivi, prezzi, `lowestPrice30d` calcolato, scorte se gestite) |
| POST | `/api/coupons/validate` | `{code}` → `{valid, code, percent}` (anche per i coupon creati dal pannello) |
| GET | `/api/auth/me` | Utente connesso, stato Plus e token CSRF (`{user:null}` se anonimo) |
| POST | `/api/auth/register` | `{email, password, name, privacy:true}` → crea l'account e apre la sessione |
| POST | `/api/auth/login` · `/api/auth/logout` | Accesso (con blocco dopo 5 tentativi falliti) e uscita |
| POST | `/api/auth/forgot` · `/api/auth/reset` | Link di reimpostazione via email (1 ora, monouso) e nuova password |
| GET | `/api/auth/verify?token=` | Conferma dell'indirizzo email |
| GET | `/api/account/orders` · `/api/account/orders/:id` | Ordini dell'account (solo i propri) |
| POST | `/api/account/orders/:id/pay` | Nuovo link di pagamento per un ordine in attesa |
| POST | `/api/account/profile` · `/api/account/password` | Modifica nome e password |
| GET | `/api/account/export` | Esportazione GDPR dei dati (JSON scaricabile) |
| POST | `/api/account/delete` | `{password}`: cancellazione dell'account (GDPR) |
| GET/POST | `/api/payments/demo/:orderId` | Pagina di pagamento simulata (solo modalità demo, con token del link) |
| GET | `/api/payments/paypal/return` | Ritorno da PayPal: il server cattura e verifica il pagamento |
| POST | `/api/leads` | Contatti B2B dalla landing `/vendita/` (honeypot `website`) |
| * | `/api/admin/*` | API del pannello (vedi *Pannello di amministrazione*) |
| POST | `/api/assistant` | `{messages:[{role,content}], cart:[{id,variant,qty}]}` → `{reply, products?}` |
| POST | `/api/orders` | Crea l'ordine (da ospite o collegato all'account se c'è la sessione) e ricalcola i totali sul server → `{orderId:"AL-AAAA-XXXXXX", total, subtotal, discount, shipping, shippingMethod, paymentMethod, paymentStatus, paymentUrl, paymentProvider, plusApplied, account}` |
| POST | `/api/order-status` | `{orderId, email?}` → stato e stato del pagamento. I dettagli (articoli, totale, tracciamento) arrivano solo se l'email (o il CAP) corrisponde |
| POST | `/api/cart/quote` | `{items, coupon?, shippingMethod?}`: anteprima dei totali, senza salvare nulla (facoltativo) |
| POST | `/api/carts` | `{email, consent:true, items}`: salva il carrello per il promemoria (facoltativo) |
| POST | `/api/newsletter` | `{email, consent:true}`: doppio opt-in, invia il link di conferma |
| GET | `/api/newsletter/confirm?token=` | Conferma l'iscrizione |
| GET | `/api/newsletter/unsubscribe?token=` | Disiscrizione e cancellazione dei dati |
| POST | `/api/plus/subscribe` | **Richiede l'accesso.** `{plan:"monthly"\|"yearly"}` → `{url}` (Stripe Checkout) oppure attivazione demo `{demo:true, plus}` |
| POST | `/api/plus/cancel` | **Richiede l'accesso.** Con Stripe disdetta a fine periodo (`cancelAtPeriodEnd`), in demo immediata (`canceled:true`) |
| GET | `/api/plus/lives` | `{provider, lives:[{id,title,host,startsAt,topic,productIds,...}]}` |
| POST | `/api/stripe/webhook` | Webhook Stripe (firma verificata, idempotente): ordini pagati e abbonamenti Plus |
| POST | `/voice/incoming` | Webhook Twilio: inizio della chiamata (TwiML) |
| POST | `/voice/respond` | Webhook Twilio: risposta a ogni frase del cliente (TwiML) |

### Esempio di ordine

```json
POST /api/orders
{
  "customer": { "name": "Mario Rossi", "email": "mario@example.it", "phone": "+39 333 1234567",
                "address": "Via Roma 1", "city": "Milano", "cap": "20121", "province": "MI" },
  "items": [ { "id": "crocchette-cane-adulto-salmone", "variant": "12 kg", "qty": 1 } ],
  "coupon": "ANIMOL10",
  "shippingMethod": "standard",
  "paymentMethod": "card"
}
```

I campi del cliente si possono inviare anche al primo livello del body. Eventuali prezzi o totali inviati dal client vengono **ignorati**: il server usa i prezzi del catalogo (database), prendendo `salePrice` se presente, altrimenti `price`, quelli della variante se indicata. Applica il coupon (quelli attivi nel pannello: all'inizio ANIMOL10 -10% e CUCCIOLO5 -5%, uno per ordine, con validità e numero massimo di usi) e lo sconto Plus (-5%, solo se l'**account** connesso ha Plus attivo), entrambi calcolati sul subtotale, e la spedizione scelta con `shippingMethod` (stessi prezzi della pagina, default `standard`; valori diversi → 400). Per i prodotti con scorte gestite l'ordine scala il magazzino nella stessa transazione e viene rifiutato se la disponibilità non basta; annullamenti e rimborsi le ripristinano.

| `shippingMethod` | Costo | Gratuita |
|---|---|---|
| `standard` | 4,90 € | da 49 € dopo gli sconti, o per i membri Plus |
| `express` | 9,90 € | mai |
| `point` (Animol Point) | 2,90 € | da 49 € dopo gli sconti, o per i membri Plus |

Il metodo di pagamento non cambia mai il totale: il contrassegno (`paymentMethod: "cod"`) non ha supplementi, come prevede l'art. 62 del Codice del Consumo, ed è accettato fino a 500 €. La risposta indica con `plusApplied` se è stato applicato lo sconto Plus dell'account: la pagina mostra sempre il totale del server. Per carta e PayPal la risposta contiene `paymentUrl`: la conferma mostra il pulsante **Paga ora**.

## Account clienti

- Registrazione con email, nome e password (10-128 caratteri, niente password note o uguali all'email) e presa visione dell'informativa privacy. All'iscrizione parte un'email con il link di conferma dell'indirizzo (non blocca l'accesso).
- Password con **scrypt** (`node:crypto`, N=32768, r=8, p=1, salt casuale, confronto a tempo costante). Il costo si regola con `SCRYPT_COST`.
- Sessione in un cookie **httpOnly, SameSite=Lax, Secure** (`__Host-al_sid` in produzione); nel database c'è solo l'hash SHA-256 del token. Scadenza 30 giorni e 14 di inattività (`SESSION_TTL_DAYS`, `SESSION_IDLE_DAYS`); a ogni accesso un id nuovo (niente session fixation).
- **CSRF**: ogni richiesta che modifica dati deve arrivare dallo stesso sito (controllo di `Origin` e `Sec-Fetch-Site`, che blocca anche il login CSRF) e, se c'è una sessione, portare l'header `X-CSRF-Token` legato alla sessione (lo restituiscono `/api/auth/me` e il login). La vetrina lo aggiunge da sola.
- **Limiti di accesso**: per IP (`RATE_LIMIT_AUTH`) e per email (5 tentativi falliti in 15 minuti → blocco di 15 minuti, `LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES`). Messaggi e tempi di risposta identici per email esistenti e non.
- **Password dimenticata**: link via email valido 1 ora e monouso, con il token nel frammento `#reset=` (non finisce nei log né nel Referer). La nuova password chiude tutte le sessioni aperte.
- **I miei ordini** dalla vetrina legge gli ordini dell'account dal server. Un utente vede e paga **solo i propri ordini**: l'id di un ordine altrui risponde 404. Il checkout come ospite resta sempre possibile (gli ordini da ospite non vengono mai collegati a un account in base all'email).
- **GDPR**: "Scarica i miei dati" (`/api/account/export`, JSON con profilo, ordini, Plus, newsletter, carrelli) e "Elimina account" (con conferma della password): cancella profilo, sessioni, abbonamento Plus (anche su Stripe), iscrizione newsletter e carrelli; gli ordini restano solo per gli obblighi fiscali, senza collegamento all'account. Non si registra l'IP dei clienti (solo quello degli admin, nel registro azioni).

## Pagamenti

| Configurazione | Carta | PayPal | Contrassegno |
|---|---|---|---|
| Nessuna chiave (sviluppo) | Pagina **DEMO** simulata | Pagina **DEMO** simulata | Sì |
| `STRIPE_SECRET_KEY` | Stripe Checkout | Stripe Checkout (se PayPal è attivo nella dashboard Stripe) | Sì |
| `PAYPAL_CLIENT_ID` + `PAYPAL_CLIENT_SECRET` | Stripe se configurato | **PayPal Checkout nativo** | Sì |
| Produzione senza chiavi | Rifiutata (400) | Rifiutata (400) | Sì |

Stati del pagamento di un ordine: `pending` → `paid` (oppure `failed`, `refunded`); il contrassegno è `cod`. Il totale inviato al provider è sempre quello calcolato dal server e l'ordine diventa `paid` **solo** se importo e valuta notificati coincidono.

**Stripe Checkout (ordini)**

1. Imposta `STRIPE_SECRET_KEY` (`sk_test_...` in prova, `sk_live_...` in produzione) e `PUBLIC_BASE_URL`.
2. Nella dashboard Stripe attiva i metodi di pagamento che vuoi (carte, PayPal, Apple Pay/Google Pay...): il server usa i metodi dinamici della dashboard.
3. Crea il webhook (Developers → Webhooks) verso `https://<dominio>/api/stripe/webhook` con gli eventi `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired` (ordini) e `customer.subscription.updated`, `customer.subscription.deleted` (Plus). Copia il *signing secret* in `STRIPE_WEBHOOK_SECRET`. Il webhook verifica la firma, ignora gli eventi già elaborati e accetta solo sessioni create dal server per quell'ordine.
4. Dopo il pagamento Stripe rimanda a `/pagamento/esito.html?order=...&esito=ok`, che mostra "Pagamento ricevuto" solo quando il webhook ha aggiornato l'ordine; l'annullamento rimanda a `esito=annullato` e l'ordine resta in attesa (si può pagare da "I miei ordini").
5. In locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
6. Il rimborso dal pannello admin chiama `refunds.create` su Stripe.

**PayPal Checkout nativo (Orders API v2), facoltativo**

1. Su developer.paypal.com crea un'app REST e copia *Client ID* e *Secret* in `PAYPAL_CLIENT_ID` e `PAYPAL_CLIENT_SECRET`; `PAYPAL_ENV=sandbox` per le prove, `live` in produzione.
2. Non serve un webhook: al ritorno su `/api/payments/paypal/return` il server **cattura** il pagamento, verifica stato `COMPLETED`, importo, valuta e riferimento dell'ordine, e solo allora segna l'ordine pagato. Il rimborso dal pannello chiama l'API di refund della cattura.
3. Se PayPal non è configurato ma Stripe sì, "PayPal" al checkout passa da Stripe Checkout.

**Demo**: senza chiavi (e fuori produzione, oppure con `DEMO_PAYMENTS=1`) la conferma d'ordine porta a `/pagamento/demo.html`, una pagina chiaramente etichettata **DEMO** che non chiede dati di carta e permette di simulare l'esito. Il link contiene un token casuale legato all'ordine (sul server ne resta solo l'hash) ed è monouso.

## Variabili d'ambiente

Sono tutte elencate in `.env.example`. Nessuna è obbligatoria.

| Variabile | Uso |
|---|---|
| `PORT`, `NODE_ENV` | Porta del server. Con `production` si attivano HSTS e la cache dei file statici |
| `PUBLIC_BASE_URL` | URL pubblico https. Serve per i link nelle email, per i redirect di Stripe e per verificare la firma Twilio |
| `TRUST_PROXY` | `1` dietro Render, Railway o Nginx, così il rate limit vede l'IP reale |
| `ANTHROPIC_API_KEY` | Attiva l'assistente Claude. Senza chiave si usa il fallback a parole chiave |
| `ANTHROPIC_MODEL` | Modello Claude (default `claude-opus-5-5`) |
| `ASSISTANT_MAX_HISTORY`, `ASSISTANT_MAX_CHARS` | Numero massimo di messaggi della cronologia e di caratteri per messaggio |
| `RATE_LIMIT_*` | Richieste per IP in ogni finestra di tempo |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Pagamento degli ordini con Stripe Checkout e abbonamento Plus |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Prezzi Plus creati nella dashboard (facoltativi) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_ENV` | PayPal Checkout nativo (facoltativo) |
| `DEMO_PAYMENTS` | Pagina di pagamento simulata: attiva di default fuori produzione, `1` per forzarla |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Amministratore del pannello `/admin` |
| `SESSION_TTL_DAYS`, `SESSION_IDLE_DAYS`, `ADMIN_SESSION_HOURS` | Durata delle sessioni |
| `SCRYPT_COST`, `COOKIE_SECURE`, `LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES` | Hash delle password, cookie Secure, blocco dei tentativi |
| `RATE_LIMIT_AUTH`, `RATE_LIMIT_LEADS` | Limiti per IP su accesso/registrazione e modulo B2B |
| `DATA_DIR`, `CATALOG_EXPORT_FILE`, `VENDITA_DIR` | Cartella dati (database), file `products.json` esportato (`off` per disattivarlo), cartella della landing B2B |
| `TWILIO_AUTH_TOKEN`, `HUMAN_PHONE_NUMBER`, `TWILIO_VOICE` | Agente vocale |
| `EMAIL_WEBHOOK_URL`, `EMAIL_FROM`, `ALERT_EMAIL` | Invio delle email e destinatario degli avvisi interni |
| `ABANDONED_CART_HOURS`, `LOW_STOCK_THRESHOLD` | Parametri dei job di automazione |
| `PLUS_TRIAL_REMINDER_DAYS`, `PLUS_RENEWAL_REMINDER_DAYS` | Anticipo, in giorni, dei promemoria di fine prova (default 3) e di rinnovo annuale Plus (default 30) |
| `LIVE_PROVIDER` | Provider delle dirette Plus (`demo`) |

Le chiavi si impostano **solo** nelle variabili d'ambiente del servizio di hosting o nel file `.env`, che non va mai in git.

## Assistente IA (Claude)

- Usa l'SDK ufficiale `@anthropic-ai/sdk` con il modello `claude-opus-5-5`, effort `low` per tenere basse latenza e costi della chat, e il fallback lato server (`fallbacks: "default"`), così una richiesta rifiutata dai filtri di sicurezza viene ritentata su un altro modello.
- Ha a disposizione quattro strumenti: `search_products`, `get_product`, `get_policy` (spedizioni, resi, coupon, Plus, pagamenti, contatti) e `get_order_status`. Il carrello del cliente gli viene passato come contesto.
- Dichiara di essere un'IA, come richiede l'art. 50 dell'AI Act. Quando le chiedono dell'IA rimanda alla pagina `/legal/ai-trasparenza.html`.
- Non fa diagnosi veterinarie e rimanda sempre al veterinario. Non attribuisce agli alimenti proprietà salutistiche, cioè di prevenire, curare o trattare malattie, come vieta il Reg. CE 767/2009.
- Non accetta mai dati di carte. Se un messaggio contiene un numero di carta (riconosciuto con il controllo di Luhn) o un CVV, viene bloccato prima di arrivare a Claude e non viene salvato.
- La cronologia viene accorciata agli ultimi 12 messaggi da 1500 caratteri al massimo. Le richieste sono limitate per IP (20 al minuto di default).
- Se l'API non risponde, il server passa automaticamente alla risposta deterministica.

## Agente vocale: collegare un numero Twilio

1. Compra un numero italiano su Twilio (Console → Phone Numbers → Buy a number, con capacità *Voice*). Per i numeri italiani Twilio chiede un *Regulatory Bundle* con documento e indirizzo.
2. Pubblica il server su un URL **https** pubblico (vedi *Deploy*) e imposta `PUBLIC_BASE_URL`, per esempio `https://shop.animol.life`.
3. In Twilio vai su Phone Numbers → il tuo numero → *Voice Configuration*: alla voce *A call comes in* scegli **Webhook** `https://shop.animol.life/voice/incoming`, metodo **HTTP POST**.
4. Imposta `TWILIO_AUTH_TOKEN` (Console → Account → API keys & tokens). Da quel momento le richieste senza una firma `X-Twilio-Signature` valida ricevono 403. L'URL in `PUBLIC_BASE_URL` deve coincidere esattamente con quello configurato in Twilio.
5. Imposta `HUMAN_PHONE_NUMBER` (formato E.164, es. `+390212345678`) per trasferire la chiamata quando il cliente dice "operatore".
6. Facoltativo: `TWILIO_VOICE=Polly.Bianca` o `Google.it-IT-Standard-A` per una voce italiana più naturale.

Come funziona la chiamata:

- L'agente gestisce **solo chiamate in entrata**: non effettua chiamate in uscita, promozionali o di altro tipo, e rifiuta con `<Reject>` le richieste con `Direction=outbound-*`.
- Non accetta mai dati della carta a voce. Se il cliente li detta, l'agente lo avvisa di non farlo; quella frase non viene mandata all'IA né salvata. Il pagamento avviene solo sul sito.

- All'inizio l'agente dice che è un'intelligenza artificiale e chiede il consenso a conservare la trascrizione. L'audio non viene mai registrato.
- Se il cliente acconsente, la trascrizione testuale viene salvata in `data/call-transcripts.jsonl` con un identificativo anonimo, senza numero di telefono. Senza consenso non si salva nulla.
- Il riconoscimento vocale usa `<Gather input="speech" language="it-IT">` e la sintesi `<Say language="it-IT">`. Le risposte arrivano dallo stesso assistente della chat, in versione breve adatta alla voce: stato dell'ordine dal numero dettato (es. "A L 2026 K 7 X..."), prodotti, spedizioni, resi e coupon.
- Il cliente può dire "operatore" in qualsiasi momento per essere trasferito con `<Dial>`. Dopo due silenzi consecutivi la chiamata si chiude con un saluto.

Per una prova in locale: `npx ngrok http 3000` e poi usa l'URL di ngrok come webhook e come `PUBLIC_BASE_URL`.

## Animol Plus con Stripe

1. Imposta `STRIPE_SECRET_KEY` (inizia per `sk_test_` in prova, `sk_live_` in produzione).
2. Facoltativo: crea nella dashboard un prodotto "Animol Plus" con due prezzi ricorrenti in EUR, 5,99 € al mese e 49,90 € all'anno, e imposta `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`. Se non li imposti, i prezzi vengono creati al volo con `price_data`. La prova gratuita di 14 giorni si applica sempre.
3. Crea il webhook (Developers → Webhooks) verso `https://<dominio>/api/stripe/webhook` con gli eventi `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`. Il webhook salva anche la fine della prova e del periodo, che servono ai promemoria Plus. Copia il *signing secret* in `STRIPE_WEBHOOK_SECRET`.
4. Per le prove in locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

**Plus è legato all'account**, non a un'email digitata al checkout (risolta la debolezza segnalata dal QA). Dalla pagina, l'attivazione chiede di accedere o registrarsi e poi chiama `/api/plus/subscribe` con `{plan}`: in demo il server registra subito l'account come membro in prova; con Stripe la sessione di Checkout porta `client_reference_id` = id dell'account e il webhook collega l'abbonamento a quell'account. Dopo il pagamento Stripe rimanda a `/plus/?checkout=success`, che reindirizza a `/?checkout=success#plus`: la pagina aspetta la conferma del webhook e non attiva nulla da sola. Spedizione gratuita e sconto del 5% valgono solo per gli ordini fatti **con l'accesso** all'account membro; un ospite che usa la stessa email paga il prezzo pieno. La disdetta richiede la sessione (con token CSRF): con Stripe imposta `cancel_at_period_end`, in demo è immediata.

Le dirette private (`/api/plus/lives`) usano per ora dati di esempio. `src/lives.js` definisce un adapter con `listUpcoming()` e `createJoinToken()`: per LiveKit o Daily basta aggiungere un adapter che legga le stanze programmate e generi i token di accesso solo per i membri Plus.

## Pannello di amministrazione (`/admin`)

Pagina separata dal negozio (`public/admin/`), non indicizzata (`X-Robots-Tag: noindex`), con sessione propria: cookie `al_admin` (`__Host-al_admin` in produzione) **SameSite=Strict**, durata 8 ore (`ADMIN_SESSION_HOURS`) e 2 ore di inattività, token CSRF su ogni modifica, ruolo `admin` verificato a ogni richiesta, stesso blocco dei tentativi falliti dei clienti.

**Primo accesso**

- Con `ADMIN_EMAIL` e `ADMIN_PASSWORD` (almeno 12 caratteri) l'amministratore viene creato, o riallineato a quella password, a ogni avvio.
- Senza, al **primo avvio** viene creato `admin@animol.local` (o `ADMIN_EMAIL`) con una password casuale stampata **una sola volta** nel log del server: salvala subito in un gestore di password. Per cambiarla imposta le due variabili e riavvia, oppure usa "Password dimenticata" con un'email reale.

**Funzioni**

- **Dashboard**: vendite di oggi e degli ultimi 30 giorni (ordini pagati o in contrassegno, esclusi annullati e rimborsati), numero di ordini, scontrino medio, ordini in attesa di pagamento e da spedire, membri Plus attivi, clienti registrati, contatti B2B, prodotti con scorte basse.
- **Ordini**: ricerca per numero o email, filtri per stato e pagamento, dettaglio con indirizzo e cronologia. Azioni: *pagato* (es. contrassegno incassato), *in preparazione*, *spedito* (corriere, numero e link https di tracciamento obbligatori), *consegnato*, *rimborsato* (rimborso reale su Stripe/PayPal), *annullato*; le scorte vengono ripristinate. Il cliente riceve un'email per ogni passaggio (stub senza `EMAIL_WEBHOOK_URL`), disattivabile con la casella "Avvisa il cliente".
- **Prodotti**: creazione e modifica di nome, marca, categoria, prezzo, prezzo scontato, varianti (con i loro prezzi), scorte (vuoto = non gestite), descrizione e specifiche; disattivazione (nessuna cancellazione fisica, gli ordini passati li citano). Pulsante **"Genera descrizione con IA"**: usa Claude (`ANTHROPIC_MODEL`, output JSON strutturato, nessuna indicazione salutistica o veterinaria) e, senza chiave o in caso di errore, un modello di testo; il risultato è sempre una bozza da rileggere. Le modifiche sono subito visibili nel negozio e riscrivono `products.json`.
- **Omnibus (art. 17-bis Cod. Consumo)**: ogni variazione di prezzo viene registrata nello storico (`price_history`, per prodotto e per variante). `lowestPrice30d` è calcolato in automatico: durante uno sconto è il prezzo più basso applicato nei 30 giorni precedenti l'inizio della riduzione (le riduzioni progressive mantengono lo stesso riferimento); senza sconto è il minimo degli ultimi 30 giorni. Lo storico è visibile nella scheda prodotto del pannello.
- **Coupon**: codice, percentuale (1-50%), descrizione, validità (date), numero massimo di utilizzi, attivo/disattivo. Il negozio li valida con `/api/coupons/validate`.
- **Membri Plus**, **Newsletter** (export CSV dei soli iscritti confermati), **Contatti B2B** (lista ed export CSV delle richieste da `/vendita/`, con data e versione del consenso privacy). I CSV sono protetti dalla *formula injection*.
- **Registro azioni**: ogni accesso (anche fallito) e ogni modifica dell'admin finisce in `audit_log` con data, utente, oggetto, dettagli e IP.

## Contatti B2B (`/vendita/`)

La landing `../vendita/` è servita su `/vendita/`. Il suo modulo chiama `POST /api/leads` con `{name, shop, type, city, phone, email, interest, message, privacyAccepted:true, marketingConsent, consentVersion, source, website}`: campi validati e con lunghezza massima, limite per IP (`RATE_LIMIT_LEADS`), consenso privacy obbligatorio e salvato con data e versione, consenso marketing facoltativo con la sua data. Se il campo nascosto `website` (honeypot) è compilato la risposta è comunque positiva ma nulla viene salvato. Ogni contatto genera un avviso a `ALERT_EMAIL` (o `ADMIN_EMAIL`), senza l'email completa del contatto nel testo.

## Email

Senza `EMAIL_WEBHOOK_URL` le email (conferma ordine, pagamento ricevuto, spedizione e altri cambi di stato, conferma dell'account, reimpostazione password, doppio opt-in, disdetta Plus, carrello abbandonato, avvisi) vengono **solo registrate nel log**, con l'indirizzo mascherato e il link stampato. Per inviarle davvero, imposta un endpoint che riceva `POST {to, from, subject, text, tag}`: per esempio uno scenario Make/Zapier o una piccola funzione che chiama Brevo, Postmark o Amazon SES.

## Automazioni

| Comando | Cosa fa |
|---|---|
| `npm run job:abandoned-cart` | Invia un promemoria ai carrelli salvati con consenso, fermi da più di `ABANDONED_CART_HOURS` ore e senza un ordine successivo. Un solo promemoria per carrello |
| `npm run job:low-stock` | Avvisa per i prodotti con scorte ≤ `LOW_STOCK_THRESHOLD`. Legge `data/inventory.json` (`{"<id>": quantità}`); se il file manca usa scorte simulate |
| `npm run job:daily-report` | Report vendite di ieri: ordini, fatturato, scontrino medio, prodotti e categorie più venduti, coupon usati. Lo salva in `data/reports/` e lo invia ad `ALERT_EMAIL`. Accetta `--today` o `--date=AAAA-MM-GG` |
| `npm run job:ai-content` | Genera con Claude descrizioni prodotto e post Instagram/Facebook, oppure usa dei modelli di testo se manca la chiave. Li salva come **bozze** in `data/generated/`. Accetta `--limit=5` o `--id=<prodotto>` |
| `npm run job:plus-reminders` | Promemoria Plus via email: 3 giorni prima della fine della prova (cioè del primo addebito) e 30 giorni prima del rinnovo annuale. Ogni promemoria parte una sola volta per scadenza e mai a chi ha già disdetto |
| `npm run jobs:all` | Esegue tutti i job |

Tutti i job accettano `-- --dry-run` (es. `npm run job:daily-report -- --dry-run`), che non invia e non scrive nulla. In modalità demo non contattano servizi esterni. Esempio di crontab: `0 7 * * * cd /srv/animol-life/server && npm run job:daily-report`.

## Sicurezza

- Header simili a quelli di helmet: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in produzione. Header `x-powered-by` disattivato.
- Limiti di dimensione del body: 32 KB per JSON, 16 KB per i form Twilio. Rate limit per IP sugli endpoint sensibili.
- Validazione server-side di tutti gli input: email, CAP a 5 cifre, quantità da 1 a 20, varianti esistenti, coupon validi.
- Token di conferma salvati solo come hash SHA-256, monouso e con scadenza. Le risposte non rivelano se un'email è iscritta.
- Nessun segreto nel codice. Gli errori interni non espongono lo stack al client.
- GDPR: si conserva il minimo indispensabile. Nei log le email sono mascherate. Lo stato ordine richiesto con il solo numero non mostra dati personali.
- Account: hash scrypt, cookie httpOnly/Secure/SameSite, token di sessione salvati come hash, token CSRF, controllo dell'origine, blocco dei tentativi, nessuna enumerazione degli account su login e reset (la registrazione invece segnala un'email già usata, mitigato dal rate limit).
- Autorizzazione: ogni ordine dell'area personale è filtrato per id dell'account (niente IDOR), il pannello admin verifica il ruolo a ogni richiesta, i pagamenti demo richiedono il token del link.
- Pannello admin: escape HTML di tutti i dati inseriti dai clienti, validazione stretta degli input (prezzi, slug, URL di tracciamento solo https, chiavi delle specifiche), registro delle azioni.

Il rate limit e le sessioni delle telefonate sono tenuti in memoria. Se usi più istanze del server, spostali su Redis.

## Checklist di messa online

1. **HTTPS e dominio**: pubblica dietro HTTPS (certificato Let's Encrypt o quello del provider) su un dominio tuo; imposta `NODE_ENV=production`, `PUBLIC_BASE_URL=https://<dominio>` e, dietro proxy, `TRUST_PROXY=1`. In produzione i cookie usano il prefisso `__Host-` e sono sempre `Secure`, ed è attivo HSTS.
2. **Variabili d'ambiente**: copia `.env.example`, compila solo ciò che serve, mai chiavi nel codice o in git. Imposta `ADMIN_EMAIL` e una `ADMIN_PASSWORD` lunga e unica (o annota quella generata al primo avvio).
3. **Pagamenti**: chiavi Stripe live, webhook live con i 6 eventi elencati sopra e `STRIPE_WEBHOOK_SECRET`; se usi PayPal nativo `PAYPAL_ENV=live` con le credenziali live. Fai un ordine reale di prova e rimborsalo dal pannello. Senza chiavi in produzione si può pagare solo in contrassegno.
4. **Email**: imposta `EMAIL_WEBHOOK_URL` (Brevo, Postmark, SES...) e `EMAIL_FROM` su un dominio con SPF/DKIM/DMARC: senza, conferme, reset password e notifiche non arrivano ai clienti.
5. **Dati e backup**: `DATA_DIR` su disco persistente. Backup giornaliero cifrato e fuori sede del database con `sqlite3 data/animol.db ".backup 'backup/animol-$(date +%F).db'"` (copia coerente anche a server acceso) e dei file `data/*.json`; prova periodicamente il ripristino. Conserva i backup per il tempo previsto dall'informativa.
6. **Testi legali**: completa i `[DA COMPLETARE]` e fai validare privacy (account, pagamenti, contatti B2B), termini e cookie da un legale; aggiorna l'informativa con i fornitori di pagamento ed email come responsabili del trattamento.
7. **Sicurezza operativa**: un solo processo (rate limit e blocchi in memoria: con più istanze serve Redis), firewall che espone solo 80/443, aggiornamenti del sistema e `npm audit` regolari, log del server conservati e protetti, accesso al pannello solo da dispositivi fidati (valuta una restrizione per IP o una VPN sul percorso `/admin`).
8. **Verifica finale**: `npm test`, `node ../tests/e2e.cjs` in staging, `GET /api/health` (`demoPayments:false`, `stripe:true` in produzione), controllo degli header di sicurezza.

## Deploy

**Render**

1. *New → Web Service* collegato al repository, *Root Directory* `animol-life/server`.
2. Build command `npm ci`, start command `npm start`, runtime Node 20 o superiore.
3. Variabili: `NODE_ENV=production`, `TRUST_PROXY=1`, `PUBLIC_BASE_URL=https://<servizio>.onrender.com` e le chiavi che ti servono.
4. Aggiungi un *Persistent Disk* montato su `/opt/render/project/src/animol-life/server/data`, oppure imposta `DATA_DIR` sul percorso del disco.
5. I job si configurano come *Cron Job* separati con lo stesso repository, per esempio `npm run job:daily-report`.

**Railway**

Crea un nuovo progetto dal repository, imposta *Root Directory* `animol-life/server` (Railway rileva Node da solo), aggiungi le variabili, un *Volume* montato su `/app/data` con `DATA_DIR=/app/data` e i cron con *Cron Schedule* su servizi separati.

**VPS (Ubuntu)**

```bash
# Node 20+ (es. via nodesource), poi:
git clone <repo> /srv/animol && cd /srv/animol/animol-life/server
npm ci --omit=dev && cp .env.example .env && nano .env   # NODE_ENV=production, TRUST_PROXY=1, PUBLIC_BASE_URL...
sudo npm i -g pm2 && pm2 start src/index.js --name animol && pm2 save && pm2 startup
```

Davanti al server metti Nginx come reverse proxy, con `proxy_pass http://127.0.0.1:3000;` e `proxy_set_header X-Forwarded-Proto $scheme;`, e un certificato HTTPS di Let's Encrypt (`certbot --nginx`). I job vanno in `crontab -e`.

## Struttura

```
server/
  src/          app.js (rotte), repo.js (database SQLite), auth.js (account, sessioni, CSRF), payments.js (Stripe, PayPal, demo),
                admin.js (pannello), leads.js (contatti B2B), assistant.js (IA), orders.js, plus.js, newsletter.js, voice.js,
                catalog.js, policies.js, security.js, store.js, email.js, lives.js, config.js
  automation/   abandoned-cart.js, low-stock.js, daily-report.js, ai-content.js, plus-reminders.js, run.js
  test/         test node:test (tutti in modalità demo, con client Claude, Stripe e PayPal finti):
                api, accounts (auth, CSRF, IDOR, GDPR), payments (demo, webhook firmato, PayPal), admin (CRUD, Omnibus, coupon, B2B)
  data/         dati runtime (gitignored)
```
