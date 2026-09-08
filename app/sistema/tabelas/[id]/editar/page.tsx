import { notFound } from "next/navigation";
import { requireRole } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listRepresentadaOptions } from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import TabelaForm from "@/components/sistema/tabelas/TabelaForm";
import type { TabelaPreco } from "@/lib/sistema/types";

export default async function EditarTabelaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "gerente");
  const { id } = await params;
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("tabelas_preco").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const repOptions = await listRepresentadaOptions();

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Editar — ${(data as TabelaPreco).nome}`} />
      <TabelaForm initial={data as TabelaPreco} representadaOptions={repOptions} />
    </div>
  );
}
