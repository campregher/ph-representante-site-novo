import { requireSeller } from "@/lib/sistema/seller-auth";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import AlterarSenhaForm from "@/components/drop/AlterarSenhaForm";
import FaturadorConfigCard from "@/components/drop/FaturadorConfigCard";

export default async function DropDashboardConfiguracaoPage() {
  const seller = await requireSeller();
  const db = await createSistemaAdminClient();
  const { data } = await db.from("clientes").select("faturador_ml_ativo").eq("id", seller.id).maybeSingle();

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Configuração</h1>
      <FaturadorConfigCard initial={!!data?.faturador_ml_ativo} />
      <AlterarSenhaForm />
    </div>
  );
}
