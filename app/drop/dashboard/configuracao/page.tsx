import { requireSeller } from "@/lib/sistema/seller-auth";
import AlterarSenhaForm from "@/components/drop/AlterarSenhaForm";

export default async function DropDashboardConfiguracaoPage() {
  await requireSeller();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Configuração</h1>
      <AlterarSenhaForm />
    </div>
  );
}
