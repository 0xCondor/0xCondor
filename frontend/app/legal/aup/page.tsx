export default function AUP() {
  return (
    <article className="max-w-3xl mx-auto p-10 prose prose-slate">
      <h1>Acceptable Use Policy</h1>
      <p><em>Versione 1.0 — 18 aprile 2026</em></p>

      <h2>1. Principio</h2>
      <p>Condor EASM è uno strumento di <strong>monitoraggio difensivo</strong>. Ogni utilizzo deve rispettare la legge, i diritti di terzi e le finalità legittime del Servizio.</p>

      <h2>2. Domini monitorabili</h2>
      <p>L&apos;utente può aggiungere alla piattaforma <strong>esclusivamente domini</strong>:</p>
      <ul>
        <li>di cui è proprietario o amministratore tecnico verificabile;</li>
        <li>per i quali dispone di <strong>autorizzazione scritta</strong> del titolare (es. contratto di servizio con il cliente PMI);</li>
        <li>la cui proprietà è stata verificata tramite record DNS TXT prima di qualsiasi scansione attiva.</li>
      </ul>

      <h2>3. Attività vietate</h2>
      <ul>
        <li>Utilizzo del Servizio per mappare infrastrutture di terzi senza autorizzazione.</li>
        <li>Ricerca di vulnerabilità su target non autorizzati anche a scopo di bug bounty.</li>
        <li>Tentativo di aggirare la validazione DNS TXT.</li>
        <li>Automazione massiva contro risorse pubbliche (es. scraping di motori di ricerca per popolare la piattaforma).</li>
        <li>Utilizzo delle evidenze per attività offensive, estorsive o di doxxing.</li>
        <li>Rivendita del Servizio al di fuori dei piani white-label ufficialmente autorizzati.</li>
      </ul>

      <h2>4. Best practice raccomandate per MSP</h2>
      <ul>
        <li>Includere nel contratto con il cliente una clausola specifica di &quot;continuous external monitoring&quot; con menzione esplicita a EASM.</li>
        <li>Conservare l&apos;autorizzazione scritta del cliente per almeno 5 anni.</li>
        <li>Non condividere credenziali della piattaforma fuori dal team autorizzato.</li>
      </ul>

      <h2>5. Enforcement</h2>
      <p>La violazione di questa AUP comporta la sospensione immediata dell&apos;account, la notifica alle autorità competenti quando applicabile e la conservazione degli audit log per finalità di accertamento.</p>
    </article>
  );
}
