"use client";
import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

type T = { id: string; name: string };
type R = { id: string; tenant_id: string; period_start: string; period_end: string; file_path: string | null; summary: any; generated_at: string };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export default function ReportsPage() {
  const [tenants, setTenants] = useState<T[]>([]);
  const [reports, setReports] = useState<Record<string, R[]>>({});

  useEffect(() => {
    async function load() {
      const ts = await api<T[]>("/api/tenants");
      setTenants(ts);
      const all: Record<string, R[]> = {};
      for (const t of ts) {
        all[t.id] = await api<R[]>(`/api/tenants/${t.id}/reports`);
      }
      setReports(all);
    }
    load();
  }, []);

  function download(tid: string, rid: string) {
    const token = getToken();
    fetch(`${API_BASE}/api/tenants/${tid}/reports/${rid}/download`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((b) => {
        const url = URL.createObjectURL(b);
        const a = document.createElement("a");
        a.href = url;
        a.download = `condor_report_${rid}.pdf`;
        a.click();
      });
  }

  return (
    <div className="p-8 max-w-6xl">
      <h1 className="text-3xl font-bold mb-8">Report PDF</h1>

      {tenants.length === 0 && <div className="card p-8 text-center text-ink-500">Nessun cliente. Aggiungi un cliente per generare report.</div>}

      <div className="space-y-6">
        {tenants.map((t) => (
          <div key={t.id} className="card overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50">
              <h2 className="font-semibold">{t.name}</h2>
            </div>
            {(reports[t.id] || []).length === 0 ? (
              <div className="p-6 text-sm text-ink-500">Nessun report. Vai al cliente e clicca "Genera report PDF".</div>
            ) : (
              <ul>
                {(reports[t.id] || []).map((r) => (
                  <li key={r.id} className="p-4 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="font-medium">Report {r.period_start} — {r.period_end}</div>
                      <div className="text-xs text-ink-500 mt-0.5">
                        Generato il {new Date(r.generated_at).toLocaleString("it-IT")} · Score: {r.summary?.score ?? "?"} / {r.summary?.grade ?? "?"}
                      </div>
                    </div>
                    <button onClick={() => download(t.id, r.id)} className="btn btn-ghost text-sm">Scarica</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
