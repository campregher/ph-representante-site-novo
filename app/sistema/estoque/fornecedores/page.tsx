import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listFornecedores } from "@/lib/sistema/estoque";
import { PageHeader } from "@/components/sistema/ui/State";
import FornecedoresView from "@/components/sistema/estoque/FornecedoresView";

export default async function FornecedoresPage() {
  const profile = await requireSistemaProfile();
  const fornecedores = await listFornecedores();
  return (
    <div>
      <PageHeader title="Fornecedores" description="De quem você compra os produtos da linha própria." />
      <FornecedoresView fornecedores={fornecedores} podeEditar={canManage(profile.role)} />
    </div>
  );
}
