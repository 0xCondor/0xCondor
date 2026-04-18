export default function DPA() {
  return (
    <article className="max-w-3xl mx-auto p-10 prose prose-slate">
      <h1>Data Processing Agreement (DPA)</h1>
      <p><em>Template B2B — art. 28 GDPR. Versione 1.0.</em></p>

      <h2>1. Ruoli</h2>
      <p>Il Cliente è Titolare del trattamento. Condor EASM è Responsabile del trattamento (data processor) per i dati personali eventualmente presenti nei domini monitorati e negli asset discovery.</p>

      <h2>2. Oggetto</h2>
      <p>Trattamento strumentale all&apos;esecuzione del Servizio: scansione di domini autorizzati, discovery di asset pubblici, logging, generazione report.</p>

      <h2>3. Durata</h2>
      <p>Durata del contratto + 30 giorni per restituzione/cancellazione.</p>

      <h2>4. Obblighi del Responsabile</h2>
      <ul>
        <li>Trattare i dati solo su istruzione documentata del Titolare.</li>
        <li>Garantire riservatezza del personale autorizzato.</li>
        <li>Adottare misure di sicurezza art. 32 GDPR.</li>
        <li>Notificare data breach al Titolare entro 48 ore.</li>
        <li>Assistere il Titolare per DPIA, diritti degli interessati, audit.</li>
        <li>Restituire/cancellare dati alla fine del servizio.</li>
      </ul>

      <h2>5. Sub-responsabili autorizzati</h2>
      <p>Hetzner (hosting UE), Stripe (pagamenti UE), Postmark/Brevo (email UE). Cambiamenti comunicati con preavviso di 30 giorni.</p>

      <h2>6. Trasferimenti</h2>
      <p>Nessun trasferimento extra-UE senza SCC e TIA.</p>

      <h2>7. Audit</h2>
      <p>Il Titolare può richiedere evidenze di compliance una volta all&apos;anno, tramite report di audit di terza parte (SOC2/ISO27001 quando disponibile).</p>

      <h2>8. Firma</h2>
      <p>Questo DPA è parte integrante dei Termini di Servizio. Per versione firmata scrivere a legal@condor-easm.example.</p>
    </article>
  );
}
