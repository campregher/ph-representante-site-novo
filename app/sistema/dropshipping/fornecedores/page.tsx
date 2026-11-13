import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listDropFornecedores } from "@/lib/sistema/dropshipping";
import { PageHeader } from "@/components/sistema/ui/State";
import FornecedoresView from "@/components/sistema/dropshipping/FornecedoresView";

export default async function DropFornecedoresPage() {
  const profile = await requireSistemaProfile();
  const fornecedores = await listDropFornecedores();
  return (
    <div>
      <PageHeader title="Fornecedores" description="Fabricantes do catálogo de dropshipping." />
      <FornecedoresView fornecedores={fornecedores} podeEditar={canManage(profile.role)} />
    </div>
  );
}
