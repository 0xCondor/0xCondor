"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Org = {
  id: string; name: string; slug: string;
  logo_url: string | null; primary_color: string | null;
  custom_domain: string | null; report_footer: string | null;
  plan_code: string | null;
};
type Plan = {
  code: string; name: string; price_monthly_eur: number;
  max_tenants: number; max_domains: number; white_label_level: string;
};

export default function SettingsPage() {
  const [org, setOrg] = useState<Org | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api<Org>("/api/organization").then(setOrg);
    api<Plan[]>("/api/organization/plans").then(setPlans);
  }, []);

  async function saveBranding(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    const updated = await api<Org>("/api/organization/branding", {
      method: "PATCH",
      body: JSON.stringify({
        logo_url: org.logo_url,
        primary_color: org.primary_color,
        custom_domain: org.custom_domain,
        report_footer: org.report_footer,
      }),
    });
    setOrg(updated);
    setMsg("Branding aggiornato.");
    setTimeout(() => setMsg(null), 3000);
  }

  async function upgrade(planCode: string) {
    const r = await api<{ checkout_url: string; note?: string }>(
      `/api/billing/checkout-session?plan_code=${planCode}`,
      { method: "POST" }
    );
    if (r.note) alert(r.note + "\n\nURL: " + r.checkout_url);
    else window.location.href = r.checkout_url;
  }

  if (!org) return <div className="p-8">Caricamento…</div>;

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-8">Impostazioni</h1>

      <section className="card p-6 mb-6">
        <h2 className="text-xl font-bold mb-1">Organizzazione</h2>
        <p className="text-sm text-ink-500 mb-4">Nome, slug e piano corrente.</p>
        <div className="grid md:grid-cols-3 gap-4 text-sm">
          <div><div className="text-ink-500">Nome</div><div className="font-medium">{org.name}</div></div>
          <div><div className="text-ink-500">Slug</div><div className="font-mono">{org.slug}</div></div>
          <div><div className="text-ink-500">Piano</div><div className="font-medium">{org.plan_code || "—"}</div></div>
        </div>
      </section>

      <section className="card p-6 mb-6">
        <h2 className="text-xl font-bold mb-1">Branding (white-label)</h2>
        <p className="text-sm text-ink-500 mb-4">Logo e colori usati nei report PDF consegnati ai tuoi clienti.</p>
        <form onSubmit={saveBranding} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium mb-1">URL Logo (PNG/SVG pubblico)</label>
            <input value={org.logo_url || ""} onChange={(e) => setOrg({ ...org, logo_url: e.target.value })}
              placeholder="https://tuomsp.it/logo.png"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Colore primario (hex)</label>
            <div className="flex gap-2">
              <input type="color" value={org.primary_color || "#0F766E"} onChange={(e) => setOrg({ ...org, primary_color: e.target.value })}
                className="w-12 h-10 border border-slate-300 rounded-lg" />
              <input value={org.primary_color || ""} onChange={(e) => setOrg({ ...org, primary_color: e.target.value })}
                placeholder="#0F766E"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg font-mono" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Footer report</label>
            <input value={org.report_footer || ""} onChange={(e) => setOrg({ ...org, report_footer: e.target.value })}
              placeholder="Tuo MSP S.r.l. — info@tuomsp.it"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Dominio custom (solo MSP Pro)</label>
            <input value={org.custom_domain || ""} onChange={(e) => setOrg({ ...org, custom_domain: e.target.value })}
              placeholder="app.tuomsp.it"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          {msg && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded">{msg}</div>}
          <button type="submit" className="btn btn-primary">Salva branding</button>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="text-xl font-bold mb-4">Piani disponibili</h2>
        <div className="grid md:grid-cols-2 gap-4">
          {plans.filter(p => p.code !== "trial").map((p) => (
            <div key={p.code} className={`p-4 border rounded-lg ${org.plan_code === p.code ? "border-brand-700 bg-brand-50" : "border-slate-200"}`}>
              <div className="flex items-baseline justify-between mb-2">
                <div className="font-bold text-lg">{p.name}</div>
                <div className="text-xl font-bold">€{p.price_monthly_eur}<span className="text-sm text-ink-500">/mese</span></div>
              </div>
              <ul className="text-sm text-ink-600 space-y-1 mb-3">
                <li>· {p.max_tenants} clienti</li>
                <li>· {p.max_domains} domini</li>
                <li>· White-label: {p.white_label_level}</li>
              </ul>
              {org.plan_code === p.code ? (
                <div className="text-sm font-medium text-brand-700">Piano attivo</div>
              ) : (
                <button onClick={() => upgrade(p.code)} className="btn btn-ghost w-full text-sm">Passa a {p.name}</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
