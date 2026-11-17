import type { SupabaseClient } from "@supabase/supabase-js";
import { getMlContaInfo } from "@/lib/sistema/ml-auth";

/**
 * Status REAL do Mercado Livre pra um pedido de dropshipping — envio físico
 * (shipped/delivered/...) e devolução/reclamação (claims). Isso é diferente
 * do `status` de dropshipping.pedidos (aguardando_nf/pronto/enviado), que é
 * só o repasse do seller pro fornecedor — ver migration 055.
 *
 * IMPORTANTE — confiança dos campos abaixo:
 * - `GET /shipments/{id}` (status/substatus) já é usado com sucesso neste
 *   projeto (`buscarEnvio` em dropshipping-pedido-sync.ts) — confiável.
 * - O prazo de despacho (`ml_prazo_envio`) e a API de claims (devolução)
 *   NUNCA foram testados aqui. Os nomes de campo/endpoint abaixo são o
 *   melhor palpite a partir do conhecimento geral da API do ML, não
 *   confirmados contra uma venda/devolução real — por isso tudo aqui é
 *   defensivo: qualquer formato inesperado cai em `catch`/fallback `null`
 *   em vez de quebrar a página. Ajustar assim que aparecer um caso real
 *   (mesmo processo já usado pra NF/etiqueta, ver topo de ml-pedido-sync.ts).
 */

const ML_BASE = "https://api.mercadolibre.com";
const INTERVALO_CHECAGEM_ENVIO_MS = 5 * 60 * 1000;

export interface StatusEnvioML {
  status: string | null;
  substatus: string | null;
  prazoEnvio: string | null;
}

export type UrgenciaEnvio = "atrasado" | "hoje" | "em_breve" | "sem_prazo";

/** Classifica a urgência de despacho igual ao painel do próprio Mercado
 *  Livre ("a enviar hoje"/"atrasado"), a partir do `ml_prazo_envio` — pura,
 *  sem chamada de rede, usada só pra agrupar a aba "A enviar" na UI. */
export function classificarUrgenciaEnvio(prazoEnvio: string | null): UrgenciaEnvio {
  if (!prazoEnvio) return "sem_prazo";
  const prazo = new Date(prazoEnvio);
  if (Number.isNaN(prazo.getTime())) return "sem_prazo";
  const agora = new Date();
  const fimDoDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 23, 59, 59, 999);
  if (prazo.getTime() < agora.getTime()) return "atrasado";
  if (prazo.getTime() <= fimDoDia.getTime()) return "hoje";
  return "em_breve";
}

export interface StatusDevolucaoML {
  status: string;
  claimId: string;
  motivo: string | null;
}

/** Consulta o status real do envio (não o de repasse ao fornecedor). */
export async function consultarStatusEnvioML(mlContaId: string, shippingId: number): Promise<StatusEnvioML | null> {
  try {
    const { token } = await getMlContaInfo(mlContaId);
    const res = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    // palpite do campo de prazo — não confirmado ao vivo ainda (ver comentário no topo do arquivo)
    const prazoEnvio = data?.shipping_option?.estimated_handling_limit?.date ?? null;
    return {
      status: typeof data.status === "string" ? data.status : null,
      substatus: typeof data.substatus === "string" ? data.substatus : null,
      prazoEnvio: typeof prazoEnvio === "string" ? prazoEnvio : null,
    };
  } catch (e) {
    console.error("[dropshipping-pedido-envio-status] consultarStatusEnvioML:", e);
    return null;
  }
}

/** Consulta se existe reclamação/devolução aberta pra esse pedido (API de
 *  claims — nunca usada antes neste projeto, ver avisos no topo do arquivo). */
export async function consultarDevolucaoML(mlContaId: string, orderId: string): Promise<StatusDevolucaoML | null> {
  try {
    const { token } = await getMlContaInfo(mlContaId);
    const res = await fetch(`${ML_BASE}/post-purchase/v1/claims/search?resource=order&resource_id=${orderId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const claims = (data?.data ?? data?.results ?? []) as Array<Record<string, unknown>>;
    const claim = claims[0];
    if (!claim) return null;
    const id = claim.id ?? claim.claim_id;
    if (id == null) return null;
    const status = typeof claim.status === "string" ? claim.status : "aberta";
    const motivo =
      (claim.reason_id as string | undefined) ??
      (claim.type as string | undefined) ??
      (claim.stage as string | undefined) ??
      null;
    return { status, claimId: String(id), motivo };
  } catch (e) {
    console.error("[dropshipping-pedido-envio-status] consultarDevolucaoML:", e);
    return null;
  }
}

interface PedidoEnvioCheck {
  id: string;
  canal: string;
  ml_conta_id: string | null;
  ml_shipping_id: number | null;
  pedido_externo: string | null;
  ml_envio_atualizado_em: string | null;
}

/** Mesmo throttle de `precisaChecar` (dropshipping-pedido-arquivos.ts), pro
 *  envio/devolução — evita bater na API do ML toda vez que alguém abre a
 *  página. */
export function precisaChecarEnvio(pedido: Pick<PedidoEnvioCheck, "ml_envio_atualizado_em">): boolean {
  if (!pedido.ml_envio_atualizado_em) return true;
  return Date.now() - new Date(pedido.ml_envio_atualizado_em).getTime() > INTERVALO_CHECAGEM_ENVIO_MS;
}

/** Atualiza envio real + devolução de UM pedido — chamada pelo webhook, pelo
 *  cron e pela checagem on-demand das páginas de seller/admin. Envio só é
 *  consultado quando há `ml_shipping_id`; devolução só quando é venda do
 *  Mercado Livre com `pedido_externo` conhecido. Devolve o patch gravado,
 *  pra quem chamou poder refletir na mesma resposta (sem esperar o próximo
 *  carregamento da página) sem precisar buscar o pedido de novo. */
export async function atualizarEnvioEDevolucaoPedido(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  pedido: PedidoEnvioCheck
): Promise<Record<string, unknown>> {
  const [envio, devolucao] = await Promise.all([
    pedido.ml_conta_id && pedido.ml_shipping_id
      ? consultarStatusEnvioML(pedido.ml_conta_id, pedido.ml_shipping_id)
      : Promise.resolve(null),
    pedido.ml_conta_id && pedido.canal === "Mercado Livre" && pedido.pedido_externo
      ? consultarDevolucaoML(pedido.ml_conta_id, pedido.pedido_externo)
      : Promise.resolve(null),
  ]);

  const agora = new Date().toISOString();
  const patch: Record<string, unknown> = { ml_envio_atualizado_em: agora };
  if (envio) {
    patch.ml_shipping_status = envio.status;
    patch.ml_shipping_substatus = envio.substatus;
    patch.ml_prazo_envio = envio.prazoEnvio;
  }
  if (devolucao) {
    patch.devolucao_status = devolucao.status;
    patch.devolucao_claim_id = devolucao.claimId;
    patch.devolucao_motivo = devolucao.motivo;
    patch.devolucao_atualizada_em = agora;
  }
  await db.from("pedidos").update(patch).eq("id", pedido.id);
  return patch;
}
