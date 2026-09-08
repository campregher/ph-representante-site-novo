import { notFound } from "next/navigation";
import { requireRole } from "@/lib/sistema/auth";
import { getRepresentada } from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import RepresentadaForm from "@/components/sistema/representadas/RepresentadaForm";

export default async function EditarRepresentadaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "gerente");
  const { id } = await params;
  const representada = await getRepresentada(id);
  if (!representada) notFound();

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Editar — ${representada.nome_fantasia || representada.razao_social}`} />
      <RepresentadaForm initial={representada} />
    </div>
  );
}
