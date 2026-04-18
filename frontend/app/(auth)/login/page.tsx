"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Shield } from "lucide-react";
import { api, setToken, setRefreshToken } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await api<{ access_token: string; refresh_token: string }>(
        "/api/auth/login",
        { method: "POST", body: JSON.stringify({ email, password }), auth: false }
      );
      setToken(res.access_token);
      setRefreshToken(res.refresh_token);
      router.push("/app/dashboard");
    } catch (e: any) {
      setErr(e.message || "Errore di login");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-slate-50">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl justify-center mb-8">
          <Shield className="text-brand-700" size={24} />
          Condor <span className="text-brand-700">EASM</span>
        </Link>
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-2">Accedi</h1>
          <p className="text-ink-500 mb-6">Entra nel tuo account MSP.</p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Password</label>
              <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-200 p-2 rounded">{err}</div>}
            <button type="submit" disabled={loading} className="btn btn-primary w-full">
              {loading ? "Accesso in corso…" : "Accedi"}
            </button>
          </form>
          <p className="text-sm text-ink-500 mt-6 text-center">
            Non hai un account? <Link href="/register" className="text-brand-700 font-medium hover:underline">Registrati</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
