# Condor EASM — External Attack Surface Monitoring

> SaaS B2B multi-tenant white-label per MSP/MSSP italiani.
> Monitoraggio continuo dell'esposizione esterna dei clienti, scoring, alert e report PDF brandizzati.

**Stato**: MVP funzionante — pronto per closed beta e primi 20 clienti Founder Plan.

---

## Indice
- [Quick start (dev)](#quick-start-dev)
- [Architettura](#architettura)
- [Struttura repository](#struttura-repository)
- [Moduli scan inclusi](#moduli-scan-inclusi)
- [Scoring](#scoring)
- [API](#api)
- [Piani e pricing](#piani-e-pricing)
- [Deploy produzione](#deploy-produzione)
- [Playbook di vendita](#playbook-di-vendita)
- [Sicurezza ed etica](#sicurezza-ed-etica)
- [Roadmap](#roadmap)

---

## Quick start (dev)

Requisiti: Docker + Docker Compose.

```bash
cp .env.example .env
# modifica APP_SECRET_KEY con: openssl rand -hex 32
docker compose up --build
```

Servizi esposti:
- Frontend: http://localhost:3000
- API: http://localhost:8000/api/docs (Swagger)
- Postgres: localhost:5432
- Redis: localhost:6379

Primo utilizzo:
1. Vai su http://localhost:3000/register → crea account MSP
2. Dashboard → Crea nuovo cliente (tenant)
3. Nel cliente → Aggiungi dominio (es. il tuo dominio)
4. Pubblica il record DNS TXT di validazione → clicca Verifica
5. Lancia scan → visualizza findings → genera report PDF

Test unitari:
```bash
docker compose exec backend pytest -q
```

---

## Architettura

```
┌────────────────┐       ┌──────────────┐       ┌─────────────┐
│ Next.js 15 SSR │──────▶│  FastAPI     │──────▶│ Postgres 15 │
│ Tailwind       │  JWT  │  (monolite)  │       │ (multi-tenant)
└────────────────┘       └──────┬───────┘       └─────────────┘
                                │
                                ▼
                    ┌────────────────────┐
                    │  Celery + Redis    │
                    │  worker + beat     │
                    └──────────┬─────────┘
                               │
                               ▼
                    ┌────────────────────────┐
                    │ Python scanners (pure) │
                    │ - crt.sh + DNS         │
                    │ - TCP probes           │
                    │ - HTTP fingerprint     │
                    │ - TLS inspection       │
                    │ - SPF/DKIM/DMARC       │
                    │ - Admin panels probe   │
                    └────────────────────────┘
```

Principi:
- **Boring stack**: Python 3.12 + FastAPI, Next.js 15, Postgres, Redis. Zero vendor lock-in.
- **No binari esterni**: scanner in pure Python → deploy ovunque, nessuna dipendenza di sistema (`nmap`, `nuclei` etc. opzionali in versioni future).
- **Isolation tenant**: ogni query filtrata per `organization_id` → `tenant_id`. Test che falliscono se una query senza `tenant_id` passa (roadmap: RLS Postgres in v1.1).
- **Append-only audit log**: trigger Postgres blocca UPDATE/DELETE su `audit_logs`.

## Struttura repository

```
/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entrypoint
│   │   ├── config.py            # Pydantic Settings
│   │   ├── database.py          # SQLAlchemy engine/session
│   │   ├── deps.py              # FastAPI dependencies (auth, org, role)
│   │   ├── seed.py              # seed default plans
│   │   ├── models/              # SQLAlchemy models (11 entità)
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── api/                 # route modules
│   │   │   ├── auth.py
│   │   │   ├── tenants.py
│   │   │   ├── domains.py
│   │   │   ├── scans.py
│   │   │   ├── findings.py
│   │   │   ├── reports.py
│   │   │   ├── assets.py
│   │   │   ├── organizations.py
│   │   │   └── billing.py
│   │   ├── core/
│   │   │   ├── security.py      # bcrypt + JWT
│   │   │   └── scoring.py       # compute_score()
│   │   ├── scanners/            # pure-Python scanners
│   │   │   ├── subdomains.py
│   │   │   ├── dns_hygiene.py
│   │   │   ├── email_posture.py
│   │   │   ├── ports.py
│   │   │   ├── http_fingerprint.py
│   │   │   ├── ssl_checker.py
│   │   │   └── admin_panels.py
│   │   ├── services/
│   │   │   ├── scan_orchestrator.py   # merge assets/findings + scoring
│   │   │   ├── domain_validator.py    # DNS TXT ownership
│   │   │   └── report_generator.py    # WeasyPrint PDF
│   │   ├── tasks/
│   │   │   ├── celery_app.py
│   │   │   └── scan_tasks.py    # run_scan_task, schedule_periodic_scans
│   │   └── templates/
│   │       └── report.html      # template PDF
│   ├── alembic/                 # migrazioni DB
│   ├── tests/
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   │   ├── page.tsx             # landing page
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   ├── (app)/
│   │   │   ├── layout.tsx       # sidebar + auth guard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── tenants/page.tsx
│   │   │   ├── tenants/[id]/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── legal/
│   │       ├── terms/page.tsx
│   │       ├── privacy/page.tsx
│   │       ├── aup/page.tsx
│   │       └── dpa/page.tsx
│   ├── lib/api.ts
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml
├── .env.example
└── README_CONDOR.md
```

---

## Moduli scan inclusi

| Scanner | Tecniche | Findings prodotti |
|---|---|---|
| **Subdomain** | crt.sh (CT logs) + DNS bruteforce leggero | Asset `subdomain` |
| **DNS hygiene** | `dns.resolver`, CAA, NS, wildcard, dangling CNAME | ns_single, caa_missing, dangling_cname (high), wildcard |
| **Email posture** | SPF, DMARC, MTA-STS, DKIM selettori comuni | spf_missing (high), spf_all_permissive (critical), dmarc_missing (high), dmarc_policy_none (medium), dkim_not_detected |
| **Ports** | TCP connect top 30 porte, thread pool 50 | DB esposti (critical), RDP/SMB (critical), telnet (high) |
| **HTTP fingerprint** | GET HTTPS + HTTP, parsing title/server/headers | header_missing_hsts, header_missing_csp, x-powered-by disclosure |
| **SSL/TLS** | `ssl` stdlib, parse cert, SAN, TLS version | cert_expired (high), cert_expiring_soon (medium), weak_tls_version (high), hostname_mismatch |
| **Admin panels** | probe 22 paths (phpMyAdmin, .git, .env, Actuator, wp-admin, Swagger…) | Signature-based, severity variabile info→critical |

**Validazione ownership**: prima di qualsiasi scan attivo, il dominio deve avere `_condor-verify.<fqdn> IN TXT "condor-verify-<token>"`. Senza verifica, il lancio di scan restituisce 400.

## Scoring

Algoritmo trasparente in `app/core/scoring.py`:

```
score = 100
  - min(25 × #critical, 50)
  - min(10 × #high, 40)
  - min(3  × #medium, 25)
  - min(1  × #low, 10)
floor 0, cap 100
```

Grade: A ≥90 · B ≥75 · C ≥60 · D ≥40 · F <40.

Snapshot giornaliero in `score_history` per il trend 12 settimane nel PDF.

Falsi positivi: stato `false_positive` per finding; rimane suppress finché il fingerprint non cambia.

## API

Swagger: `http://localhost:8000/api/docs`

Principali endpoint:

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/api/auth/register` | Crea org + utente owner |
| POST | `/api/auth/login` | JWT access + refresh |
| GET | `/api/auth/me` | Info utente corrente |
| GET | `/api/tenants` | Lista clienti con score & delta |
| POST | `/api/tenants` | Crea cliente |
| GET | `/api/tenants/{id}/score-history` | Trend score |
| GET/POST | `/api/tenants/{id}/domains` | Domini |
| POST | `/api/tenants/{id}/domains/{did}/verify` | Verifica ownership DNS TXT |
| GET/POST | `/api/tenants/{id}/scans` | Lista / avvia scan |
| GET/PATCH | `/api/tenants/{id}/findings` | Findings + cambio status |
| GET/POST | `/api/tenants/{id}/reports` | Report list + generate |
| GET | `/api/tenants/{id}/reports/{rid}/download` | Download PDF |
| GET/PATCH | `/api/organization` + `/api/organization/branding` | Branding white-label |
| GET | `/api/organization/plans` | Piani disponibili |
| POST | `/api/billing/checkout-session` | Stripe checkout |

---

## Piani e pricing

| Piano | Prezzo | Max tenant | Max domini | White-label | Target |
|---|---|---|---|---|---|
| Trial | €0 (14gg) | 2 | 5 | nessuno | Onboarding |
| Solo | €49/mese | 3 | 10 | logo PDF | vCISO / freelance |
| MSP | €299/mese | 20 | 100 | logo + colori + UI | MSP piccoli |
| MSP Pro | €799/mese | 60 | 400 | completo + dominio custom | MSP medi |
| Enterprise | custom | ∞ | ∞ | source access, SLA | MSSP |

**Founder Plan**: primi 20 clienti paganti → sconto 50% lifetime lockato. Dopo i 20 il prezzo torna a listino.

---

## Deploy produzione

Raccomandazione: **Hetzner Cloud** (Germania/Finlandia) con Coolify o Dokploy.

Checklist pre-produzione:
- [ ] `APP_SECRET_KEY` generato con `openssl rand -hex 32`
- [ ] Postgres con backup giornaliero cifrato (pg_dump → S3 EU)
- [ ] Redis con password
- [ ] TLS su tutti gli endpoint (Caddy o Traefik con Let's Encrypt)
- [ ] Sentry per error tracking
- [ ] Uptime Kuma per monitoring
- [ ] Stripe Live key + webhook endpoint
- [ ] SMTP reale (Postmark EU consigliato)
- [ ] Rate limiting sull'API (middleware + Redis)
- [ ] Pentest interno prima del public launch

---

## Playbook di vendita

### Cold email (MSP target)

```
Oggetto: 3 domini del tuo cliente [NomeCliente] esposti pubblicamente

Ciao [Nome],

Ho dato un'occhiata rapida al portfolio pubblico di [MSP Nome]
e ho notato che [NomeClienteVisibile], uno dei vostri clienti citati
sul sito, ha 3 sottodomini con certificati SSL scaduti e un
pannello phpMyAdmin accessibile da internet.

Non è un audit, è OSINT pubblico fatto con Condor EASM, un tool
che sto sviluppando per MSP italiani: scansioni continue, report
PDF brandizzato col tuo logo, white-label completo.

Ti mando il mini-report PDF (2 pagine, no strings attached).
Se ha senso, 15 minuti di demo questa settimana?

[Nome]
[Link LinkedIn]
```

### Messaggio LinkedIn

```
Ciao [Nome], sto lanciando Condor EASM, piattaforma di Attack
Surface Monitoring white-label per MSP italiani. Ho scansionato
brevemente uno dei clienti che hai in bacheca e ho trovato un paio
di cose interessanti. Ti va se ti mando un mini-report gratuito?
Niente pitch, solo valore.
```

### Demo flow 15 minuti

```
00:00–01:00  Chi sono, 1 frase di posizionamento
01:00–03:00  Problema: "cosa vede un attaccante del tuo cliente?"
03:00–05:00  Aggiungi dominio live + validazione DNS TXT
05:00–08:00  Risultato scan live (con consenso, cliente reale)
08:00–11:00  Dashboard MSP multi-tenant + diff settimanale
11:00–13:00  Generi PDF brandizzato davanti al cliente
13:00–14:00  Pricing + Founder Plan (50% lifetime)
14:00–15:00  "Creiamo account insieme adesso?" (trial live)
```

### Discovery call — domande chiave

1. Quanti clienti attivi gestisci?
2. Che servizi cyber vendi oggi? Puntuali o ricorrenti?
3. Come monitori oggi l'esposizione esterna dei tuoi clienti?
4. Hai mai avuto un cliente "bucato" per qualcosa esposto che ti eri perso?
5. Usi Detectify / SecurityScorecard / Shodan oggi?
6. Che prezzo riesci ad accettare per un servizio ricorrente aggiuntivo al tuo cliente PMI?

### Obiezioni frequenti

| Obiezione | Risposta |
|---|---|
| "Ho già Nessus" | Nessus è VA puntuale e richiede autorizzazione per ogni target. Condor è esterno, continuo, zero-touch. Sono complementari. |
| "Costa troppo per i miei clienti" | Al piano MSP sono €15/cliente. Li rivendi a €50-80/mese. Margine 70%+. |
| "Non è una priorità" | NIS2 sta già spingendo le PMI. Arriva prima del competitor, vendi compliance oltre che sicurezza. |
| "Me lo faccio in casa" | Quanto tempo del tuo team vale il lavoro di mantenere recon + scanner + report? Break-even tipicamente al 3° cliente. |
| "Aspettiamo dopo le ferie" | Founder Plan chiude ai 20 clienti. Chi entra adesso ha prezzo bloccato lifetime. |

---

## Sicurezza ed etica

Condor è un prodotto di **monitoraggio difensivo**. Niente exploitation, niente brute-force, niente payload intrusivi.

Controlli attivi:
1. **Validazione DNS TXT** obbligatoria prima di ogni scan attivo
2. **Audit log append-only** di ogni azione utente
3. **Rate limit** globale + per dominio nello scanner (opinioni future: token bucket per tenant)
4. **Zero exploitation**: solo fingerprint, status code, response headers
5. **Refuse signup** senza email aziendale (futuro MX check strict)
6. **AUP** che vieta esplicitamente l'uso contro target non autorizzati

Docs legali (in `/frontend/app/legal/`):
- Terms of Service
- Privacy Policy (GDPR)
- Acceptable Use Policy
- Data Processing Agreement (DPA art. 28 GDPR)

---

## Roadmap

### v1.1 (1 mese)
- [ ] Postgres Row Level Security per tenant isolation a livello DB
- [ ] 2FA TOTP per utenti
- [ ] Webhook Slack/Teams
- [ ] API keys per integrazioni
- [ ] Integrazione Nuclei templates curati (opt-in)

### v2 (3-6 mesi)
- [ ] White-label completo: dominio custom + SMTP custom
- [ ] Compliance mapping NIS2 / ISO27001 / DORA
- [ ] Typo-squatting e certificati sospetti
- [ ] Integrazione Jira / ServiceNow / HaloPSA
- [ ] Dashboard read-only per cliente finale

### v3 (6-12 mesi)
- [ ] Modulo phishing simulation light
- [ ] Human risk score per dominio
- [ ] Dark web monitoring (IntelX / Hudson Rock API)
- [ ] Supply chain monitoring (domini fornitori cliente)
- [ ] Partner program revenue share
- [ ] Certificazione ISO 27001 azienda

---

## Licenza

Proprietaria. Tutti i diritti riservati. Per licenze speciali, white-label OEM o partnership: hello@condor-easm.example
