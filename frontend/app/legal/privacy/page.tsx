export default function Privacy() {
  return (
    <article className="max-w-3xl mx-auto p-10 prose prose-slate">
      <h1>Privacy Policy</h1>
      <p><em>Ultimo aggiornamento: 18 aprile 2026</em></p>

      <h2>1. Titolare del trattamento</h2>
      <p>Condor EASM [ragione sociale da completare], con sede in [indirizzo], P.IVA [xxx], email privacy@condor-easm.example.</p>

      <h2>2. Finalità e base giuridica</h2>
      <ul>
        <li>Esecuzione del contratto (art. 6.1.b GDPR) — erogazione del Servizio.</li>
        <li>Legittimo interesse (art. 6.1.f) — logging per sicurezza, prevenzione frodi, accountability.</li>
        <li>Obblighi legali (art. 6.1.c) — fatturazione, conservazione contabile.</li>
      </ul>

      <h2>3. Dati trattati</h2>
      <ul>
        <li>Dati account utente: email, nome, organizzazione, password (hash bcrypt).</li>
        <li>Dati di utilizzo: audit log di azioni, IP, user agent.</li>
        <li>Dati di scansione: domini monitorati (solo dopo validazione ownership), asset identificati, findings, report generati.</li>
        <li>Dati di fatturazione: gestiti da Stripe (sotto-processor autorizzato).</li>
      </ul>

      <h2>4. Sotto-processor</h2>
      <ul>
        <li><strong>Hetzner Online GmbH</strong> (Germania/Finlandia) — hosting infrastruttura e database.</li>
        <li><strong>Stripe Payments Europe</strong> (Irlanda) — pagamenti.</li>
        <li><strong>Postmark / Brevo</strong> (UE) — invio email transazionali.</li>
      </ul>

      <h2>5. Trasferimenti extra-UE</h2>
      <p>Nessun trasferimento extra-UE di dati cliente senza standard contractual clauses e valutazione d&apos;impatto.</p>

      <h2>6. Conservazione</h2>
      <ul>
        <li>Dati account: per la durata del contratto + 12 mesi.</li>
        <li>Audit log: 24 mesi (append-only).</li>
        <li>Dati di scansione: 12 mesi rolling.</li>
        <li>Dati di fatturazione: 10 anni (obbligo fiscale).</li>
      </ul>

      <h2>7. Diritti dell&apos;interessato</h2>
      <p>Accesso, rettifica, cancellazione, portabilità, limitazione, opposizione (artt. 15-22 GDPR). Esercitabili via email a privacy@condor-easm.example. Reclamo al Garante Privacy.</p>

      <h2>8. Sicurezza</h2>
      <p>Cifratura a riposo e in transito (TLS 1.3), RBAC, 2FA disponibile, audit log immutabile, backup cifrati, pentest semestrale.</p>
    </article>
  );
}
