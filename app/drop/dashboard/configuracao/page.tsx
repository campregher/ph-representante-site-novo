import { requireSeller } from "@/lib/sistema/seller-auth";
import AlterarSenhaForm from "@/components/drop/AlterarSenhaForm";
import TrocarTipoPessoaForm from "@/components/drop/TrocarTipoPessoaForm";

export default async function DropDashboardConfiguracaoPage() {
  const seller = await requireSeller();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Configuração</h1>
      <TrocarTipoPessoaForm portalToken={seller.portalToken} tipoPessoaAtual={seller.tipoPessoa} />
      <AlterarSenhaForm />
    </div>
  );
}
