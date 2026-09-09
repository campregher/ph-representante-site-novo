import { requireRole } from "@/lib/sistema/auth";
import { fornecedorOptions, produtoProprioOptions } from "@/lib/sistema/estoque";
import { PageHeader } from "@/components/sistema/ui/State";
import CompraForm from "@/components/sistema/estoque/CompraForm";

export default async function NovaCompraPage() {
  await requireRole("admin", "gerente");
  const [fornecedores, produtos] = await Promise.all([fornecedorOptions(), produtoProprioOptions()]);
  return (
    <div>
      <PageHeader title="Nova compra" description="Dá entrada no estoque e atualiza o custo médio." />
      <CompraForm fornecedores={fornecedores} produtos={produtos} />
    </div>
  );
}
