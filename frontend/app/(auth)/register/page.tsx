"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";
import { api, setToken, setRefreshToken } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    organization_name: "",
    full_name: "",
    email: "",
    password: "",
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{ access_token: string; refresh_token: string }>(
        "/api/auth/register",
        { method: "POST", body: JSON.stringify(form), auth: false }
      );
      setToken(res.access_token);
      setRefreshToken(res.refresh_token);
      router.push("/app/dashboard");
    } catch (e: any) {
      setErr(e.message || "Errore di registrazione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-10 bg-slate-50">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl justify-center mb-8">
          <Shield className="text-brand-700" size={24} />
          Condor <span className="text-brand-700">EASM</span>
        </Link>
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">Prova gratis 14 giorni</h1>
          <p className="text-ink-500 mb-6">Nessuna carta di credito richiesta. 2 clienti inclusi nel trial.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Nome organizzazione (il tuo MSP)</label>
              <input required value={form.organization_name} onChange={(e) => setForm({ ...form, organization_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome e cognome</label>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email aziendale</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password (min 10 caratteri)</label>
              <input type="password" required minLength={10} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{err}</div>}
            <p className="text-xs text-ink-500">
              Registrandoti accetti i <Link href="/legal/terms" className="underline">Termini</Link>, la <Link href="/legal/privacy" className="underline">Privacy Policy</Link> e la <Link href="/legal/aup" className="underline">Acceptable Use Policy</Link>. Dichiari di avere autorizzazione a monitorare i domini che aggiungerai.
            </p>
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? "Creazione account…" : "Crea account gratuito"}
            </button>
          </form>
          <p className="text-sm text-ink-500 mt-6 text-center">
            Hai già un account? <Link href="/login" className="text-brand-700 font-medium hover:underline">Accedi</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
