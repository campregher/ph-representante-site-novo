import type { SupabaseClient } from "@supabase/supabase-js";
import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { getMlContaInfo } from "@/lib/sistema/ml-auth";

export const PEDIDOS_BUCKET = "dropshipping-pedidos";
/** não recheca o mesmo pedido mais de uma vez nesse intervalo — tanto o cron
 *  (varredura diária, rede de segurança) quanto a página do seller (checagem
 *  na hora, quando ele abre "Pedidos" esperando a etiqueta) respeitam isso. */
const INTERVALO_CHECAGEM_MS = 5 * 60 * 1000;

/**
 * Geração do pacote pós-venda (planilha + etiqueta + DANFE) pro seller
 * mandar pro fornecedor. Usado pelo cron diário (rede de segurança,
 * `app/api/sistema/cron/dropshipping-etiquetas/route.ts`) E pela página
 * "Pedidos" do seller (checagem na hora, quando ele abre a página esperando
 * a etiqueta — Vercel Hobby só libera cron 1x/dia, não dá pra confiar só
 * nele pra isso ficar rápido pro seller).
 *
 * IMPORTANTE: os nomes de campo/endpoint da nota fiscal abaixo vieram de
 * busca (a doc pública do Mercado Livre não carregou direto durante o
 * planejamento) — **precisam ser confirmados contra uma venda real** antes de
 * confiar neles em produção, do jeito que `ml-pedido-sync.ts` já fez pro
 * endpoint de pedido/envio (ver comentário no topo daquele arquivo).
 */

const ML_BASE = "https://api.mercadolibre.com";

export interface StatusEtiquetaNF {
  pronto: boolean;
  motivo?: string;
  danfeUrl?: string;
}

export interface MensagemPedido {
  id: string;
  autor: "comprador" | "voce";
  texto: string;
  data: string | null;
}

/**
 * Mensagens pós-venda trocadas com o comprador (chat do Mercado Livre).
 * Endpoint confirmado ao vivo (não pela doc pública, que devolveu 403 ao
 * carregar): GET /messages/packs/{pack_id}/sellers/{seller_id}?tag=post_sale
 * — testado contra pedidos reais, mas nenhum tinha mensagem na hora do teste,
 * então o formato exato de cada mensagem (campos de texto/data/remetente)
 * não foi confirmado — por isso os vários fallbacks de campo abaixo. Nunca
 * derruba a página: qualquer falha vira lista vazia.
 */
export async function buscarMensagensPedido(mlContaId: string, orderId: string): Promise<MensagemPedido[]> {
  try {
    const { token, mlUserId } = await getMlContaInfo(mlContaId);
    const headers = { Authorization: `Bearer ${token}` };
    const orderRes = await fetch(`${ML_BASE}/orders/${orderId}`, { headers });
    if (!orderRes.ok) return [];
    const order = await orderRes.json();
    const packId = order.pack_id ?? order.id;
    const res = await fetch(
      `${ML_BASE}/messages/packs/${packId}/sellers/${mlUserId}?tag=post_sale&mark_as_read=false`,
      { headers }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const mensagens = (data.messages ?? []) as Array<Record<string, unknown>>;
    return mensagens
      .map((m, i) => {
        const fromId = (m.from as { user_id?: number | string } | undefined)?.user_id;
        const textoRaw = m.text as { plain?: string } | string | undefined;
        const texto = typeof textoRaw === "string" ? textoRaw : textoRaw?.plain ?? (typeof m.message === "string" ? m.message : "");
        const data =
          (m.message_date as { created?: string } | undefined)?.created ??
          (typeof m.date_created === "string" ? m.date_created : null);
        return {
          id: String(m.id ?? i),
          autor: (fromId != null && String(fromId) === mlUserId ? "voce" : "comprador") as "comprador" | "voce",
          texto: texto ?? "",
          data: data ?? null,
        };
      })
      .filter((m) => m.texto);
  } catch (e) {
    console.error("[dropshipping-pedido-arquivos] buscarMensagensPedido:", e);
    return [];
  }
}

/** Consulta se a NF do consumidor final já foi autorizada pelo ML (o que
 *  libera a etiqueta pra impressão). */
export async function consultarStatusNF(mlContaId: string, orderId: string): Promise<StatusEtiquetaNF> {
  const { token, mlUserId } = await getMlContaInfo(mlContaId);
  const res = await fetch(`${ML_BASE}/users/${mlUserId}/invoices/orders/${orderId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return { pronto: false, motivo: "seller ainda não emitiu a NF no Mercado Livre" };
  if (!res.ok) return { pronto: false, motivo: `erro ${res.status} ao consultar NF` };
  const data = await res.json();
  const status = String(data.status ?? "").toLowerCase();
  if (status !== "authorized") return { pronto: false, motivo: `NF com status "${status || "desconhecido"}"` };
  // danfe_location vem dentro de "attributes", não na raiz do objeto — confirmado
  // ao vivo contra uma NF real autorizada (sem isso, toda NF autorizada caía
  // silenciosamente em "sem danfe_location", nunca marcando o pedido como pronto).
  const danfeUrl = data.attributes?.danfe_location as string | undefined;
  if (!danfeUrl) return { pronto: false, motivo: "NF autorizada mas sem danfe_location" };
  return { pronto: true, danfeUrl };
}

/** Baixa o PDF da etiqueta de envio (já sai 10x15 se o seller configurou
 *  assim nas preferências de impressão da conta dele no Mercado Livre). */
export async function baixarEtiquetaPdf(mlContaId: string, shippingId: number): Promise<Buffer | null> {
  const { token } = await getMlContaInfo(mlContaId);
  const res = await fetch(`${ML_BASE}/shipment_labels?shipment_ids=${shippingId}&response_type=pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** Baixa o PDF do DANFE a partir da URL retornada por `consultarStatusNF`.
 *  `danfe_location` vem como caminho relativo (ex.: "/users/123/invoices/...")
 *  — sem prefixar com ML_BASE, o fetch falha (URL inválida) e a exceção
 *  cancela o processamento do pedido em silêncio (só loga, ver chamadores),
 *  deixando o pedido preso em "aguardando_nf" mesmo com a NF já autorizada.
 *  Confirmado ao vivo contra uma NF real. */
export async function baixarDanfePdf(mlContaId: string, danfeUrl: string): Promise<Buffer | null> {
  const { token } = await getMlContaInfo(mlContaId);
  const url = danfeUrl.startsWith("http") ? danfeUrl : `${ML_BASE}${danfeUrl}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

export interface ItemPlanilha {
  sku: string;
  nome: string;
  quantidade: number;
  caixas: number;
}

export interface PedidoPlanilhaInput {
  numero: number;
  itens: ItemPlanilha[];
  entregaNome: string | null;
  entregaTelefone: string | null;
  entregaCep: string | null;
  entregaLogradouro: string | null;
  entregaNumero: string | null;
  entregaBairro: string | null;
  entregaCidade: string | null;
  entregaUf: string | null;
}

/** Gera a planilha do pedido (SKU, produto, quantidade, endereço de entrega)
 *  pro seller mandar junto da etiqueta/DANFE. */
export async function gerarPlanilhaPedido(pedido: PedidoPlanilhaInput): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const endereco = [
    pedido.entregaLogradouro,
    pedido.entregaNumero,
    pedido.entregaBairro,
    pedido.entregaCidade,
    pedido.entregaUf,
  ]
    .filter(Boolean)
    .join(", ");

  const columns = ["SKU", "Produto", "Qtd. vendida", "Qtd. a enviar (caixas)", "Destinatário", "Telefone", "CEP", "Endereço"];
  const aoa = [
    columns,
    ...pedido.itens.map((it) => [
      it.sku,
      it.nome,
      it.quantidade,
      it.caixas,
      pedido.entregaNome ?? "",
      pedido.entregaTelefone ?? "",
      pedido.entregaCep ?? "",
      endereco,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 16 }, { wch: 32 }, { wch: 12 }, { wch: 20 }, { wch: 24 }, { wch: 16 }, { wch: 12 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `Pedido ${pedido.numero}`.slice(0, 31));
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

interface PedidoAguardandoNF {
  id: string;
  numero: number;
  ml_conta_id: string | null;
  ml_shipping_id: number | null;
  pedido_externo: string | null;
  ultima_checagem_em: string | null;
  entrega_nome: string | null;
  entrega_telefone: string | null;
  entrega_cep: string | null;
  entrega_logradouro: string | null;
  entrega_numero: string | null;
  entrega_bairro: string | null;
  entrega_cidade: string | null;
  entrega_uf: string | null;
  pedido_itens: { quantidade: number; sku_snapshot: string | null; descricao_snapshot: string | null; unidades_por_kit: number }[];
}

export function precisaChecar(pedido: Pick<PedidoAguardandoNF, "ultima_checagem_em">): boolean {
  if (!pedido.ultima_checagem_em) return true;
  return Date.now() - new Date(pedido.ultima_checagem_em).getTime() > INTERVALO_CHECAGEM_MS;
}

/**
 * Checa se a NF/etiqueta de UM pedido "aguardando_nf" já ficou pronta e, se
 * sim, baixa etiqueta+DANFE, gera a planilha e sobe os 3 arquivos no bucket
 * privado — marcando o pedido como "pronto". Compartilhado entre o cron
 * (varredura diária de todos os pedidos pendentes) e a página do seller
 * (checagem na hora, só dos pedidos dele, quando ele abre "Pedidos").
 */
export async function processarPedidoAguardandoNF(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: SupabaseClient<any, any, any>,
  pedido: PedidoAguardandoNF
): Promise<{ ficouPronto: boolean; motivo?: string }> {
  if (!pedido.ml_conta_id || !pedido.ml_shipping_id || !pedido.pedido_externo) {
    return { ficouPronto: false, motivo: "faltam dados de envio/NF para consultar" };
  }

  const statusNf = await consultarStatusNF(pedido.ml_conta_id, pedido.pedido_externo);
  await db.from("pedidos").update({ ultima_checagem_em: new Date().toISOString() }).eq("id", pedido.id);
  if (!statusNf.pronto || !statusNf.danfeUrl) return { ficouPronto: false, motivo: statusNf.motivo };

  const [etiquetaBuf, danfeBuf] = await Promise.all([
    baixarEtiquetaPdf(pedido.ml_conta_id, pedido.ml_shipping_id),
    baixarDanfePdf(pedido.ml_conta_id, statusNf.danfeUrl),
  ]);
  if (!etiquetaBuf || !danfeBuf) {
    return { ficouPronto: false, motivo: "NF autorizada mas falhou baixar etiqueta/DANFE" };
  }

  const planilhaBuf = await gerarPlanilhaPedido({
    numero: pedido.numero,
    itens: pedido.pedido_itens.map((it) => ({
      sku: it.sku_snapshot ?? "—",
      nome: it.descricao_snapshot ?? "—",
      quantidade: it.quantidade,
      caixas: it.quantidade * (it.unidades_por_kit || 1),
    })),
    entregaNome: pedido.entrega_nome,
    entregaTelefone: pedido.entrega_telefone,
    entregaCep: pedido.entrega_cep,
    entregaLogradouro: pedido.entrega_logradouro,
    entregaNumero: pedido.entrega_numero,
    entregaBairro: pedido.entrega_bairro,
    entregaCidade: pedido.entrega_cidade,
    entregaUf: pedido.entrega_uf,
  });

  const etiquetaPath = `${pedido.id}/etiqueta.pdf`;
  const danfePath = `${pedido.id}/danfe.pdf`;
  const planilhaPath = `${pedido.id}/planilha.xlsx`;
  const [up1, up2, up3] = await Promise.all([
    db.storage.from(PEDIDOS_BUCKET).upload(etiquetaPath, etiquetaBuf, { contentType: "application/pdf", upsert: true }),
    db.storage.from(PEDIDOS_BUCKET).upload(danfePath, danfeBuf, { contentType: "application/pdf", upsert: true }),
    db.storage
      .from(PEDIDOS_BUCKET)
      .upload(planilhaPath, planilhaBuf, {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      }),
  ]);
  if (up1.error || up2.error || up3.error) {
    return { ficouPronto: false, motivo: "NF autorizada mas falhou subir arquivo(s) no storage" };
  }

  const agora = new Date().toISOString();
  await db
    .from("pedidos")
    .update({
      status: "pronto",
      etiqueta_path: etiquetaPath,
      etiqueta_gerada_em: agora,
      danfe_path: danfePath,
      danfe_gerada_em: agora,
      planilha_path: planilhaPath,
    })
    .eq("id", pedido.id);

  return { ficouPronto: true };
}

export type ArquivoPedidoTipo = "etiqueta" | "danfe" | "planilha";

const ARQUIVO_INFO: Record<ArquivoPedidoTipo, { coluna: string; contentType: string; ext: string }> = {
  etiqueta: { coluna: "etiqueta_path", contentType: "application/pdf", ext: "pdf" },
  danfe: { coluna: "danfe_path", contentType: "application/pdf", ext: "pdf" },
  planilha: {
    coluna: "planilha_path",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ext: "xlsx",
  },
};

export type ArquivoPedidoResultado =
  | { ok: true; buffer: Buffer; contentType: string; filename: string }
  | { ok: false; status: 404 | 403; error: string };

async function buscarArquivoPedido(
  pedidoId: string,
  tipo: ArquivoPedidoTipo,
  clienteId: string | null
): Promise<ArquivoPedidoResultado> {
  const db = await createDropshippingAdminClient();
  const info = ARQUIVO_INFO[tipo];
  const { data: pedido } = await db
    .from("pedidos")
    .select("id, numero, cliente_id, status, etiqueta_path, danfe_path, planilha_path")
    .eq("id", pedidoId)
    .maybeSingle();

  if (!pedido || (clienteId && pedido.cliente_id !== clienteId)) {
    return { ok: false, status: 404, error: "Pedido não encontrado." };
  }
  const path = (pedido as unknown as Record<string, string | null>)[info.coluna];
  if (pedido.status !== "pronto" || !path) return { ok: false, status: 403, error: "Arquivo ainda não está pronto." };

  const { data: arquivo, error } = await db.storage.from(PEDIDOS_BUCKET).download(path);
  if (error || !arquivo) return { ok: false, status: 404, error: "Arquivo não encontrado no storage." };

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  return { ok: true, buffer, contentType: info.contentType, filename: `pedido-${pedido.numero}-${tipo}.${info.ext}` };
}

/** Baixa um dos 3 arquivos do pacote de um pedido, SÓ se ele pertencer ao
 *  seller informado e já estiver "pronto" — usado pelas 3 rotas de download
 *  em `app/api/drop/pedidos/[id]/*`. */
export async function baixarArquivoPedidoSeller(
  clienteId: string,
  pedidoId: string,
  tipo: ArquivoPedidoTipo
): Promise<ArquivoPedidoResultado> {
  return buscarArquivoPedido(pedidoId, tipo, clienteId);
}

/** Mesma coisa, mas pro admin — ele pode ver o pedido de qualquer seller,
 *  então não checa dono (a rota já exige `requireSistemaProfile()`). */
export async function baixarArquivoPedidoAdmin(
  pedidoId: string,
  tipo: ArquivoPedidoTipo
): Promise<ArquivoPedidoResultado> {
  return buscarArquivoPedido(pedidoId, tipo, null);
}
