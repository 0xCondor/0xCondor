# Security — Condor EASM

## Controlli di sicurezza applicativa

### Autenticazione
- Bcrypt per password hashing (cost 12)
- JWT access token (60 min) + refresh token (14 giorni)
- Validazione password minimo 10 caratteri
- Audit log di ogni login

### Autorizzazione
- Ruoli: `owner`, `admin`, `operator`, `readonly`
- Ogni endpoint protetto da dependency FastAPI
- Tenant isolation tramite `organization_id` filtering a livello service

### Tenant isolation (v1.0 → v1.1)
**v1.0 (attuale)**: filtering a livello applicativo. Ogni query passa per `organization_id` / `tenant_id`.
**v1.1 (pianificato)**: aggiunta Postgres Row Level Security con policy:
```sql
CREATE POLICY tenant_isolation ON findings
  USING (tenant_id = current_setting('app.current_tenant')::uuid);
```

### Scansioni — vincoli legali non aggirabili
1. **DNS TXT verification obbligatoria** prima di ogni scan attivo
2. Lancio scan su dominio non verificato → HTTP 400
3. Re-verifica pianificata dopo 90 giorni (v1.1)
4. Nessuna exploitation: fingerprint + response code + headers, mai payload intrusivi
5. Rate limiting self-imposed negli scanner (max 50 thread)

### Dati in transito e a riposo
- Produzione: TLS 1.3 obbligatorio (HSTS preload)
- Postgres: TDE-like via filesystem encryption Hetzner
- Backup cifrati (AES-256) su S3 EU

### Audit log
- Append-only (trigger Postgres `prevent_audit_mutation`)
- Campi: user_id, action, resource, IP, user_agent, metadata
- Conservazione 24 mesi

### Secrets management
- Dev: `.env` (mai committato)
- Prod: Doppler o SOPS+age
- `APP_SECRET_KEY` ruotato ogni 6 mesi

---

## Vulnerability disclosure

Segnalare vulnerabilità a `security@condor-easm.example` (PGP key disponibile).

SLA risposta: 72h. SLA fix: 14gg per high/critical.

Hall of Fame per ricercatori con disclosure responsabile.

---

## security.txt

```
Contact: mailto:security@condor-easm.example
Expires: 2027-04-18T00:00:00Z
Preferred-Languages: it, en
Canonical: https://condor-easm.example/.well-known/security.txt
Policy: https://condor-easm.example/legal/vulnerability-disclosure
```
