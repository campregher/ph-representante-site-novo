import type { Metadata } from "next";
import { requireSeller } from "@/lib/sistema/seller-auth";
import DropDashboardShell from "@/components/drop/DropDashboardShell";

export const metadata: Metadata = {
  title: "Portal do Seller | PH Representante",
  robots: { index: false, follow: false },
};

/**
 * Só exige sessão válida aqui — cada página decide se precisa de
 * `seller.liberado` (Cadastro/Configuração continuam acessíveis mesmo com
 * cadastro pendente; Integração/Produtos/Anunciados/Métricas/Faturas não).
 */
export default async function DropDashboardLayout({ children }: { children: React.ReactNode }) {
  const seller = await requireSeller();

  return (
    <div data-sistema className="min-h-screen bg-neutral-50 text-neutral-900">
      <DropDashboardShell seller={{ nome: seller.nome, email: seller.email }}>{children}</DropDashboardShell>
    </div>
  );
}
