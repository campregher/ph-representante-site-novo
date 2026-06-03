"use client";

import Link from "next/link";
import { Package, Upload, Home, Users, ClipboardList, Tag, Menu, X, History, LayoutDashboard, Receipt, BarChart2, Building2 } from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import SinoNotificacoes from "@/components/shared/SinoNotificacoes";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isLogin = pathname === "/admin/login";

  // Fecha ao navegar
  useEffect(() => { setOpen(false); }, [pathname]);

  if (isLogin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">

      {/* Topbar */}
      <header className="h-12 flex-shrink-0 bg-dark-900 border-b border-white/8 flex items-center px-4 gap-3 z-30">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-white/8 transition-all"
        >
          <Menu size={18} />
        </button>
        <p className="text-xs font-bold text-brand tracking-widest uppercase flex-1">PH Admin</p>
        <SinoNotificacoes />
      </header>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Drawer */}
      <aside className={`fixed top-0 left-0 z-50 h-full w-56 bg-dark-900 border-r border-white/8 flex flex-col transition-transform duration-200 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="px-4 py-4 border-b border-white/8 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-brand tracking-widest uppercase">PH Admin</p>
            <p className="text-xs text-gray-600 mt-0.5">Painel de controle</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <Link href="/admin"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <LayoutDashboard size={15} /> Dashboard
          </Link>
          <Link href="/admin/produtos"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Package size={15} /> Produtos
          </Link>
          <Link href="/admin/clientes"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Users size={15} /> Clientes
          </Link>
          <Link href="/admin/orcamentos"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <ClipboardList size={15} /> Pedidos
          </Link>
          <Link href="/admin/historico"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <History size={15} /> Histórico
          </Link>
          <Link href="/admin/cobranca"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Receipt size={15} /> Cobranças
          </Link>
          <Link href="/admin/relatorio"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <BarChart2 size={15} /> Relatório
          </Link>
          <Link href="/admin/marcas"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Tag size={15} /> Marcas
          </Link>
          <Link href="/admin/produtos/import"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Upload size={15} /> Importar Excel
          </Link>
          <Link href="/marca/dashboard"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Building2 size={15} /> Ver painel marca
          </Link>
          <Link href="/"
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Home size={15} /> Ver site
          </Link>
        </nav>

        <div className="p-3 border-t border-white/8">
          <LogoutButton />
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
