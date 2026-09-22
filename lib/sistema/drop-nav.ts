import {
  LayoutDashboard,
  UserSquare2,
  Plug,
  PackageSearch,
  Megaphone,
  Settings,
  LineChart,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export interface DropNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Menu lateral do portal do seller (/drop/dashboard). */
export const DROP_NAV_ITEMS: DropNavItem[] = [
  { label: "Início", href: "/drop/dashboard", icon: LayoutDashboard },
  { label: "Cadastro", href: "/drop/dashboard/cadastro", icon: UserSquare2 },
  { label: "Integração", href: "/drop/dashboard/integracao", icon: Plug },
  { label: "Produtos para Anunciar", href: "/drop/dashboard/produtos", icon: PackageSearch },
  { label: "Anunciados", href: "/drop/dashboard/anunciados", icon: Megaphone },
  { label: "Métricas", href: "/drop/dashboard/metricas", icon: LineChart },
  { label: "Faturas/Histórico", href: "/drop/dashboard/faturas", icon: Receipt },
  { label: "Configuração", href: "/drop/dashboard/configuracao", icon: Settings },
];
