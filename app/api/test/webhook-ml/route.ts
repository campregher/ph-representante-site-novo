import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Endpoint de teste: cria um pedido dropshipping diretamente a partir de um
 * anúncio ML vinculado, sem precisar de pedido real no ML.
 * Protegido por CRON_SECRET.
 *
 * Uso:
 *   POST /api/test/webhook-ml
 *   Authorization: Bearer <CRON_SECRET>
 *   Body: { "ml_item_id": "MLB123456789", "quantidade": 1 }
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth   = request.headers.get("authorization") ?? "";

  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as {
    ml_item_id: string;
    quantidade?: number;
  };

  if (!body.ml_item_id) {
    return NextResponse.json({ error: "Informe ml_item_id" }, { status: 400 });
  }

  const db = await createAdminClient();

  /* Encontra o anúncio vinculado */
  const { data: anuncio } = await db
    .from("portal_ml_anuncios")
    .select("cliente_id, produto_id, marca_slug, ml_item_id, preco_revenda")
    .eq("ml_item_id", body.ml_item_id)
    .maybeSingle();

  if (!anuncio) {
    return NextResponse.json(
      { error: `Anúncio ${body.ml_item_id} não encontrado na plataforma. Verifique se está vinculado.` },
      { status: 404 }
    );
  }

  /* Resolve clientes.id a partir do auth user UUID */
  const { data: clienteRow } = await db
    .from("clientes")
    .select("id")
    .eq("user_id", anuncio.cliente_id)
    .single();

  if (!clienteRow) {
    return NextResponse.json({ error: "Cliente não encontrado na tabela clientes" }, { status: 404 });
  }

  /* Busca dados do produto */
  const { data: produto } = await db
    .from("produtos")
    .select("id, sku, name, resale_price")
    .eq("id", anuncio.produto_id)
    .single();

  if (!produto) {
    return NextResponse.json({ error: "Produto vinculado não encontrado" }, { status: 404 });
  }

  const quantidade     = Math.max(1, Number(body.quantidade ?? 1));
  const valorUnitario  = anuncio.preco_revenda ?? produto.resale_price ?? 0;
  const total          = quantidade * valorUnitario;
  const fakeOrderId    = `TEST-${Date.now()}`;

  /* Cria o pedido diretamente */
  const { data: orcamento, error } = await db
    .from("orcamentos")
    .insert({
      cliente_id:          clienteRow.id,
      marca:               anuncio.marca_slug,
      tipo_pedido:         "dropshipping",
      condicao_pagamento:  "semanal",
      status:              "em_separacao",
      total,
      ml_order_id:         fakeOrderId,
      ml_shipping_id:      null,
      dropship_cliente_id: anuncio.cliente_id,
      observacoes:         `[TESTE] Pedido simulado para anúncio ${anuncio.ml_item_id}`,
    })
    .select("id")
    .single();

  if (error || !orcamento) {
    return NextResponse.json({ error: error?.message ?? "Erro ao criar pedido" }, { status: 500 });
  }

  /* Insere os itens */
  await db.from("orcamento_itens").insert({
    orcamento_id:   orcamento.id,
    produto_sku:    produto.sku,
    produto_nome:   produto.name,
    quantidade,
    valor_unitario: valorUnitario,
  });

  return NextResponse.json({
    ok: true,
    pedido_id:    orcamento.id,
    ml_item_id:   anuncio.ml_item_id,
    produto:      produto.name,
    marca:        anuncio.marca_slug,
    quantidade,
    total,
    status:       "em_separacao",
    observacao:   "Pedido de teste criado com sucesso. Verifique no painel da marca.",
  });
}
