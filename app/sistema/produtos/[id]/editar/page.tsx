import { notFound } from "next/navigation";
import { requireRole } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listRepresentadaOptions, listAllCategorias } from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import ProdutoForm from "@/components/sistema/produtos/ProdutoForm";
import type { Produto } from "@/lib/sistema/types";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "gerente");
  const { id } = await params;
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("produtos").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();

  const [repOptions, categorias] = await Promise.all([
    listRepresentadaOptions(),
    listAllCategorias(),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Editar — ${(data as Produto).nome}`} />
      <ProdutoForm
        initial={data as Produto}
        representadaOptions={repOptions}
        categorias={categorias}
      />
    </div>
  );
}
