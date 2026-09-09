import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Building2,
  Package,
  Tags,
  TrendingUp,
  Wallet,
  KanbanSquare,
  CheckSquare,
  BarChart3,
  Megaphone,
  Boxes,
  Banknote,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

/** Itens do menu lateral, na ordem do briefing. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/sistema", icon: LayoutDashboard },
  { label: "Pedidos", href: "/sistema/pedidos", icon: ShoppingCart },
  { label: "Clientes", href: "/sistema/clientes", icon: Users },
  { label: "Representadas", href: "/sistema/representadas", icon: Building2 },
  { label: "Produtos", href: "/sistema/produtos", icon: Package },
  { label: "Tabelas de Preço", href: "/sistema/tabelas", icon: Tags },
  { label: "Vendas", href: "/sistema/vendas", icon: TrendingUp },
  { label: "Comissões", href: "/sistema/comissoes", icon: Wallet },
  { label: "Linha Própria", href: "/sistema/estoque", icon: Boxes },
  { label: "Cobrança", href: "/sistema/cobranca", icon: Banknote },
  { label: "CRM", href: "/sistema/crm", icon: KanbanSquare },
  { label: "Tarefas", href: "/sistema/tarefas", icon: CheckSquare },
  { label: "Campanhas", href: "/sistema/campanhas", icon: Megaphone },
  { label: "Relatórios", href: "/sistema/relatorios", icon: BarChart3 },
  { label: "Configurações", href: "/sistema/configuracoes", icon: Settings },
];

/** Rótulos legíveis para o breadcrumb (por segmento de rota). */
export const SEGMENT_LABELS: Record<string, string> = {
  sistema: "Sistema",
  pedidos: "Pedidos",
  clientes: "Clientes",
  representadas: "Representadas",
  produtos: "Produtos",
  tabelas: "Tabelas de Preço",
  vendas: "Vendas",
  comissoes: "Comissões",
  crm: "CRM",
  tarefas: "Tarefas",
  campanhas: "Campanhas",
  estoque: "Linha Própria",
  fornecedores: "Fornecedores",
  compras: "Compras",
  movimentos: "Movimentos",
  cobranca: "Cobrança",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
  novo: "Novo",
  nova: "Nova",
  editar: "Editar",
  import: "Importar",
  "acesso-negado": "Acesso negado",
};

/** true se o segmento parece um id (uuid ou número) e deve virar "Detalhe" no breadcrumb. */
export function isIdSegment(seg: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(seg) || /^\d+$/.test(seg);
}
