import Link from "next/link";
import { Shield, Eye, FileText, Bell, Users, Lock, CheckCircle2, ArrowRight } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-ink-900">
      {/* Nav */}
      <nav className="border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl">
            <Shield className="text-brand-700" size={24} />
            <span>Condor <span className="text-brand-700">EASM</span></span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <a href="#features" className="hover:text-brand-700">Funzioni</a>
            <a href="#pricing" className="hover:text-brand-700">Prezzi</a>
            <a href="#faq" className="hover:text-brand-700">FAQ</a>
            <Link href="/login" className="btn btn-ghost text-sm py-1.5">Accedi</Link>
            <Link href="/register" className="btn btn-primary text-sm py-1.5">Prova gratis</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1 rounded-full mb-4">
              <span className="w-2 h-2 rounded-full bg-brand-500"></span>
              Early access — Founder Plan disponibile
            </div>
            <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
              Monitora l'esposizione esterna dei tuoi clienti.
              <span className="text-brand-700"> Ogni settimana. Automaticamente.</span>
            </h1>
            <p className="text-lg text-ink-600 mb-8 leading-relaxed">
              La piattaforma di Attack Surface Monitoring <strong>white-label</strong> per
              MSP italiani. Aggiungi un servizio ricorrente al tuo portfolio in 5 minuti,
              con report PDF brandizzati e dashboard multi-cliente.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register" className="btn btn-primary">
                Prova gratis 14 giorni
                <ArrowRight size={18} className="ml-2" />
              </Link>
              <a href="#features" className="btn btn-ghost">Come funziona</a>
            </div>
            <p className="text-sm text-ink-500 mt-4">
              Nessuna carta richiesta · Validazione ownership obbligatoria · Dati in UE
            </p>
          </div>

          <div className="card p-6 bg-gradient-to-br from-slate-50 to-white">
            <div className="text-xs text-ink-500 mb-3">Dashboard MSP — 3 clienti</div>
            <div className="space-y-3">
              {[
                { name: "ACME S.p.A.", score: 87, grade: "B", crit: 0, high: 2 },
                { name: "Beta Logistics", score: 62, grade: "C", crit: 1, high: 5 },
                { name: "Studio Rossi", score: 41, grade: "D", crit: 3, high: 4 },
              ].map((t) => (
                <div key={t.name} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-200">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-ink-500">
                      {t.crit > 0 && <span className="text-red-700 font-semibold">{t.crit} critici</span>}
                      {t.crit > 0 && t.high > 0 && " · "}
                      {t.high > 0 && <span className="text-red-600">{t.high} high</span>}
                    </div>
                  </div>
                  <div className={`text-2xl font-bold grade-${t.grade}`}>{t.score}</div>
                </div>
              ))}
            </div>
            <button className="mt-4 btn btn-primary w-full">Genera report PDF</button>
          </div>
        </div>
      </section>

      {/* Proof bar */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6 py-6 text-center">
          <p className="text-sm text-ink-600">
            <strong>&quot;Finalmente un EASM che posso vendere ai miei clienti senza spiegare cosa sia.&quot;</strong>
            {" — MSP italiano in early access"}
          </p>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">
          I tuoi clienti non sanno cosa hanno esposto online.<br />
          <span className="text-ink-600 font-normal text-2xl">Neanche tu, finché non è tardi.</span>
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: Eye, t: "Domini fantasma", d: "Sottodomini creati dal marketing o da ex dipendenti, dimenticati nel DNS, ancora raggiungibili con SSL scaduti e CMS obsoleti." },
            { icon: Bell, t: "Cambiamenti silenziosi", d: "Un pannello admin esposto la notte di un deploy. Un .env committato per errore. Senza monitoring continuo, lo scopre l'attaccante prima di te." },
            { icon: FileText, t: "Email spoofing", d: "SPF mancante, DMARC in p=none. Chiunque può inviare email a nome dei tuoi clienti verso i loro partner e fornitori." },
          ].map((b, i) => (
            <div key={i} className="card p-6">
              <b.icon className="text-brand-700 mb-3" size={28} />
              <h3 className="font-bold text-lg mb-2">{b.t}</h3>
              <p className="text-ink-600">{b.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="features" className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-4">Come funziona</h2>
          <p className="text-center text-ink-600 mb-12 max-w-2xl mx-auto">
            Tre passaggi per iniziare a monitorare il primo cliente. Solo domini di cui dimostri la proprietà.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { n: "1", t: "Aggiungi il cliente", d: "Nome e dominio principale. Valida la proprietà con un record DNS TXT — richiede 2 minuti al tuo cliente." },
              { n: "2", t: "Scansioni automatiche", d: "La piattaforma scansiona ogni settimana: sottodomini, porte, SSL, DNS, posture email, pannelli admin esposti." },
              { n: "3", t: "Alert e report", d: "Ricevi alert su cambiamenti critici. Genera report PDF brandizzato mensile. Fattura il servizio al tuo cliente." },
            ].map((s) => (
              <div key={s.n} className="card p-6">
                <div className="w-10 h-10 bg-brand-700 text-white rounded-full flex items-center justify-center font-bold mb-4">{s.n}</div>
                <h3 className="font-bold text-lg mb-2">{s.t}</h3>
                <p className="text-ink-600">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Tutto quello che serve per vendere il servizio</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { t: "Discovery asset", d: "Sottodomini via Certificate Transparency, DNS probe, asset live su porte e HTTP." },
            { t: "SSL / TLS monitoring", d: "Scadenze, certificati non validi, versioni TLS obsolete. Alert 14 giorni prima della scadenza." },
            { t: "Posture email", d: "Controllo SPF, DKIM, DMARC, MTA-STS. Spiegazione pronta per il cliente." },
            { t: "Pannelli admin esposti", d: "Rileva phpMyAdmin, .git, .env, Spring Actuator, WordPress wp-admin, Swagger." },
            { t: "Porte aperte pericolose", d: "MySQL, Redis, MongoDB, RDP, SMB: severity critical quando esposti pubblicamente." },
            { t: "DNS hygiene", d: "Dangling CNAME, wildcard, CAA mancante, NS ridondanza — rischi subdomain takeover." },
            { t: "Security Score 0-100", d: "Grade A-F trasparente. Grafico di trend su 12 settimane." },
            { t: "Report PDF brandizzato", d: "Logo, colori e footer personalizzati. Pronto da consegnare al cliente." },
            { t: "Multi-tenant & audit log", d: "Isolamento dati per cliente, ruoli, audit log append-only. Pronto per NIS2." },
          ].map((f, i) => (
            <div key={i} className="flex items-start gap-3">
              <CheckCircle2 className="text-brand-600 shrink-0 mt-0.5" size={20} />
              <div>
                <div className="font-semibold">{f.t}</div>
                <div className="text-sm text-ink-600">{f.d}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="bg-slate-50 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-12">Pensato per te</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Users, t: "MSP / MSSP", d: "Aggiungi €30-€50/mese per cliente al tuo MRR. Report brandizzati mensili, dashboard unica, upsell consulenza." },
              { icon: Shield, t: "vCISO / consulente", d: "Giustifica il retainer con deliverable ricorrenti misurabili. Mostra trend oggettivi al C-level del cliente." },
              { icon: FileText, t: "Auditor & compliance", d: "Evidenza continua di monitoraggio per audit ISO27001, NIS2, DORA. Export e audit log completi." },
            ].map((u) => (
              <div key={u.t} className="card p-6">
                <u.icon className="text-brand-700 mb-3" size={28} />
                <h3 className="font-bold text-lg mb-2">{u.t}</h3>
                <p className="text-ink-600">{u.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-4">Prezzi trasparenti</h2>
        <p className="text-center text-ink-600 mb-12">
          No lock-in. Mensile. I primi 20 clienti ottengono il <strong>Founder Plan: 50% lifetime</strong>.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              name: "Solo", price: "€49", sub: "/mese",
              target: "vCISO e consulenti freelance",
              features: ["3 clienti", "10 domini", "Scan settimanale", "Report PDF con logo", "Alert email"],
              cta: "Inizia",
            },
            {
              name: "MSP", price: "€299", sub: "/mese", highlight: true,
              target: "MSP piccoli (fino a 20 clienti)",
              features: ["20 clienti", "100 domini", "Scan bi-settimanale", "White-label logo + colori", "API e webhook", "Supporto prioritario"],
              cta: "Più scelto",
            },
            {
              name: "MSP Pro", price: "€799", sub: "/mese",
              target: "MSP medi (fino a 60 clienti)",
              features: ["60 clienti", "400 domini", "Scan settimanale", "White-label completo + dominio custom", "SMTP personalizzato", "SSO SAML"],
              cta: "Scala",
            },
          ].map((p) => (
            <div key={p.name} className={`card p-6 ${p.highlight ? "border-brand-700 ring-2 ring-brand-100" : ""}`}>
              {p.highlight && <div className="text-xs font-bold text-brand-700 uppercase mb-2">Più scelto</div>}
              <h3 className="text-2xl font-bold">{p.name}</h3>
              <p className="text-sm text-ink-500 mt-1 h-10">{p.target}</p>
              <div className="mt-4 mb-6">
                <span className="text-4xl font-bold">{p.price}</span>
                <span className="text-ink-500">{p.sub}</span>
              </div>
              <ul className="space-y-2 mb-6">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="text-brand-600 shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link href="/register" className={`btn w-full ${p.highlight ? "btn-primary" : "btn-ghost"}`}>
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-sm text-ink-500 mt-8">
          Piano Enterprise / MSSP con SLA, on-prem e source access — <a href="mailto:hello@condor-easm.example" className="text-brand-700 underline">parla con noi</a>
        </p>
      </section>

      {/* Security */}
      <section className="bg-brand-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <Lock size={40} className="mx-auto mb-4 text-brand-100" />
          <h2 className="text-3xl font-bold mb-4">Sicurezza e privacy first</h2>
          <div className="grid md:grid-cols-4 gap-6 mt-8 text-sm text-left">
            {[
              ["Dati in UE", "Hosting Hetzner (Germania/Finlandia). Nessun trasferimento extra-UE senza DPA."],
              ["Ownership obbligatoria", "Nessuna scansione senza validazione DNS TXT del dominio."],
              ["Zero-exploit", "Scansioni passive e fingerprint. Nessun payload intrusivo o brute-force."],
              ["Audit log immutabile", "Ogni azione loggata. Pronto per audit ISO27001 e NIS2."],
            ].map(([t, d]) => (
              <div key={t}>
                <div className="font-bold mb-1">{t}</div>
                <div className="text-brand-100">{d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-center mb-12">Domande frequenti</h2>
        <div className="space-y-6">
          {[
            {
              q: "Posso scansionare un cliente senza autorizzazione?",
              a: "No. Prima di qualunque scansione attiva devi validare l'ownership del dominio con un record DNS TXT. Questo è un controllo legale non aggirabile per proteggere te e noi.",
            },
            {
              q: "Che differenza c'è con Nessus o Acunetix?",
              a: "Nessus e Acunetix sono vulnerability scanner tradizionali: scansioni puntuali, richiedono autorizzazione del cliente per ogni target, e si concentrano sul perimetro interno o DAST. Condor è un EASM: esterno, continuo, automatico, senza agent, focalizzato su asset shadow IT.",
            },
            {
              q: "Posso personalizzare i report con il mio logo?",
              a: "Sì. Dal piano MSP carichi logo, colori primari e footer del report. Dal piano MSP Pro anche dominio custom (app.tuomsp.it) e SMTP personalizzato per le notifiche.",
            },
            {
              q: "I dati dei miei clienti restano in Europa?",
              a: "Sì, sempre. Hosting su Hetzner in Germania/Finlandia, backup cifrati nella stessa regione, nessun sotto-processor extra-UE senza DPA.",
            },
            {
              q: "Posso cancellare quando voglio?",
              a: "Sì. Fatturazione mensile, no contratti annuali obbligatori, cancelli con un click. Rimborso proporzionale se cancelli entro 14 giorni.",
            },
            {
              q: "Supporto in italiano?",
              a: "Sì. Email e chat in italiano. Dal piano MSP Pro Slack dedicato con SLA 8h nei giorni lavorativi.",
            },
            {
              q: "È un penetration test?",
              a: "No. Condor è monitoraggio continuo non intrusivo, complementare a un pentest. Segnala cosa è esposto e configurato male, non sfrutta vulnerabilità.",
            },
          ].map((f, i) => (
            <details key={i} className="card p-5 group">
              <summary className="cursor-pointer font-semibold list-none flex items-center justify-between">
                <span>{f.q}</span>
                <span className="text-brand-700 group-open:rotate-45 transition">+</span>
              </summary>
              <p className="mt-3 text-ink-600 leading-relaxed">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-br from-brand-700 to-brand-900 text-white py-20">
        <div className="max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Il tuo prossimo cliente firma il contratto quando vede il primo report.
          </h2>
          <p className="text-brand-100 mb-8 text-lg">
            Prova gratis 14 giorni. Senza carta di credito. Setup in 5 minuti.
          </p>
          <Link href="/register" className="inline-flex items-center bg-white text-brand-800 font-semibold px-6 py-3 rounded-lg hover:bg-brand-50 transition">
            Inizia la prova gratuita
            <ArrowRight size={20} className="ml-2" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-sm text-ink-500">
          <div className="flex items-center gap-2 font-semibold text-ink-700">
            <Shield size={18} className="text-brand-700" />
            Condor EASM
          </div>
          <div className="flex flex-wrap gap-6">
            <a href="/legal/terms" className="hover:text-brand-700">Termini</a>
            <a href="/legal/privacy" className="hover:text-brand-700">Privacy</a>
            <a href="/legal/aup" className="hover:text-brand-700">Acceptable Use Policy</a>
            <a href="/legal/dpa" className="hover:text-brand-700">DPA</a>
            <a href="/.well-known/security.txt" className="hover:text-brand-700">security.txt</a>
          </div>
          <div>© {new Date().getFullYear()} Condor EASM</div>
        </div>
      </footer>
    </main>
  );
}
