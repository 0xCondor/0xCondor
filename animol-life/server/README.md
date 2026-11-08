# Animol Life - server

Backend Node.js (Express) del negozio online **Animol Life**: serve il sito statico di `../public`, espone le API del negozio, l'assistente di shopping con IA (Claude), l'agente vocale telefonico (Twilio), l'abbonamento **Animol Plus** (Stripe) e i job di automazione.

Tutto funziona **senza chiavi in modalità demo**: l'assistente usa risposte a parole chiave, Plus restituisce un URL dimostrativo, le email vengono solo registrate nel log.

## Requisiti e avvio

- Node.js **20.12+** (testato con Node 22)

```bash
cd animol-life/server
npm install
cp .env.example .env      # facoltativo: compila solo ciò che ti serve
npm start                 # http://localhost:3000
npm run dev               # riavvio automatico durante lo sviluppo
npm test                  # test node:test, tutti in modalità demo
```

Il catalogo viene letto da `../public/products.json` (scritto dal frontend) e ricaricato automaticamente quando cambia. Se il file manca o non è valido si usa un piccolo catalogo di esempio interno.

I dati (ordini, iscritti newsletter, membri Plus, carrelli, report, trascrizioni) vengono salvati in file JSON in `server/data/`. La cartella è esclusa da git. In produzione va su un disco persistente oppure si sostituisce `src/store.js` con un database.

## API

| Metodo | Percorso | Descrizione |
|---|---|---|
| GET | `/api/health` | Stato del server, catalogo e integrazioni attive |
| POST | `/api/assistant` | `{messages:[{role,content}], cart:[{id,variant,qty}]}` → `{reply, products?}` |
| POST | `/api/orders` | Crea l'ordine e ricalcola i totali sul server → `{orderId:"AL-AAAA-XXXXXX", total, subtotal, discount, shipping}` |
| POST | `/api/order-status` | `{orderId, email?}` → stato. I dettagli dell'ordine arrivano solo se l'email (o il CAP) corrisponde |
| POST | `/api/cart/quote` | Anteprima dei totali, senza salvare nulla (facoltativo) |
| POST | `/api/carts` | `{email, consent:true, items}`: salva il carrello per il promemoria (facoltativo) |
| POST | `/api/newsletter` | `{email, consent:true}`: doppio opt-in, invia il link di conferma |
| GET | `/api/newsletter/confirm?token=` | Conferma l'iscrizione |
| GET | `/api/newsletter/unsubscribe?token=` | Disiscrizione e cancellazione dei dati |
| POST | `/api/plus/subscribe` | `{plan:"monthly"\|"yearly", email?}` → `{url}` (Stripe Checkout oppure URL demo) |
| POST | `/api/plus/cancel` | `{email}`: invia per email il link per confermare la disdetta |
| GET | `/api/plus/cancel/confirm?token=` | Conferma la disdetta |
| GET | `/api/plus/lives` | `{provider, lives:[{id,title,host,startsAt,topic,productIds,...}]}` |
| POST | `/api/stripe/webhook` | Webhook Stripe (firma verificata) |
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
  "paymentMethod": "card"
}
```

I campi del cliente si possono inviare anche al primo livello del body. Eventuali prezzi o totali inviati dal client vengono **ignorati**: il server usa i prezzi del catalogo, prendendo `salePrice` se presente, altrimenti `price`, quelli della variante se indicata. Applica il coupon (ANIMOL10 -10%, CUCCIOLO5 -5%, uno per ordine), lo sconto Plus (-5%) e la spedizione: gratuita da 49 € dopo gli sconti o per i membri Plus, altrimenti 4,90 €.

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
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | Abbonamento Plus |
| `TWILIO_AUTH_TOKEN`, `HUMAN_PHONE_NUMBER`, `TWILIO_VOICE` | Agente vocale |
| `EMAIL_WEBHOOK_URL`, `EMAIL_FROM`, `ALERT_EMAIL` | Invio delle email e destinatario degli avvisi interni |
| `ABANDONED_CART_HOURS`, `LOW_STOCK_THRESHOLD` | Parametri dei job di automazione |
| `LIVE_PROVIDER` | Provider delle dirette Plus (`demo`) |

Le chiavi si impostano **solo** nelle variabili d'ambiente del servizio di hosting o nel file `.env`, che non va mai in git.

## Assistente IA (Claude)

- Usa l'SDK ufficiale `@anthropic-ai/sdk` con il modello `claude-opus-5-5`, effort `low` per tenere basse latenza e costi della chat, e il fallback lato server (`fallbacks: "default"`), così una richiesta rifiutata dai filtri di sicurezza viene ritentata su un altro modello.
- Ha a disposizione quattro strumenti: `search_products`, `get_product`, `get_policy` (spedizioni, resi, coupon, Plus, pagamenti, contatti) e `get_order_status`. Il carrello del cliente gli viene passato come contesto.
- Dichiara di essere un'IA, come richiede l'art. 50 dell'AI Act. Non fa diagnosi veterinarie e rimanda sempre al veterinario. Non chiede dati di pagamento.
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

- All'inizio l'agente dice che è un'intelligenza artificiale e chiede il consenso a conservare la trascrizione. L'audio non viene mai registrato.
- Se il cliente acconsente, la trascrizione testuale viene salvata in `data/call-transcripts.jsonl` con un identificativo anonimo, senza numero di telefono. Senza consenso non si salva nulla.
- Il riconoscimento vocale usa `<Gather input="speech" language="it-IT">` e la sintesi `<Say language="it-IT">`. Le risposte arrivano dallo stesso assistente della chat, in versione breve adatta alla voce: stato dell'ordine dal numero dettato (es. "A L 2026 K 7 X..."), prodotti, spedizioni, resi e coupon.
- Il cliente può dire "operatore" in qualsiasi momento per essere trasferito con `<Dial>`. Dopo due silenzi consecutivi la chiamata si chiude con un saluto.

Per una prova in locale: `npx ngrok http 3000` e poi usa l'URL di ngrok come webhook e come `PUBLIC_BASE_URL`.

## Animol Plus con Stripe

1. Imposta `STRIPE_SECRET_KEY` (inizia per `sk_test_` in prova, `sk_live_` in produzione).
2. Facoltativo: crea nella dashboard un prodotto "Animol Plus" con due prezzi ricorrenti in EUR, 5,99 € al mese e 49,90 € all'anno, e imposta `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY`. Se non li imposti, i prezzi vengono creati al volo con `price_data`. La prova gratuita di 14 giorni si applica sempre.
3. Crea il webhook (Developers → Webhooks) verso `https://<dominio>/api/stripe/webhook` con gli eventi `checkout.session.completed`, `customer.subscription.updated` e `customer.subscription.deleted`. Copia il *signing secret* in `STRIPE_WEBHOOK_SECRET`.
4. Per le prove in locale: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.

Dopo il pagamento Stripe rimanda a `/plus/?checkout=success`. I membri attivi o in prova ottengono automaticamente la spedizione gratuita e lo sconto del 5% sugli ordini fatti con la stessa email. La disdetta passa da un link inviato per email e, con Stripe, imposta `cancel_at_period_end`. Nota: senza account utente il riconoscimento del membro si basa sull'email dell'ordine. Per un controllo più forte serve un login o un magic link.

Le dirette private (`/api/plus/lives`) usano per ora dati di esempio. `src/lives.js` definisce un adapter con `listUpcoming()` e `createJoinToken()`: per LiveKit o Daily basta aggiungere un adapter che legga le stanze programmate e generi i token di accesso solo per i membri Plus.

## Email

Senza `EMAIL_WEBHOOK_URL` le email (conferma ordine, doppio opt-in, disdetta Plus, carrello abbandonato, avvisi) vengono **solo registrate nel log**, con l'indirizzo mascherato e il link stampato. Per inviarle davvero, imposta un endpoint che riceva `POST {to, from, subject, text, tag}`: per esempio uno scenario Make/Zapier o una piccola funzione che chiama Brevo, Postmark o Amazon SES.

## Automazioni

| Comando | Cosa fa |
|---|---|
| `npm run job:abandoned-cart` | Invia un promemoria ai carrelli salvati con consenso, fermi da più di `ABANDONED_CART_HOURS` ore e senza un ordine successivo. Un solo promemoria per carrello |
| `npm run job:low-stock` | Avvisa per i prodotti con scorte ≤ `LOW_STOCK_THRESHOLD`. Legge `data/inventory.json` (`{"<id>": quantità}`); se il file manca usa scorte simulate |
| `npm run job:daily-report` | Report vendite di ieri: ordini, fatturato, scontrino medio, prodotti e categorie più venduti, coupon usati. Lo salva in `data/reports/` e lo invia ad `ALERT_EMAIL`. Accetta `--today` o `--date=AAAA-MM-GG` |
| `npm run job:ai-content` | Genera con Claude descrizioni prodotto e post Instagram/Facebook, oppure usa dei modelli di testo se manca la chiave. Li salva come **bozze** in `data/generated/`. Accetta `--limit=5` o `--id=<prodotto>` |
| `npm run jobs:all` | Esegue tutti i job |

Tutti i job accettano `-- --dry-run` (es. `npm run job:daily-report -- --dry-run`), che non invia e non scrive nulla. In modalità demo non contattano servizi esterni. Esempio di crontab: `0 7 * * * cd /srv/animol-life/server && npm run job:daily-report`.

## Sicurezza

- Header simili a quelli di helmet: CSP, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS in produzione. Header `x-powered-by` disattivato.
- Limiti di dimensione del body: 32 KB per JSON, 16 KB per i form Twilio. Rate limit per IP sugli endpoint sensibili.
- Validazione server-side di tutti gli input: email, CAP a 5 cifre, quantità da 1 a 20, varianti esistenti, coupon validi.
- Token di conferma salvati solo come hash SHA-256, monouso e con scadenza. Le risposte non rivelano se un'email è iscritta.
- Nessun segreto nel codice. Gli errori interni non espongono lo stack al client.
- GDPR: si conserva il minimo indispensabile. Nei log le email sono mascherate. Lo stato ordine richiesto con il solo numero non mostra dati personali.

Il rate limit e le sessioni delle telefonate sono tenuti in memoria. Se usi più istanze del server, spostali su Redis.

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
  src/          app.js (rotte), assistant.js (IA), orders.js, plus.js, newsletter.js, voice.js,
                catalog.js, policies.js, security.js, store.js, email.js, lives.js, config.js
  automation/   abandoned-cart.js, low-stock.js, daily-report.js, ai-content.js, run.js
  test/         test node:test (tutti in modalità demo, con un client Claude finto per il ciclo dei tool)
  data/         dati runtime (gitignored)
```
