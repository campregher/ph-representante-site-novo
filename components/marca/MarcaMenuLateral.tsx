"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Users, Receipt, History, BarChart2, LogOut, Package, Building2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

interface Props { marcaSlug: string; marcaNome: string; marcaLogo?: string | null }

const links = [
  { href: "/marca/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { href: "/marca/pedidos",    label: "Pedidos",     icon: ShoppingBag     },
  { href: "/marca/produtos",   label: "Produtos",    icon: Package         },
  { href: "/marca/clientes",   label: "Clientes",    icon: Users           },
  { href: "/marca/cobranca",   label: "Faturamento",  icon: Receipt         },
  { href: "/marca/historico",  label: "Histórico",   icon: History         },
  { href: "/marca/relatorio",  label: "Relatório",   icon: BarChart2       },
  { href: "/marca/perfil",     label: "Perfil",      icon: Building2       },
];

export default function MarcaMenuLateral({ marcaNome, marcaLogo }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/marca/login");
    router.refresh();
  }

  return (
    <aside className="w-52 flex-shrink-0 min-h-screen bg-dark-900 border-r border-white/8 flex flex-col">
      <div className="px-5 py-4 border-b border-white/8">
        {marcaLogo ? (
          <Image src={marcaLogo} alt={marcaNome} width={120} height={32} className="object-contain h-7 w-auto" />
        ) : (
          <p className="text-sm font-black text-white truncate">{marcaNome}</p>
        )}
        <p className="text-[10px] text-gray-600 mt-1 uppercase tracking-wide">Painel da Marca</p>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {links.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== "/marca/dashboard" && pathname.startsWith(href));
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
