"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LayoutDashboard, ShoppingBag, BarChart3, User, LogOut, Building2, CalendarDays, Store } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

const links = [
  { href: "/portal/dashboard",  label: "Dashboard",        icon: LayoutDashboard },
  { href: "/portal/marcas",     label: "Marcas",           icon: Store           },
  { href: "/portal/orcamentos", label: "Pedidos",          icon: ShoppingBag     },
  { href: "/portal/cobrancas",  label: "Faturamento",      icon: CalendarDays    },
  { href: "/portal/valores",    label: "Valores por Marca",icon: BarChart3       },
  { href: "/portal/perfil",     label: "Perfil",           icon: User            },
];

export default function ClienteMenuLateral() {
  const pathname = usePathname();
  const router   = useRouter();
  const [logoUrl,  setLogoUrl]  = useState<string | null>(null);
  const [empresa,  setEmpresa]  = useState<string>("");

  useEffect(() => {
    fetch("/api/portal/perfil")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setLogoUrl(d.logo_url ?? null);
        setEmpresa(d.nome_fantasia || d.razao_social || "");
      })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <aside className="w-52 flex-shrink-0 min-h-screen bg-dark-900 border-r border-white/8 flex flex-col">

      {/* Cabeçalho com logo do cliente */}
      <div className="px-4 py-4 border-b border-white/8">
        <Link href="/portal/perfil" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-dark-700 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:border-brand/30 transition-all">
            {logoUrl ? (
              <Image src={logoUrl} alt="Logo" width={40} height={40} className="object-contain w-full h-full p-1" unoptimized />
            ) : (
              <Building2 size={18} className="text-gray-500" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate leading-tight group-hover:text-brand transition-colors">
              {empresa || "Minha empresa"}
            </p>
            <p className="text-[10px] text-gray-600 mt-0.5 uppercase tracking-wide">Portal do Cliente</p>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const base   = href.split("#")[0];
          const active = base === "/portal/dashboard"
            ? pathname === "/portal/dashboard"
            : pathname.startsWith(base);
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all ${
                active
                  ? "bg-brand/15 text-white border border-brand/20 font-semibold"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon size={14} className={active ? "text-brand" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-white/8">
        <button onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-500 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <LogOut size={14} /> Sair
        </button>
      </div>
    </aside>
  );
}
