import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listDropProdutos, dropFornecedorOptions } from "@/lib/sistema/dropshipping";
import { PageHeader } from "@/components/sistema/ui/State";
import Filters from "@/components/sistema/Filters";
import ProdutosView from "@/components/sistema/dropshipping/ProdutosView";

export default async function DropProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();

  const [produtos, fornecedores] = await Promise.all([
    listDropProdutos({ busca }),
    dropFornecedorOptions(),
  ]);

  return (
    <div>
      <PageHeader title="Produtos" description="Catálogo do dropshipping — preço de CPF e CNPJ lado a lado." />
      <Filters searchPlaceholder="Buscar produto (SKU, nome)…" />
      <ProdutosView produtos={produtos} fornecedores={fornecedores} podeEditar={canManage(profile.role)} />
    </div>
  );
}
