"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Shield, LayoutDashboard, Users, Settings, LogOut, FileText } from "lucide-react";
import { api, getToken, clearTokens } from "@/lib/api";

type Me = { email: string; full_name: string | null; role: string; organization_name: string; plan_code: string | null };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    api<Me>("/api/auth/me").then((u) => {
      setMe(u);
      setLoading(false);
    }).catch(() => {
      clearTokens();
      router.push("/login");
    });
  }, [router]);

  function logout() {
    clearTokens();
    router.push("/login");
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-ink-500">Caricamento…</div>;
  }

  const nav = [
    { href: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/app/tenants", label: "Clienti", icon: Users },
    { href: "/app/reports", label: "Report", icon: FileText },
    { href: "/app/settings", label: "Impostazioni", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 bg-ink-900 text-slate-200 flex flex-col">
        <div className="p-5 border-b border-ink-800">
          <Link href="/app/dashboard" className="flex items-center gap-2 font-bold text-white">
            <Shield className="text-brand-500" size={22} />
            Condor EASM
          </Link>
          <div className="text-xs text-slate-400 mt-2 truncate">{me?.organization_name}</div>
          {me?.plan_code && <div className="text-xs text-brand-400 mt-1">Piano: {me.plan_code}</div>}
        </div>
        <nav className="flex-1 py-4">
          {nav.map((n) => {
            const active = pathname?.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={`flex items-center gap-3 px-5 py-2.5 text-sm ${active ? "bg-ink-800 text-white border-l-2 border-brand-500" : "hover:bg-ink-800"}`}>
                <n.icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-ink-800 text-xs">
          <div className="text-slate-400 mb-2 truncate">{me?.email}</div>
          <button onClick={logout} className="flex items-center gap-2 text-slate-300 hover:text-white">
            <LogOut size={16} />
            Esci
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
