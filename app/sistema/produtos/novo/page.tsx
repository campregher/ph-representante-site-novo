import { requireRole } from "@/lib/sistema/auth";
import { listRepresentadaOptions, listAllCategorias } from "@/lib/sistema/queries";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import ProdutoForm from "@/components/sistema/produtos/ProdutoForm";

export default async function NovoProdutoPage({
  searchParams,
}: {
  searchParams: Promise<{ representada?: string }>;
}) {
  await requireRole("admin", "gerente");
  const { representada } = await searchParams;
  const [repOptions, categorias] = await Promise.all([
    listRepresentadaOptions(),
    listAllCategorias(),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader title="Novo produto" />
      {repOptions.length === 0 ? (
        <EmptyState
          title="Cadastre uma representada primeiro"
          description="Todo produto pertence a uma representada."
        />
      ) : (
        <ProdutoForm
          representadaOptions={repOptions}
          categorias={categorias}
          lockRepresentada={representada}
        />
      )}
    </div>
  );
}
