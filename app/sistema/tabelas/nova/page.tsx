import { requireRole } from "@/lib/sistema/auth";
import { listRepresentadaOptions } from "@/lib/sistema/queries";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import TabelaForm from "@/components/sistema/tabelas/TabelaForm";

export default async function NovaTabelaPage({
  searchParams,
}: {
  searchParams: Promise<{ representada?: string }>;
}) {
  await requireRole("admin", "gerente");
  const { representada } = await searchParams;
  const repOptions = await listRepresentadaOptions();

  return (
    <div className="max-w-2xl">
      <PageHeader title="Nova tabela de preço" />
      {repOptions.length === 0 ? (
        <EmptyState
          title="Cadastre uma representada primeiro"
          description="Toda tabela de preço pertence a uma representada."
        />
      ) : (
        <TabelaForm representadaOptions={repOptions} lockRepresentada={representada} />
      )}
    </div>
  );
}
