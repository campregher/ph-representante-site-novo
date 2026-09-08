import { createSistemaClient } from "@/lib/supabase/server";
import { representadaLabelMap, profileLabelMap } from "@/lib/sistema/queries";

export const COMISSAO_STATUS = [
  { value: "a_receber", label: "A receber" },
  { value: "recebida", label: "Recebida" },
  { value: "divergencia", label: "Divergência" },
] as const;

export const COMISSAO_STATUS_LABEL = new Map<string, string>(
  COMISSAO_STATUS.map((s) => [s.value, s.label])
);

export interface ComissaoLinha {
  id: string;
  pedido_id: string | null;
  numero: number | null;
  data_pedido: string | null;
  cliente: string;
  representada: string;
  vendedor: string;
  valor_base: number;
  percentual: number;
  valor_comissao: number;
  competencia: string | null;
  status: string;
  data_recebimento: string | null;
  observacoes: string | null;
}

export interface ComissoesData {
  linhas: ComissaoLinha[];
  totais: {
    aReceber: number;
    recebida: number;
    divergencia: number;
    geral: number;
    base: number;
  };
  competencias: string[];
}

/** "YYYY-MM" dos últimos 12 meses, mais recente primeiro. */
export function competenciasRecentes(): { value: string; label: string }[] {
  const MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const hoje = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: `${MES[d.getMonth()]}/${d.getFullYear()}` };
  });
}

export async function getComissoes(opts: {
  competencia?: string;
  representadaId?: string;
  vendedorId?: string;
  status?: string;
}): Promise<ComissoesData> {
  const supabase = await createSistemaClient();

  let q = supabase
    .from("comissoes")
    .select(
      "id, pedido_id, representada_id, vendedor_id, valor_base, percentual, valor_comissao, competencia, status, data_recebimento, observacoes"
    );
  if (opts.competencia) q = q.eq("competencia", opts.competencia);
  if (opts.representadaId) q = q.eq("representada_id", opts.representadaId);
  if (opts.vendedorId) q = q.eq("vendedor_id", opts.vendedorId);
  if (opts.status) q = q.eq("status", opts.status);

  const [{ data: comRaw }, repMap, profMap] = await Promise.all([
    q,
    representadaLabelMap(),
    profileLabelMap(),
  ]);

  const coms = (comRaw as unknown as
    | {
        id: string;
        pedido_id: string | null;
        representada_id: string | null;
        vendedor_id: string | null;
        valor_base: number;
        percentual: number;
        valor_comissao: number;
        competencia: string | null;
        status: string;
        data_recebimento: string | null;
        observacoes: string | null;
      }[]
    | null) ?? [];

  // dados do pedido (número, data, cliente)
  const pedIds = [...new Set(coms.map((c) => c.pedido_id).filter(Boolean))] as string[];
  const pedInfo = new Map<string, { numero: number; data: string | null; clienteId: string | null }>();
  const cliNome = new Map<string, string>();
  if (pedIds.length) {
    const { data: peds } = await supabase
      .from("pedidos")
      .select("id, numero, data_pedido, cliente_id")
      .in("id", pedIds);
    for (const p of peds ?? [])
      pedInfo.set(p.id as string, {
        numero: p.numero as number,
        data: (p.data_pedido as string) ?? null,
        clienteId: (p.cliente_id as string) ?? null,
      });
    const cliIds = [...new Set([...pedInfo.values()].map((p) => p.clienteId).filter(Boolean))] as string[];
    if (cliIds.length) {
      const { data: clis } = await supabase
        .from("clientes")
        .select("id, nome_fantasia, razao_social")
        .in("id", cliIds);
      for (const c of clis ?? [])
        cliNome.set(
          c.id as string,
          (c.nome_fantasia as string) || (c.razao_social as string) || "—"
        );
    }
  }

  const linhas: ComissaoLinha[] = coms
    .map((c) => {
      const pi = c.pedido_id ? pedInfo.get(c.pedido_id) : undefined;
      return {
        id: c.id,
        pedido_id: c.pedido_id,
        numero: pi?.numero ?? null,
        data_pedido: pi?.data ?? null,
        cliente: pi?.clienteId ? cliNome.get(pi.clienteId) ?? "—" : "—",
        representada: c.representada_id ? repMap.get(c.representada_id) ?? "—" : "—",
        vendedor: c.vendedor_id ? profMap.get(c.vendedor_id) ?? "—" : "Sem vendedor",
        valor_base: Number(c.valor_base),
        percentual: Number(c.percentual),
        valor_comissao: Number(c.valor_comissao),
        competencia: c.competencia,
        status: c.status,
        data_recebimento: c.data_recebimento,
        observacoes: c.observacoes,
      };
    })
    .sort((a, b) => (b.data_pedido ?? "").localeCompare(a.data_pedido ?? ""));

  const somaPor = (s: string) =>
    linhas.filter((l) => l.status === s).reduce((acc, l) => acc + l.valor_comissao, 0);

  return {
    linhas,
    totais: {
      aReceber: somaPor("a_receber"),
      recebida: somaPor("recebida"),
      divergencia: somaPor("divergencia"),
      geral: linhas.reduce((acc, l) => acc + l.valor_comissao, 0),
      base: linhas.reduce((acc, l) => acc + l.valor_base, 0),
    },
    competencias: [...new Set(linhas.map((l) => l.competencia).filter(Boolean))] as string[],
  };
}
