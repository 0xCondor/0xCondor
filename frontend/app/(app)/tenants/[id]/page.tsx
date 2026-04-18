"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { PlayCircle, FileDown, RefreshCw, AlertTriangle } from "lucide-react";

type Tenant = { id: string; name: string; current_score: number; current_grade: string; last_scan_at: string | null };
type Domain = { id: string; fqdn: string; is_primary: boolean; verification_token: string; ownership_verified_at: string | null };
type Finding = { id: string; check_id: string; asset_value: string; severity: string; status: string; title: string; description: string; remediation: string; last_seen_at: string };
type Scan = { id: string; status: string; started_at: string | null; finished_at: string | null; stats: any };

const SEV_LABEL: Record<string, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low", info: "Info" };

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [scans, setScans] = useState<Scan[]>([]);
  const [tab, setTab] = useState<"findings" | "domains" | "scans">("findings");
  const [showAdd, setShowAdd] = useState(false);
  const [newFqdn, setNewFqdn] = useState("");
  const [verifyMsg, setVerifyMsg] = useState<Record<string, string>>({});

  async function loadAll() {
    const [t, d, f, s] = await Promise.all([
      api<Tenant>(`/api/tenants/${id}`),
      api<Domain[]>(`/api/tenants/${id}/domains`),
      api<Finding[]>(`/api/tenants/${id}/findings`),
      api<Scan[]>(`/api/tenants/${id}/scans`),
    ]);
    setTenant(t); setDomains(d); setFindings(f); setScans(s);
  }
  useEffect(() => { loadAll(); }, [id]);

  async function addDomain(e: React.FormEvent) {
    e.preventDefault();
    await api(`/api/tenants/${id}/domains`, { method: "POST", body: JSON.stringify({ fqdn: newFqdn, is_primary: domains.length === 0 }) });
    setNewFqdn(""); setShowAdd(false); await loadAll();
  }
  async function verifyDomain(domainId: string) {
    const r = await api<{ verified: boolean; instructions: string | null }>(`/api/tenants/${id}/domains/${domainId}/verify`, { method: "POST" });
    setVerifyMsg({ ...verifyMsg, [domainId]: r.verified ? "verificato" : r.instructions || "non ancora verificato" });
    if (r.verified) await loadAll();
  }
  async function runScan(domainId: string) {
    await api(`/api/tenants/${id}/scans`, { method: "POST", body: JSON.stringify({ domain_id: domainId }) });
    setTimeout(loadAll, 2000);
  }
  async function generateReport() {
    await api(`/api/tenants/${id}/reports`, { method: "POST" });
    alert("Report generato. Vai su 'Report' per scaricarlo.");
  }
  async function updateFinding(findingId: string, status: string) {
    await api(`/api/tenants/${id}/findings/${findingId}`, { method: "PATCH", body: JSON.stringify({ status }) });
    await loadAll();
  }

  if (!tenant) return <div className="p-8">Caricamento…</div>;

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">{tenant.name}</h1>
          <p className="text-ink-500 mt-1">
            {tenant.last_scan_at ? `Ultima scansione: ${new Date(tenant.last_scan_at).toLocaleString("it-IT")}` : "Mai scansionato"}
          </p>
        </div>
        <button onClick={generateReport} className="btn btn-ghost">
          <FileDown size={18} className="mr-2" /> Genera report PDF
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="card p-5">
          <div className="text-sm text-ink-500">Security Score</div>
          <div className={`text-5xl font-bold grade-${tenant.current_grade}`}>{tenant.current_score}<span className="text-2xl text-ink-400">/100</span></div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink-500">Grade</div>
          <div className={`text-5xl font-bold grade-${tenant.current_grade}`}>{tenant.current_grade}</div>
        </div>
        <div className="card p-5">
          <div className="text-sm text-ink-500">Findings aperti</div>
          <div className="text-5xl font-bold">
            {findings.filter((f) => f.status === "open").length}
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200 flex gap-6 mb-6">
        {(["findings", "domains", "scans"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`py-3 text-sm font-medium border-b-2 -mb-px transition ${tab === t ? "border-brand-700 text-brand-700" : "border-transparent text-ink-500 hover:text-ink-700"}`}>
            {t === "findings" ? "Findings" : t === "domains" ? "Domini" : "Scansioni"}
          </button>
        ))}
      </div>

      {tab === "findings" && (
        <div className="card overflow-hidden">
          {findings.length === 0 ? (
            <div className="p-8 text-center text-ink-500">Nessun finding. Lancia una scansione.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="text-left p-3">Severity</th>
                  <th className="text-left p-3">Titolo</th>
                  <th className="text-left p-3">Asset</th>
                  <th className="text-center p-3">Stato</th>
                  <th className="text-right p-3">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((f) => (
                  <tr key={f.id} className="border-t border-slate-100">
                    <td className="p-3">
                      <span className={`sev-${f.severity} px-2 py-0.5 rounded text-xs font-bold uppercase`}>{SEV_LABEL[f.severity]}</span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{f.title}</div>
                      <div className="text-xs text-ink-500 mt-0.5">{f.description?.substring(0, 120)}{f.description?.length > 120 ? "…" : ""}</div>
                    </td>
                    <td className="p-3"><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{f.asset_value}</code></td>
                    <td className="p-3 text-center text-xs">{f.status}</td>
                    <td className="p-3 text-right">
                      {f.status === "open" && (
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => updateFinding(f.id, "resolved")} className="text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100">Risolto</button>
                          <button onClick={() => updateFinding(f.id, "false_positive")} className="text-xs px-2 py-1 bg-slate-100 text-ink-700 rounded hover:bg-slate-200">FP</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "domains" && (
        <div>
          <div className="mb-4 flex justify-end">
            <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary">
              {showAdd ? "Annulla" : "+ Aggiungi dominio"}
            </button>
          </div>
          {showAdd && (
            <div className="card p-5 mb-4">
              <form onSubmit={addDomain} className="flex gap-3 items-end max-w-2xl">
                <div className="flex-1">
                  <label className="block text-sm font-medium mb-1">FQDN (es. acme.it)</label>
                  <input required value={newFqdn} onChange={(e) => setNewFqdn(e.target.value)}
                    placeholder="acme.it"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                </div>
                <button className="btn btn-primary">Aggiungi</button>
              </form>
            </div>
          )}
          <div className="space-y-3">
            {domains.map((d) => {
              const verified = !!d.ownership_verified_at;
              return (
                <div key={d.id} className="card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-lg">{d.fqdn} {d.is_primary && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded ml-2">primario</span>}</div>
                      <div className="text-sm mt-1">
                        {verified ? (
                          <span className="text-emerald-600 font-medium">✓ Ownership verificata</span>
                        ) : (
                          <span className="text-amber-600 font-medium flex items-center gap-1"><AlertTriangle size={14} /> Ownership non verificata</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {!verified && (
                        <button onClick={() => verifyDomain(d.id)} className="btn btn-ghost text-sm">
                          <RefreshCw size={14} className="mr-1" /> Verifica
                        </button>
                      )}
                      {verified && (
                        <button onClick={() => runScan(d.id)} className="btn btn-primary text-sm">
                          <PlayCircle size={16} className="mr-1" /> Scan ora
                        </button>
                      )}
                    </div>
                  </div>
                  {!verified && (
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm">
                      <p className="mb-2"><strong>Istruzioni per validare l'ownership:</strong></p>
                      <p className="mb-1">Pubblica questo record TXT sul DNS del dominio:</p>
                      <pre className="bg-white p-2 rounded border border-amber-200 text-xs overflow-x-auto">
Nome:  _condor-verify.{d.fqdn}
Tipo:  TXT
Valore: {d.verification_token}
                      </pre>
                      <p className="mt-2 text-ink-600">Dopo aver pubblicato il record, clicca "Verifica" (propagazione DNS fino a 1h).</p>
                      {verifyMsg[d.id] && <p className="mt-2 text-xs text-ink-600"><em>{verifyMsg[d.id]}</em></p>}
                    </div>
                  )}
                </div>
              );
            })}
            {domains.length === 0 && <div className="card p-8 text-center text-ink-500">Nessun dominio. Aggiungi il primo.</div>}
          </div>
        </div>
      )}

      {tab === "scans" && (
        <div className="card overflow-hidden">
          {scans.length === 0 ? (
            <div className="p-8 text-center text-ink-500">Nessuna scansione ancora.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 text-xs uppercase text-ink-500">
                <tr>
                  <th className="text-left p-3">ID</th>
                  <th className="text-left p-3">Stato</th>
                  <th className="text-left p-3">Iniziata</th>
                  <th className="text-left p-3">Terminata</th>
                  <th className="text-right p-3">Findings</th>
                  <th className="text-right p-3">Assets</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((s) => (
                  <tr key={s.id} className="border-t border-slate-100">
                    <td className="p-3 font-mono text-xs">{s.id.substring(0, 8)}…</td>
                    <td className="p-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${s.status === "completed" ? "bg-emerald-100 text-emerald-800" : s.status === "failed" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs">{s.started_at ? new Date(s.started_at).toLocaleString("it-IT") : "—"}</td>
                    <td className="p-3 text-xs">{s.finished_at ? new Date(s.finished_at).toLocaleString("it-IT") : "—"}</td>
                    <td className="p-3 text-right">{s.stats?.findings_count ?? "—"}</td>
                    <td className="p-3 text-right">{s.stats?.assets_count ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
