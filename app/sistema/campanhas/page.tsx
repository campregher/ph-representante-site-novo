import { requireSistemaProfile } from "@/lib/sistema/auth";
import { listRepresentadaOptions } from "@/lib/sistema/queries";
import { listModelos, listCampanhas } from "@/lib/sistema/campanhas";
import { PageHeader } from "@/components/sistema/ui/State";
import CampanhasView from "@/components/sistema/campanhas/CampanhasView";

export default async function CampanhasPage() {
  await requireSistemaProfile();

  const [modelos, campanhas, representadas] = await Promise.all([
    listModelos(),
    listCampanhas(),
    listRepresentadaOptions(),
  ]);

  return (
    <div>
      <PageHeader
        title="Campanhas"
        description="E-mail de reativação para clientes inativos. Você envia só para os seus clientes."
      />
      <CampanhasView
        modelos={modelos}
        campanhas={campanhas}
        representadas={representadas.map((r) => ({ id: r.id, label: r.label }))}
      />
    </div>
  );
}
