import { requireRole } from "@/lib/sistema/auth";
import { listCategoriasLinhaPropria } from "@/lib/sistema/estoque";
import { PageHeader } from "@/components/sistema/ui/State";
import CategoriasLinhaPropriaManager from "@/components/sistema/estoque/CategoriasLinhaPropriaManager";

export default async function CategoriasLinhaPropriaPage() {
  await requireRole("admin", "gerente");
  const categorias = await listCategoriasLinhaPropria();
  return (
    <div>
      <PageHeader
        title="Categorias — Linha Própria"
        description="Margem mínima de revenda no drop, por categoria (o produto pode sobrescrever)."
      />
      <CategoriasLinhaPropriaManager categorias={categorias} />
    </div>
  );
}
