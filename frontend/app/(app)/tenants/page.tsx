"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type T = { id: string; name: string; current_score: number; current_grade: string };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<T[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const t = await api<T[]>("/api/tenants");
    setTenants(t);
  }
  useEffect(() => { load(); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api("/api/tenants", { method: "POST", body: JSON.stringify({ name, contact_email: contact || null }) });
      setName(""); setContact(""); setShowForm(false);
      await load();
    } catch (e: any) {
      setErr(e.message);
    }
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Clienti</h1>
          <p className="text-ink-500">Gestisci i tuoi tenant.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn btn-primary">
          {showForm ? "Annulla" : "+ Nuovo cliente"}
        </button>
      </div>

      {showForm && (
        <div className="card p-6 mb-6">
          <form onSubmit={create} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-sm font-medium mb-1">Nome cliente</label>
              <input required value={name} onChange={(e) => setName(e.target.value)}
                placeholder="es. ACME S.p.A."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email di contatto (opzionale)</label>
              <input type="email" value={contact} onChange={(e) => setContact(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{err}</div>}
            <button type="submit" className="btn btn-primary">Crea cliente</button>
          </form>
        </div>
      )}

      <div className="card overflow-hidden">
        {tenants.length === 0 ? (
          <div className="p-10 text-center text-ink-500">Nessun cliente. Crea il primo.</div>
        ) : (
          <ul>
            {tenants.map((t) => (
              <li key={t.id} className="border-b border-slate-100 last:border-0">
                <Link href={`/app/tenants/${t.id}`} className="flex items-center justify-between p-4 hover:bg-slate-50">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    <div className="text-xs text-ink-500">ID: {t.id.substring(0, 8)}…</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-lg font-bold grade-${t.current_grade}`}>{t.current_grade}</span>
                    <span className="text-xl font-bold">{t.current_score}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
