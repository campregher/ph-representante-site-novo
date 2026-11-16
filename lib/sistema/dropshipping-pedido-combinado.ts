import { PDFDocument } from "pdf-lib";
import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { PEDIDOS_BUCKET } from "@/lib/sistema/dropshipping-pedido-arquivos";

/**
 * Pacote combinado: junta vários pedidos "pronto" (do MESMO fornecedor, na
 * prática — a tela só oferece isso agrupado por fornecedor) num único PDF
 * de etiquetas (sem a nota fiscal — essa o fornecedor não precisa, cada
 * `etiqueta_path` já sai com as páginas certas: 2 pro Mercado Envios normal,
 * 1 se for Flex) e uma planilha única, pra o seller mandar de uma vez só no
 * grupo de WhatsApp do fornecedor em vez de um arquivo por pedido.
 */

interface PedidoCombinadoRow {
  id: string;
  numero: number;
  status: string;
  cliente_id: string;
  etiqueta_path: string | null;
  danfe_path: string | null;
  entrega_nome: string | null;
  entrega_telefone: string | null;
  entrega_cep: string | null;
  entrega_logradouro: string | null;
  entrega_numero: string | null;
  entrega_bairro: string | null;
  entrega_cidade: string | null;
  entrega_uf: string | null;
  pedido_itens: {
    quantidade: number;
    sku_snapshot: string | null;
    descricao_snapshot: string | null;
    unidades_por_kit: number;
  }[];
}

const PACOTE_COLS =
  "id, numero, status, cliente_id, etiqueta_path, danfe_path, entrega_nome, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero, entrega_bairro, entrega_cidade, entrega_uf, pedido_itens(quantidade, sku_snapshot, descricao_snapshot, unidades_por_kit)";

async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const src = await PDFDocument.load(buf);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}

async function gerarPlanilhaCombinada(pedidos: PedidoCombinadoRow[]): Promise<Buffer> {
  const XLSX = await import("xlsx");
  const columns = [
    "Pedido",
    "SKU",
    "Produto",
    "Qtd. vendida",
    "Qtd. a enviar (caixas)",
    "Destinatário",
    "Telefone",
    "CEP",
    "Endereço",
  ];
  const aoa: (string | number)[][] = [columns];
  for (const p of pedidos) {
    const endereco = [p.entrega_logradouro, p.entrega_numero, p.entrega_bairro, p.entrega_cidade, p.entrega_uf]
      .filter(Boolean)
      .join(", ");
    for (const it of p.pedido_itens) {
      aoa.push([
        `#${p.numero}`,
        it.sku_snapshot ?? "—",
        it.descricao_snapshot ?? "—",
        it.quantidade,
        it.quantidade * (it.unidades_por_kit || 1),
        p.entrega_nome ?? "",
        p.entrega_telefone ?? "",
        p.entrega_cep ?? "",
        endereco,
      ]);
    }
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 8 },
    { wch: 16 },
    { wch: 32 },
    { wch: 12 },
    { wch: 20 },
    { wch: 24 },
    { wch: 16 },
    { wch: 12 },
    { wch: 40 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pedidos");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export interface PedidoCombinadoInfo {
  id: string;
  numero: number;
}

export type PacoteCombinado =
  | {
      ok: true;
      etiquetas: Buffer;
      planilha: Buffer;
      incluidos: PedidoCombinadoInfo[];
      ignorados: PedidoCombinadoInfo[];
    }
  | { ok: false; erro: string };

/** Gera o pacote combinado dos pedidos informados — só entram os que são do
 *  seller, estão "pronto" e têm etiqueta+NF geradas; os demais voltam em
 *  `ignorados` pra UI avisar sem quebrar o download dos válidos. */
export async function gerarPacoteCombinado(clienteId: string, pedidoIds: string[]): Promise<PacoteCombinado> {
  const idsUnicos = [...new Set(pedidoIds)];
  if (idsUnicos.length === 0) return { ok: false, erro: "Nenhum pedido selecionado." };

  const db = await createDropshippingAdminClient();
  const { data } = await db.from("pedidos").select(PACOTE_COLS).in("id", idsUnicos);
  const rows = (data ?? []) as unknown as PedidoCombinadoRow[];

  const validos = rows
    .filter((r) => r.cliente_id === clienteId && r.status === "pronto" && r.etiqueta_path && r.danfe_path)
    .sort((a, b) => a.numero - b.numero);
  const validosIds = new Set(validos.map((r) => r.id));
  const ignorados = rows.filter((r) => !validosIds.has(r.id)).map((r) => ({ id: r.id, numero: r.numero }));

  if (validos.length === 0) {
    return { ok: false, erro: "Nenhum dos pedidos selecionados está pronto (com etiqueta e nota fiscal geradas)." };
  }

  const etiquetaDownloads = await Promise.all(validos.map((p) => db.storage.from(PEDIDOS_BUCKET).download(p.etiqueta_path!)));
  const falhaEtiqueta = etiquetaDownloads.find((d) => d.error || !d.data);
  if (falhaEtiqueta) {
    return { ok: false, erro: "Falha ao baixar a etiqueta de um dos pedidos no storage." };
  }

  const etiquetaBuffers = await Promise.all(etiquetaDownloads.map(async (d) => Buffer.from(await d.data!.arrayBuffer())));

  const [etiquetas, planilha] = await Promise.all([mergePdfs(etiquetaBuffers), gerarPlanilhaCombinada(validos)]);

  return {
    ok: true,
    etiquetas,
    planilha,
    incluidos: validos.map((p) => ({ id: p.id, numero: p.numero })),
    ignorados,
  };
}

/** Marca como "enviado" só os pedidos do próprio seller que estavam
 *  "pronto" — chamado depois que ele já baixou o pacote e mandou pro
 *  fornecedor. Retorna quantos de fato mudaram. */
export async function marcarPedidosEnviados(clienteId: string, pedidoIds: string[]): Promise<number> {
  const idsUnicos = [...new Set(pedidoIds)];
  if (idsUnicos.length === 0) return 0;

  const db = await createDropshippingAdminClient();
  const { data, error } = await db
    .from("pedidos")
    .update({ status: "enviado" })
    .eq("cliente_id", clienteId)
    .eq("status", "pronto")
    .in("id", idsUnicos)
    .select("id");
  if (error) throw new Error(error.message);
  return (data ?? []).length;
}
