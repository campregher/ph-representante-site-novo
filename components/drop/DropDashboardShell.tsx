"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { DROP_NAV_ITEMS } from "@/lib/sistema/drop-nav";
import SignOutButton from "@/components/sistema/SignOutButton";

interface Props {
  seller: { nome: string; email: string | null };
  children: React.ReactNode;
}

export default function DropDashboardShell({ seller, children }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/drop/dashboard" ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const nav = (
    <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
      {DROP_NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-brand text-white" : "text-neutral-300 hover:bg-white/5 hover:text-white"
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
        Portal do Seller
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-64 shrink-0 flex-col bg-dark-700 lg:flex">{sidebarInner}</aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} aria-hidden />
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

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
            aria-label="Abrir menu"
          >
            <Menu size={18} />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold text-neutral-800">{seller.nome}</div>
              {seller.email && <div className="text-[11px] text-neutral-400">{seller.email}</div>}
            </div>
            <SignOutButton redirectTo="/drop/login" />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
