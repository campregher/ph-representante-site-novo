import { requireRole } from "@/lib/sistema/auth";
import { listRepresentadaOptions } from "@/lib/sistema/queries";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import ImportWizard from "@/components/sistema/produtos/ImportWizard";

export default async function ImportarProdutosPage() {
  await requireRole("admin", "gerente");
  const repOptions = await listRepresentadaOptions();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Importar produtos"
        description="Excel (.xlsx/.xls) ou CSV com os dados do produto + preço bruto. Nada é gravado sem confirmação."
      />
      {repOptions.length === 0 ? (
        <EmptyState
          title="Cadastre uma representada primeiro"
          description="A importação sempre vincula os produtos a uma representada."
        />
      ) : (
        <ImportWizard representadaOptions={repOptions} />
      )}
    </div>
  );
}
