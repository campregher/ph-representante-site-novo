import { requireSeller } from "@/lib/sistema/seller-auth";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import CadastroSellerForm from "@/components/drop/CadastroSellerForm";
import type { MeuCadastroInput } from "@/lib/sistema/actions/seller-conta";

export default async function DropDashboardCadastroPage() {
  const seller = await requireSeller();
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("clientes")
    .select("razao_social, nome_fantasia, telefone, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, estado")
    .eq("id", seller.id)
    .single();

  const initial: MeuCadastroInput = {
    razao_social: (data?.razao_social as string) ?? "",
    nome_fantasia: (data?.nome_fantasia as string) ?? "",
    telefone: (data?.telefone as string) ?? "",
    whatsapp: (data?.whatsapp as string) ?? "",
    cep: (data?.cep as string) ?? "",
    logradouro: (data?.logradouro as string) ?? "",
    numero: (data?.numero as string) ?? "",
    complemento: (data?.complemento as string) ?? "",
    bairro: (data?.bairro as string) ?? "",
    cidade: (data?.cidade as string) ?? "",
    estado: (data?.estado as string) ?? "",
  };

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Cadastro</h1>
      <CadastroSellerForm initial={initial} />
    </div>
  );
}
