import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { processarPedidoAguardandoNF, precisaChecar } from "@/lib/sistema/dropshipping-pedido-arquivos";

export interface PedidoDropItem {
  sku: string;
  nome: string;
  quantidade: number;
  caixas: number;
}

export interface PedidoDrop {
  id: string;
  numero: number;
  status: "aguardando_nf" | "pronto" | "enviado" | "cancelado";
  createdAt: string;
  itens: PedidoDropItem[];
  entregaCidade: string | null;
  entregaUf: string | null;
}

const PEDIDOS_COLS =
  "id, numero, status, created_at, ml_conta_id, ml_shipping_id, pedido_externo, ultima_checagem_em, entrega_nome, entrega_telefone, entrega_cep, entrega_logradouro, entrega_numero, entrega_bairro, entrega_cidade, entrega_uf, pedido_itens(quantidade, sku_snapshot, descricao_snapshot, unidades_por_kit)";

/**
 * Pedidos de dropshipping do seller, mais recentes primeiro. Pra cada pedido
 * ainda "aguardando_nf" que não foi checado recentemente, consulta na hora
 * se a NF/etiqueta já ficaram prontas no Mercado Livre (ver
 * `processarPedidoAguardandoNF`) — é essa checagem, feita quando o seller
 * abre a página, que deixa o fluxo rápido pra ele sem depender só do cron
 * diário (Vercel Hobby não libera cron mais frequente que 1x/dia).
 */
export async function pedidosDropSeller(clienteId: string): Promise<PedidoDrop[]> {
  const db = await createDropshippingAdminClient();
  const { data } = await db
    .from("pedidos")
    .select(PEDIDOS_COLS)
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as {
    id: string;
    numero: number;
    status: PedidoDrop["status"];
    created_at: string;
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
  }[];

  await Promise.all(
    rows
      .filter((p) => p.status === "aguardando_nf" && precisaChecar(p))
      .map(async (p) => {
        try {
          const res = await processarPedidoAguardandoNF(db, p);
          if (res.ficouPronto) p.status = "pronto";
        } catch (e) {
          console.error("[seller-pedidos] processarPedidoAguardandoNF:", e);
        }
      })
  );

  return rows.map((p) => ({
    id: p.id,
    numero: p.numero,
    status: p.status,
    createdAt: p.created_at,
    itens: p.pedido_itens.map((it) => ({
      sku: it.sku_snapshot ?? "—",
      nome: it.descricao_snapshot ?? "—",
      quantidade: it.quantidade,
      caixas: it.quantidade * (it.unidades_por_kit || 1),
    })),
    entregaCidade: p.entrega_cidade,
    entregaUf: p.entrega_uf,
  }));
}
