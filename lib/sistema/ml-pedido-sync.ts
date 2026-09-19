import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getValidMlToken } from "@/lib/sistema/ml-auth";
import { aplicarMovimento } from "@/lib/sistema/estoque-mov";
import { pausarAnunciosPorEstoqueZerado } from "@/lib/sistema/ml-catalogo";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";

/**
 * D6 — venda no Mercado Livre vira pedido automático. Acionado pelo webhook
 * (`app/api/drop/ml/webhook/route.ts`, topic "orders_v2"). Campos reais da
 * API confirmados consultando vendas de verdade do seller de teste em
 * 2026-09-19 (`GET /orders/search`, `GET /shipments/{id}`) — não documentação,
 * já que a doc pública não estava acessível: `order.status==="paid"`,
 * `order.order_items[].item.id/unit_price/sale_fee`, frete em
 * `shipments/{id}.shipping_option.cost`, endereço em `.receiver_address`.
 *
 * O pedido criado registra o que o SELLER deve pra PH — o CUSTO do produto
 * (preco_unitario_final/valor_total), não o preço de venda no ML. O preço de
 * venda e a comissão do ML ficam em `pedido_itens.ml_preco_venda`/
 * `ml_comissao`, só pro financeiro do seller (D7). Fatura automática (a
 * venda já foi paga pelo comprador no ML) — gera contas_receber igual ao
 * fluxo manual (`faturarPedidoDrop`), só que sem usuário logado (webhook).
 */

const ML_BASE = "https://api.mercadolibre.com";

interface MLOrderItem {
  item: { id: string };
  quantity: number;
  unit_price: number;
  sale_fee: number;
}

interface MLOrder {
  id: number;
  status: string;
  order_items: MLOrderItem[];
  shipping?: { id: number } | null;
  buyer?: { nickname: string } | null;
}

interface EnderecoEnvio {
  frete: number | null;
  entrega_nome: string | null;
  entrega_telefone: string | null;
  entrega_cep: string | null;
  entrega_logradouro: string | null;
  entrega_numero: string | null;
  entrega_bairro: string | null;
  entrega_cidade: string | null;
  entrega_uf: string | null;
}

async function buscarPedidoML(token: string, orderId: string): Promise<MLOrder | null> {
  const res = await fetch(`${ML_BASE}/orders/${orderId}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  return res.json();
}

async function buscarEnvio(token: string, shippingId: number): Promise<EnderecoEnvio | null> {
  try {
    const res = await fetch(`${ML_BASE}/shipments/${shippingId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.receiver_address ?? {};
    return {
      frete: data.shipping_option?.cost != null ? Number(data.shipping_option.cost) : null,
      entrega_nome: addr.receiver_name ?? null,
      entrega_telefone: addr.receiver_phone ?? null,
      entrega_cep: addr.zip_code ?? null,
      entrega_logradouro: addr.street_name ?? null,
      entrega_numero: addr.street_number ?? null,
      entrega_bairro: addr.neighborhood?.name ?? null,
      entrega_cidade: addr.city?.name ?? null,
      entrega_uf: typeof addr.state?.id === "string" ? addr.state.id.replace("BR-", "") : null,
    };
  } catch {
    return null;
  }
}

async function avisarGestores(titulo: string, descricao: string, link: string) {
  try {
    const db = await createSistemaAdminClient();
    const { data: gestores } = await db
      .from("profiles")
      .select("id")
      .in("role", ["admin", "gerente"])
      .eq("ativo", true);
    await criarNotificacoes(
      (gestores ?? []).map((g) => ({ userId: g.id as string, tipo: "seller", titulo, descricao, link }))
    );
  } catch (e) {
    console.error("[ml-pedido-sync] avisarGestores:", e);
  }
}

export async function processarVendaML(mlUserId: string, orderId: string): Promise<{ ok: boolean; motivo?: string }> {
  const db = await createSistemaAdminClient();

  const { data: tokenRow } = await db
    .from("cliente_ml_tokens")
    .select("cliente_id")
    .eq("ml_user_id", mlUserId)
    .maybeSingle();
  if (!tokenRow) return { ok: false, motivo: "seller não encontrado pra esse ml_user_id" };
  const clienteId = tokenRow.cliente_id as string;

  // idempotência — webhook do ML reenvia notificações
  const { data: existente } = await db
    .from("pedidos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("pedido_externo", orderId)
    .eq("tipo", "drop_proprio")
    .maybeSingle();
  if (existente) return { ok: true };

  let token: string;
  try {
    token = await getValidMlToken(clienteId);
  } catch {
    return { ok: false, motivo: "token ML do seller inválido" };
  }

  const order = await buscarPedidoML(token, orderId);
  if (!order) return { ok: false, motivo: "falha ao buscar pedido no Mercado Livre" };
  // só processa quando o comprador já pagou — o webhook dispara de novo em cada mudança de status
  if (order.status !== "paid") return { ok: true };

  const mlItemIds = order.order_items.map((it) => it.item.id);
  const { data: anuncios } = await db
    .from("seller_ml_anuncios")
    .select("produto_id, ml_item_id")
    .eq("cliente_id", clienteId)
    .in("ml_item_id", mlItemIds);
  const produtoPorItem = new Map((anuncios ?? []).map((a) => [a.ml_item_id as string, a.produto_id as string]));

  const itensValidos = order.order_items.filter((it) => produtoPorItem.has(it.item.id));
  if (itensValidos.length === 0) {
    await avisarGestores(
      `Venda no ML não rastreada — pedido #${orderId}`,
      "Nenhum item bate com um anúncio publicado pelo sistema. Lance o pedido manualmente se precisar.",
      "/sistema/estoque/vendas/nova"
    );
    return { ok: false, motivo: "nenhum item da venda rastreado" };
  }

  const produtoIds = [...new Set(itensValidos.map((it) => produtoPorItem.get(it.item.id)!))];
  const { data: produtos } = await db
    .from("produtos")
    .select("id, sku, nome, custo")
    .in("id", produtoIds);
  const produtoMap = new Map((produtos ?? []).map((p) => [p.id as string, p]));

  const subtotalCusto = itensValidos.reduce((s, it) => {
    const p = produtoMap.get(produtoPorItem.get(it.item.id)!);
    return s + Number(p?.custo ?? 0) * it.quantity;
  }, 0);

  const envio = order.shipping?.id ? await buscarEnvio(token, order.shipping.id) : null;

  const { data: novo, error } = await db
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      representada_id: null,
      tabela_preco_id: null,
      tipo: "drop_proprio",
      canal: "Mercado Livre",
      pedido_externo: orderId,
      status: "confirmado",
      entrega_nome: envio?.entrega_nome ?? order.buyer?.nickname ?? null,
      entrega_telefone: envio?.entrega_telefone ?? null,
      entrega_cep: envio?.entrega_cep ?? null,
      entrega_logradouro: envio?.entrega_logradouro ?? null,
      entrega_numero: envio?.entrega_numero ?? null,
      entrega_bairro: envio?.entrega_bairro ?? null,
      entrega_cidade: envio?.entrega_cidade ?? null,
      entrega_uf: envio?.entrega_uf ?? null,
      observacao_interna: `Venda automática — pedido Mercado Livre #${orderId}`,
      subtotal: Math.round(subtotalCusto * 100) / 100,
      desconto_valor: 0,
      desconto_percentual: 0,
      valor_total: Math.round(subtotalCusto * 100) / 100,
      ml_frete: envio?.frete ?? null,
    })
    .select("id, numero")
    .single();
  if (error) return { ok: false, motivo: error.message };
  const pedidoId = novo.id as string;
  const numero = novo.numero as number;

  const itensRows = itensValidos.map((it) => {
    const produtoId = produtoPorItem.get(it.item.id)!;
    const custo = Number(produtoMap.get(produtoId)?.custo ?? 0);
    return {
      pedido_id: pedidoId,
      produto_id: produtoId,
      sku_snapshot: produtoMap.get(produtoId)?.sku ?? null,
      descricao_snapshot: produtoMap.get(produtoId)?.nome ?? null,
      quantidade: it.quantity,
      preco_tabela: custo,
      desconto_item_percentual: 0,
      desconto_item_valor: 0,
      preco_unitario_final: custo,
      valor_total: Math.round(custo * it.quantity * 100) / 100,
      custo_unitario: custo,
      ml_preco_venda: it.unit_price,
      ml_comissao: it.sale_fee,
    };
  });
  const { error: eItens } = await db.from("pedido_itens").insert(itensRows);
  if (eItens) {
    await db.from("pedidos").delete().eq("id", pedidoId);
    return { ok: false, motivo: `falha ao gravar itens: ${eItens.message}` };
  }

  const produtosZerados = new Set<string>();
  for (const it of itensValidos) {
    const produtoId = produtoPorItem.get(it.item.id)!;
    const saldo = await aplicarMovimento(db, {
      produtoId,
      delta: -it.quantity,
      tipo: "saida",
      origemTipo: "pedido",
      origemId: pedidoId,
      observacao: `Venda ML #${orderId}`,
      userId: null,
    });
    if (saldo <= 0) produtosZerados.add(produtoId);
  }

  // fatura automática — a venda já foi paga pelo comprador no ML
  await db.from("pedido_faturamento").insert({
    pedido_id: pedidoId,
    data_emissao: new Date().toISOString().slice(0, 10),
    valor_nf: subtotalCusto,
    valor_faturado: subtotalCusto,
  });
  const vencimento = new Date();
  vencimento.setDate(vencimento.getDate() + 2);
  await db.from("contas_receber").insert({
    pedido_id: pedidoId,
    cliente_id: clienteId,
    descricao: `Venda Mercado Livre — pedido #${numero}`,
    valor: Math.round(subtotalCusto * 100) / 100,
    vencimento: vencimento.toISOString().slice(0, 10),
    status: "aberto",
  });
  await db.from("pedidos").update({ status: "faturado" }).eq("id", pedidoId);

  await avisarGestores(
    `Nova venda no ML — pedido #${numero}`,
    `Seller vendeu ${itensValidos.length} item(ns) pelo Mercado Livre. Pronto pra despacho.`,
    `/sistema/pedidos/${pedidoId}`
  );

  for (const produtoId of produtosZerados) {
    await pausarAnunciosPorEstoqueZerado(produtoId);
  }

  return { ok: true };
}
