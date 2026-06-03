"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingBag, Package, Users, Building2 } from "lucide-react";

const links = [
  { href: "/marca/dashboard", label: "Início",   icon: LayoutDashboard },
  { href: "/marca/pedidos",   label: "Pedidos",  icon: ShoppingBag     },
  { href: "/marca/produtos",  label: "Produtos", icon: Package         },
  { href: "/marca/clientes",  label: "Clientes", icon: Users           },
  { href: "/marca/perfil",    label: "Perfil",   icon: Building2       },
];

export default function MarcaBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-900 border-t border-white/8 flex items-stretch">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/marca/dashboard"
          ? pathname === "/marca/dashboard"
          : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 transition-colors ${
              active ? "text-brand" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span className="text-[10px] font-medium leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
