import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { createSistemaClient } from "@/lib/supabase/server";
import {
  listClienteOptions,
  listRepresentadaOptions,
  listVendedorOptions,
  profileLabelMap,
} from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import CrmBoard, { type OportItem } from "@/components/sistema/crm/CrmBoard";

export default async function CrmPage() {
  const profile = await requireSistemaProfile();
  const podeAtribuir = canManage(profile.role);

  const supabase = await createSistemaClient();
  const [{ data: raw }, clientes, representadas, responsaveis, profMap] = await Promise.all([
    supabase
      .from("crm_oportunidades")
      .select(
        "id, cliente_id, responsavel_id, etapa, representada_id, valor_estimado, proxima_acao, data_proxima_acao, observacoes"
      )
      .order("data_proxima_acao", { ascending: true, nullsFirst: false })
      .limit(500),
    listClienteOptions(),
    listRepresentadaOptions(),
    podeAtribuir ? listVendedorOptions() : Promise.resolve([]),
    profileLabelMap(),
  ]);

  const cliNome = new Map(clientes.map((c) => [c.id, c.label]));
  const oportunidades: OportItem[] = (raw ?? [])
    .filter((o) => o.cliente_id)
    .map((o) => ({
      id: o.id as string,
      cliente_id: o.cliente_id as string,
      cliente: cliNome.get(o.cliente_id as string) ?? "—",
      responsavel_id: (o.responsavel_id as string) ?? null,
      responsavel: o.responsavel_id ? profMap.get(o.responsavel_id as string) ?? null : null,
      etapa: o.etapa as string,
      representada_id: (o.representada_id as string) ?? null,
      valor_estimado: Number(o.valor_estimado ?? 0),
      proxima_acao: (o.proxima_acao as string) ?? null,
      data_proxima_acao: (o.data_proxima_acao as string) ?? null,
      observacoes: (o.observacoes as string) ?? null,
    }));

  return (
    <div>
      <PageHeader
        title="CRM"
        description="Funil de oportunidades por etapa. Use ‹ › para avançar/voltar."
      />
      <CrmBoard
        oportunidades={oportunidades}
        clientes={clientes.map((c) => ({ id: c.id, label: c.label }))}
        representadas={representadas.map((r) => ({ id: r.id, label: r.label }))}
        responsaveis={responsaveis.map((r) => ({ id: r.id, label: r.label }))}
        podeAtribuir={podeAtribuir}
      />
    </div>
  );
}
