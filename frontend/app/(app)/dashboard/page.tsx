"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AlertTriangle, ShieldCheck, TrendingDown, Plus } from "lucide-react";

type TenantItem = {
  id: string; name: string; current_score: number; current_grade: string;
  last_scan_at: string | null; findings_open: number; findings_critical: number;
  findings_high: number; delta_7d: number;
};

export default function DashboardPage() {
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<TenantItem[]>("/api/tenants").then((t) => {
      setTenants(t);
      setLoading(false);
    });
  }, []);

  const totals = tenants.reduce(
    (acc, t) => ({
      critical: acc.critical + t.findings_critical,
      high: acc.high + t.findings_high,
      open: acc.open + t.findings_open,
      avgScore: acc.avgScore + t.current_score,
    }),
    { critical: 0, high: 0, open: 0, avgScore: 0 }
  );
  const avg = tenants.length ? Math.round(totals.avgScore / tenants.length) : 0;

  return (
    <div className="p-8 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-ink-500 mt-1">Panoramica di tutti i tuoi clienti monitorati.</p>
        </div>
        <Link href="/app/tenants" className="btn btn-primary">
          <Plus size={18} className="mr-1" />
          Nuovo cliente
        </Link>
      </div>

      <div className="grid md:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Clienti monitorati" value={tenants.length} icon={<ShieldCheck size={22} className="text-brand-600" />} />
        <KpiCard label="Findings critici" value={totals.critical} tone="red" icon={<AlertTriangle size={22} className="text-red-600" />} />
        <KpiCard label="Findings high" value={totals.high} tone="orange" icon={<AlertTriangle size={22} className="text-orange-600" />} />
        <KpiCard label="Score medio" value={avg} suffix="/100" tone={avg >= 75 ? "green" : avg >= 50 ? "amber" : "red"} icon={<TrendingDown size={22} />} />
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold">Clienti ordinati per rischio</h2>
          <span className="text-xs text-ink-500">{tenants.length} totali</span>
        </div>
        {loading ? (
          <div className="p-10 text-center text-ink-500">Caricamento…</div>
        ) : tenants.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-ink-600 mb-4">Nessun cliente ancora. Aggiungi il primo per iniziare.</p>
            <Link href="/app/tenants" className="btn btn-primary">Aggiungi cliente</Link>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 text-xs uppercase text-ink-500">
              <tr>
                <th className="text-left p-3">Cliente</th>
                <th className="text-center p-3">Score</th>
                <th className="text-center p-3">Grade</th>
                <th className="text-center p-3">Δ 7gg</th>
                <th className="text-center p-3">Critical</th>
                <th className="text-center p-3">High</th>
                <th className="text-center p-3">Aperti</th>
                <th className="text-right p-3">Ultimo scan</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="p-3">
                    <Link href={`/app/tenants/${t.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {t.name}
                    </Link>
                  </td>
                  <td className="p-3 text-center font-bold">{t.current_score}</td>
                  <td className={`p-3 text-center font-bold grade-${t.current_grade}`}>{t.current_grade}</td>
                  <td className={`p-3 text-center text-sm font-medium ${t.delta_7d < 0 ? "text-red-600" : t.delta_7d > 0 ? "text-emerald-600" : "text-ink-500"}`}>
                    {t.delta_7d > 0 ? "+" : ""}{t.delta_7d}
                  </td>
                  <td className="p-3 text-center">
                    {t.findings_critical > 0 ? <span className="inline-block min-w-[2rem] px-2 py-0.5 bg-red-900 text-white rounded font-bold text-xs">{t.findings_critical}</span> : <span className="text-ink-300">0</span>}
                  </td>
                  <td className="p-3 text-center">
                    {t.findings_high > 0 ? <span className="inline-block min-w-[2rem] px-2 py-0.5 bg-red-600 text-white rounded font-bold text-xs">{t.findings_high}</span> : <span className="text-ink-300">0</span>}
                  </td>
                  <td className="p-3 text-center text-ink-600">{t.findings_open}</td>
                  <td className="p-3 text-right text-xs text-ink-500">
                    {t.last_scan_at ? new Date(t.last_scan_at).toLocaleDateString("it-IT") : "mai"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, suffix, tone, icon }: { label: string; value: number; suffix?: string; tone?: string; icon?: React.ReactNode }) {
  const toneCls =
    tone === "red" ? "text-red-700" :
    tone === "orange" ? "text-orange-600" :
    tone === "green" ? "text-emerald-600" :
    tone === "amber" ? "text-amber-600" : "text-ink-900";
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div className="text-sm text-ink-500">{label}</div>
        {icon}
      </div>
      <div className={`text-3xl font-bold mt-2 ${toneCls}`}>
        {value}{suffix && <span className="text-lg text-ink-500">{suffix}</span>}
      </div>
    </div>
  );
}
