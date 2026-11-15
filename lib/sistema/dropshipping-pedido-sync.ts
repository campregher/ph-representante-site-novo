import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";
import { getValidMlToken } from "@/lib/sistema/ml-auth";
import { atualizarAnuncioMLDrop } from "@/lib/sistema/dropshipping-ml-catalogo";
import { criarNotificacoes } from "@/lib/sistema/notificacoes";

/**
 * Venda no Mercado Livre de um seller CNPJ de dropshipping vira pedido
 * automático. Acionado pelo webhook (`app/api/drop/ml/webhook/route.ts`,
 * topic "orders_v2"). Reaproveita o esqueleto de `ml-pedido-sync.ts`
 * (D6, modelo antigo), mas aponta pro schema `dropshipping` e não cobra nada
 * do seller — no modelo novo o fornecedor cobra o custo da peça direto do
 * seller, fora do sistema; a PH nunca intermedeia pagamento. O pedido criado
 * aqui só serve pra acompanhar o pós-venda (NF/etiqueta/planilha pro
 * fornecedor), ver `app/api/sistema/cron/dropshipping-etiquetas/route.ts`.
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
    console.error("[dropshipping-pedido-sync] avisarGestores:", e);
  }
}

/** Pausa, em TODAS as contas/sellers, os anúncios de um produto que zerou o
 *  estoque — o estoque é do fornecedor, compartilhado por quem anuncia. */
async function pausarAnunciosPorEstoqueZeradoDrop(produtoId: string) {
  const drop = await createDropshippingAdminClient();
  const { data: anuncios } = await drop
    .from("seller_ml_anuncios")
    .select("ml_conta_id, ml_item_id, ml_status")
    .eq("produto_id", produtoId)
    .eq("ml_status", "active");
  for (const a of anuncios ?? []) {
    try {
      await atualizarAnuncioMLDrop(a.ml_conta_id as string, produtoId, a.ml_item_id as string, { status: "paused" });
    } catch (e) {
      console.error("[dropshipping-pedido-sync] pausarAnunciosPorEstoqueZeradoDrop:", e);
    }
  }
}

export async function processarVendaDropshipping(mlUserId: string, orderId: string): Promise<{ ok: boolean; motivo?: string }> {
  const sistema = await createSistemaAdminClient();

  const { data: tokenRow } = await sistema
    .from("cliente_ml_tokens")
    .select("id, cliente_id")
    .eq("ml_user_id", mlUserId)
    .maybeSingle();
  if (!tokenRow) return { ok: false, motivo: "seller não encontrado pra esse ml_user_id" };
  const mlContaId = tokenRow.id as string;
  const clienteId = tokenRow.cliente_id as string;

  const drop = await createDropshippingAdminClient();

  // idempotência — webhook do ML reenvia notificações
  const { data: existente } = await drop
    .from("pedidos")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("canal", "Mercado Livre")
    .eq("pedido_externo", orderId)
    .maybeSingle();
  if (existente) return { ok: true };

  let token: string;
  try {
    token = await getValidMlToken(mlContaId);
  } catch {
    return { ok: false, motivo: "token ML do seller inválido" };
  }

  const order = await buscarPedidoML(token, orderId);
  if (!order) return { ok: false, motivo: "falha ao buscar pedido no Mercado Livre" };
  // só processa quando o comprador já pagou — o webhook dispara de novo em cada mudança de status
  if (order.status !== "paid") return { ok: true };

  const mlItemIds = order.order_items.map((it) => it.item.id);
  const { data: anuncios } = await drop
    .from("seller_ml_anuncios")
    .select("produto_id, ml_item_id")
    .eq("cliente_id", clienteId)
    .eq("ml_conta_id", mlContaId)
    .in("ml_item_id", mlItemIds);
  const produtoPorItem = new Map((anuncios ?? []).map((a) => [a.ml_item_id as string, a.produto_id as string]));

  const itensValidos = order.order_items.filter((it) => produtoPorItem.has(it.item.id));
  if (itensValidos.length === 0) {
    await avisarGestores(
      `Venda de dropshipping não rastreada — pedido ML #${orderId}`,
      "Nenhum item bate com um anúncio publicado pelo sistema. Confira manualmente.",
      "/sistema/dropshipping"
    );
    return { ok: false, motivo: "nenhum item da venda rastreado" };
  }

  const produtoIds = [...new Set(itensValidos.map((it) => produtoPorItem.get(it.item.id)!))];
  const { data: produtos } = await drop
    .from("produtos")
    .select("id, sku, nome, estoque_atual, produto_precos(custo, tabela:tabelas_preco(codigo))")
    .in("id", produtoIds);
  const produtoMap = new Map(
    (produtos ?? []).map((p) => {
      const precos = p.produto_precos as unknown as { custo: number; tabela: { codigo: string } | null }[];
      const custoCnpj = precos?.find((pr) => pr.tabela?.codigo === "cnpj")?.custo ?? 0;
      return [p.id as string, { ...p, custoCnpj }];
    })
  );

  const envio = order.shipping?.id ? await buscarEnvio(token, order.shipping.id) : null;

  const valorTotal = itensValidos.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0);

  const { data: novo, error } = await drop
    .from("pedidos")
    .insert({
      cliente_id: clienteId,
      canal: "Mercado Livre",
      pedido_externo: orderId,
      ml_conta_id: mlContaId,
      ml_shipping_id: order.shipping?.id ?? null,
      entrega_nome: envio?.entrega_nome ?? order.buyer?.nickname ?? null,
      entrega_telefone: envio?.entrega_telefone ?? null,
      entrega_cep: envio?.entrega_cep ?? null,
      entrega_logradouro: envio?.entrega_logradouro ?? null,
      entrega_numero: envio?.entrega_numero ?? null,
      entrega_bairro: envio?.entrega_bairro ?? null,
      entrega_cidade: envio?.entrega_cidade ?? null,
      entrega_uf: envio?.entrega_uf ?? null,
      valor_total: Math.round(valorTotal * 100) / 100,
      ml_frete: envio?.frete ?? null,
    })
    .select("id, numero")
    .single();
  if (error) return { ok: false, motivo: error.message };
  const pedidoId = novo.id as string;
  const numero = novo.numero as number;

  const itensRows = itensValidos.map((it) => {
    const produtoId = produtoPorItem.get(it.item.id)!;
    const p = produtoMap.get(produtoId);
    return {
      pedido_id: pedidoId,
      produto_id: produtoId,
      sku_snapshot: p?.sku ?? null,
      descricao_snapshot: p?.nome ?? null,
      quantidade: it.quantity,
      custo_unitario: p?.custoCnpj ?? 0,
      ml_preco_venda: it.unit_price,
      ml_comissao: it.sale_fee,
    };
  });
  const { error: eItens } = await drop.from("pedido_itens").insert(itensRows);
  if (eItens) {
    await drop.from("pedidos").delete().eq("id", pedidoId);
    return { ok: false, motivo: `falha ao gravar itens: ${eItens.message}` };
  }

  // soma por produto antes de descontar — um pedido pode trazer 2 itens pro
  // mesmo produto (ex.: mesma variação vendida 2x em linhas separadas), e
  // descontar item a item a partir do mesmo `estoque_atual` já lido ignoraria
  // a segunda ocorrência.
  const qtdPorProduto = new Map<string, number>();
  for (const it of itensValidos) {
    const produtoId = produtoPorItem.get(it.item.id)!;
    qtdPorProduto.set(produtoId, (qtdPorProduto.get(produtoId) ?? 0) + it.quantity);
  }
  for (const [produtoId, quantidade] of qtdPorProduto) {
    const atual = produtoMap.get(produtoId)?.estoque_atual as number | undefined;
    if (atual == null) continue;
    const novoEstoque = Math.max(0, atual - quantidade);
    await drop.from("produtos").update({ estoque_atual: novoEstoque }).eq("id", produtoId);
    if (novoEstoque <= 0) await pausarAnunciosPorEstoqueZeradoDrop(produtoId);
  }

  await avisarGestores(
    `Nova venda de dropshipping — pedido #${numero}`,
    `Seller vendeu ${itensValidos.length} item(ns) pelo Mercado Livre. Aguardando a NF pra liberar a etiqueta.`,
    "/sistema/dropshipping"
  );

  return { ok: true };
}
