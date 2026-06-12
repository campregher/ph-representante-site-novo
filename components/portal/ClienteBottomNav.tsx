"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Store, ShoppingBag, Tag, User } from "lucide-react";

const links = [
  { href: "/portal/dashboard",     label: "Início",  icon: LayoutDashboard },
  { href: "/portal/marcas",        label: "Marcas",  icon: Store           },
  { href: "/portal/orcamentos",    label: "Pedidos", icon: ShoppingBag     },
  { href: "/portal/mercadolivre",  label: "ML",      icon: Tag             },
  { href: "/portal/perfil",        label: "Perfil",  icon: User            },
];

export default function ClienteBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-dark-900 border-t border-white/8 flex items-stretch">
      {links.map(({ href, label, icon: Icon }) => {
        const active = href === "/portal/dashboard"
          ? pathname === "/portal/dashboard"
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
