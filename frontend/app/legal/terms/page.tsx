export default function Terms() {
  return (
    <article className="max-w-3xl mx-auto p-10 prose prose-slate">
      <h1>Termini di Servizio</h1>
      <p><em>Ultimo aggiornamento: 18 aprile 2026</em></p>

      <h2>1. Oggetto</h2>
      <p>Condor EASM (&quot;Servizio&quot;) fornisce funzionalità di External Attack Surface Monitoring: discovery di asset pubblicamente esposti, verifica della posture di sicurezza (SSL/TLS, DNS, email), rilevazione di servizi e pannelli amministrativi esposti, scoring del rischio, report PDF, dashboard multi-tenant.</p>

      <h2>2. Uso consentito e vincolato</h2>
      <p>L&apos;utente si impegna a utilizzare il Servizio <strong>esclusivamente su domini di cui detiene la proprietà o per cui dispone di esplicita autorizzazione scritta da parte del titolare</strong>. Prima di qualsiasi scansione attiva è obbligatorio validare la proprietà del dominio tramite record DNS TXT.</p>
      <p>È espressamente vietato: utilizzare il Servizio per attività di enumerazione, scansione o raccolta di informazioni su domini, IP, infrastrutture o persone non autorizzate; utilizzare il Servizio in violazione del GDPR, della Legge 48/2008, dell&apos;art. 615-ter/quater/quinquies del Codice Penale italiano, del Computer Fraud and Abuse Act, o di qualunque altra normativa applicabile in materia di accesso abusivo a sistemi informatici.</p>

      <h2>3. Responsabilità dell&apos;utente</h2>
      <p>L&apos;utente garantisce di avere titolo a monitorare i domini aggiunti alla piattaforma. Condor EASM si riserva il diritto di sospendere account che violano questa clausola, di conservare log delle azioni per finalità di conformità e di collaborare con le autorità competenti in caso di violazioni.</p>

      <h2>4. Natura del Servizio</h2>
      <p>Il Servizio fornisce un&apos;analisi <strong>non intrusiva</strong> della superficie d&apos;attacco esterna. Non costituisce un penetration test, un audit di sicurezza completo, né sostituisce obblighi di compliance specifici. I risultati hanno natura informativa.</p>

      <h2>5. Dati e privacy</h2>
      <p>I dati sono ospitati in Unione Europea. Per il trattamento dei dati fare riferimento alla <a href="/legal/privacy">Privacy Policy</a> e al <a href="/legal/dpa">DPA</a>.</p>

      <h2>6. Pagamenti e cancellazione</h2>
      <p>Le sottoscrizioni sono mensili o annuali. L&apos;utente può cancellare in qualsiasi momento dalle impostazioni. Rimborso proporzionale entro 14 giorni dalla prima sottoscrizione a pagamento.</p>

      <h2>7. Limitazione di responsabilità</h2>
      <p>Il Servizio è fornito &quot;as is&quot;. La responsabilità massima di Condor EASM nei confronti dell&apos;utente è limitata all&apos;importo dei canoni pagati negli ultimi 12 mesi.</p>

      <h2>8. Foro competente</h2>
      <p>Legge italiana. Foro di [Città]. Clausola compromissoria per controversie B2B.</p>
    </article>
  );
}
