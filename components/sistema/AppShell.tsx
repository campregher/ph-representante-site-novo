"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, Search } from "lucide-react";
import { NAV_ITEMS } from "@/lib/sistema/nav";
import { ROLE_LABEL, type Role } from "@/lib/sistema/roles";
import type { Notificacao } from "@/lib/sistema/notificacoes";
import Breadcrumb from "./Breadcrumb";
import SignOutButton from "./SignOutButton";
import NotificacoesBell from "./NotificacoesBell";

interface Props {
  profile: { nome: string | null; email: string | null; role: Role };
  notificacoes?: { itens: Notificacao[]; naoLidas: number };
  children: React.ReactNode;
}

export default function AppShell({ profile, notificacoes, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const isActive = (href: string) =>
    href === "/sistema"
      ? pathname === "/sistema"
      : pathname === href || pathname.startsWith(href + "/");

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = busca.trim();
    if (!q) return;
    router.push(`/sistema/clientes?busca=${encodeURIComponent(q)}`);
  }

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand text-white"
                : "text-neutral-300 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const sidebarInner = (
    <>
      <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-5">
        <Image
          src="/images/ph.png"
          alt="PH Representante"
          width={120}
          height={30}
          className="h-7 w-auto object-contain"
        />
      </div>
      {nav}
      <div className="shrink-0 border-t border-white/10 px-5 py-3 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        Sistema Comercial
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar desktop */}
      <aside className="hidden w-64 shrink-0 flex-col bg-dark-700 lg:flex">
        {sidebarInner}
      </aside>

      {/* Drawer mobile */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-dark-700">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 text-neutral-400 hover:text-white"
              aria-label="Fechar menu"
            >
              <X size={18} />
            </button>
            {sidebarInner}
          </aside>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>

          <form onSubmit={onSearch} className="relative hidden max-w-md flex-1 sm:block">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
            />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar clientes, pedidos, produtos…"
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 py-2 pl-9 pr-3 text-sm text-neutral-700 placeholder-neutral-400 focus:border-brand/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/10"
            />
          </form>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {notificacoes && (
              <NotificacoesBell itens={notificacoes.itens} naoLidas={notificacoes.naoLidas} />
            )}
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold text-neutral-800">
                {profile.nome ?? profile.email}
              </div>
              <div className="text-[11px] text-neutral-400">{ROLE_LABEL[profile.role]}</div>
            </div>
            <SignOutButton />
          </div>
        </header>

        <div className="border-b border-neutral-200 bg-white px-4 py-2.5">
          <Breadcrumb />
        </div>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
