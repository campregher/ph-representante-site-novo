import { requireRole } from "@/lib/sistema/auth";
import { fornecedorOptions } from "@/lib/sistema/estoque";
import { PageHeader } from "@/components/sistema/ui/State";
import ProdutoProprioForm from "@/components/sistema/estoque/ProdutoProprioForm";

export default async function NovoProdutoProprioPage() {
  await requireRole("admin", "gerente");
  const fornecedores = await fornecedorOptions();
  return (
    <div>
      <PageHeader title="Novo produto (linha própria)" />
      <ProdutoProprioForm fornecedores={fornecedores} />
    </div>
  );
}
