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
import TarefasView, { type TarefaItem } from "@/components/sistema/tarefas/TarefasView";

export default async function TarefasPage() {
  const profile = await requireSistemaProfile();
  const podeAtribuir = canManage(profile.role);

  const supabase = await createSistemaClient();
  const [{ data: raw }, clientes, representadas, responsaveis, profMap] = await Promise.all([
    supabase
      .from("tarefas")
      .select(
        "id, titulo, descricao, tipo, cliente_id, representada_id, responsavel_id, data_prevista, prioridade, status"
      )
      .order("data_prevista", { ascending: true, nullsFirst: false })
      .limit(500),
    listClienteOptions(),
    listRepresentadaOptions(),
    podeAtribuir ? listVendedorOptions() : Promise.resolve([]),
    profileLabelMap(),
  ]);

  const cliNome = new Map(clientes.map((c) => [c.id, c.label]));
  const tarefas: TarefaItem[] = (raw ?? []).map((t) => ({
    id: t.id as string,
    titulo: t.titulo as string,
    descricao: (t.descricao as string) ?? null,
    tipo: t.tipo as string,
    cliente_id: (t.cliente_id as string) ?? null,
    representada_id: (t.representada_id as string) ?? null,
    responsavel_id: (t.responsavel_id as string) ?? null,
    responsavel: t.responsavel_id ? profMap.get(t.responsavel_id as string) ?? null : null,
    cliente: t.cliente_id ? cliNome.get(t.cliente_id as string) ?? null : null,
    data_prevista: (t.data_prevista as string) ?? null,
    prioridade: t.prioridade as string,
    status: t.status as string,
  }));

  return (
    <div>
      <PageHeader title="Tarefas" description="Agenda comercial: follow-ups, ligações e visitas." />
      <TarefasView
        tarefas={tarefas}
        clientes={clientes.map((c) => ({ id: c.id, label: c.label }))}
        representadas={representadas.map((r) => ({ id: r.id, label: r.label }))}
        responsaveis={responsaveis.map((r) => ({ id: r.id, label: r.label }))}
        podeAtribuir={podeAtribuir}
      />
    </div>
  );
}
