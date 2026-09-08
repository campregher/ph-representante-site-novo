import { notFound } from "next/navigation";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listVendedorOptions } from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import ClienteForm from "@/components/sistema/clientes/ClienteForm";
import type { Cliente } from "@/lib/sistema/types";

export default async function EditarClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireSistemaProfile();
  const { id } = await params;
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("clientes").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const vendedorOptions = await listVendedorOptions();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Editar — ${(data as Cliente).nome_fantasia || (data as Cliente).razao_social}`}
      />
      <ClienteForm
        initial={data as Cliente}
        vendedorOptions={vendedorOptions}
        lockVendedor={profile.role === "vendedor"}
      />
    </div>
  );
}
