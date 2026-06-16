import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPaymentConfirmationEmail, sendOrderReceivedEmail, sendShippingEmail, sendDropshippingDispatchedEmail, sendExpedicaoEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { action, ids, novoStatus } = await request.json() as { action: string; ids: string[]; novoStatus?: string };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Nenhum pedido selecionado" }, { status: 400 });
  }

  const db = await createAdminClient();

  // ── Confirmar pagamento em lote ───────────────────────────────────────────────
  if (action === "confirmar_pagamento") {
    const { data: pedidos, error: fetchErr } = await db
      .from("orcamentos")
      .select("id, numero, total, clientes(razao_social, email)")
      .eq("marca", ctx.marcaSlug)
      .eq("status", "a_pagar")
      .in("id", ids);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!pedidos?.length) return NextResponse.json({ error: "Nenhum pedido elegível" }, { status: 400 });

    const eligibleIds = pedidos.map((p) => p.id);
    const { error: updateErr } = await db.from("orcamentos").update({ status: "pago" }).in("id", eligibleIds);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    const { data: marcaData } = await db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single();
    const brandName = marcaData?.name ?? ctx.marcaSlug;

    for (const p of pedidos) {
      const cli = p.clientes as unknown as { razao_social: string; email: string } | null;
      if (cli?.email) {
        sendPaymentConfirmationEmail({
          numero: p.numero, clienteEmail: cli.email, clienteNome: cli.razao_social,
          marca: brandName, total: Number(p.total ?? 0),
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, updated: eligibleIds.length });
  }

  // ── Confirmar recebimento em lote (apenas pedidos estoque/não-drop) ───────────
  if (action === "confirmar_recebimento") {
    const { data: pedidos, error: fetchErr } = await db
      .from("orcamentos")
      .select("id, numero, total, tipo_pedido, cliente_id, clientes(razao_social, email), orcamento_itens(valor_total)")
      .eq("marca", ctx.marcaSlug)
      .eq("status", "enviado")
      .neq("tipo_pedido", "dropshipping")
      .in("id", ids);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!pedidos?.length) return NextResponse.json({ error: "Nenhum pedido elegível (apenas pedidos de estoque podem ser aprovados em lote)" }, { status: 400 });

    const eligibleIds = pedidos.map((p) => p.id);
    const { error: updateErr } = await db.from("orcamentos").update({ status: "em_separacao" }).in("id", eligibleIds);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    const { data: marcaData } = await db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single();
    const brandName = marcaData?.name ?? ctx.marcaSlug;

    // Auto-approve clients for this brand
    const clienteIds = [...new Set(pedidos.map((p) => p.cliente_id).filter(Boolean) as string[])];
    for (const cid of clienteIds) {
      await db.from("marca_clientes")
        .update({ status: "aprovado" })
        .eq("marca_slug", ctx.marcaSlug)
        .eq("cliente_id", cid);
    }

    for (const p of pedidos) {
      const cli = p.clientes as unknown as { razao_social: string; email: string } | null;
      const total = Number(p.total) || (p.orcamento_itens ?? []).reduce((s: number, i: { valor_total: number }) => s + Number(i.valor_total ?? 0), 0);
      if (cli?.email) {
        sendOrderReceivedEmail({
          numero: p.numero, clienteEmail: cli.email, clienteNome: cli.razao_social,
          brandName, tipoPedido: "estoque", total,
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, updated: eligibleIds.length });
  }

  // ── Marcar como enviado em lote (em_separacao → a_pagar) ────────────────────
  if (action === "marcar_enviado") {
    const { data: pedidos, error: fetchErr } = await db
      .from("orcamentos")
      .select("id, numero, total, tipo_pedido, transportadora, clientes(razao_social, email), orcamento_itens(valor_total)")
      .eq("marca", ctx.marcaSlug)
      .eq("status", "em_separacao")
      .in("id", ids);

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    if (!pedidos?.length) return NextResponse.json({ error: "Nenhum pedido elegível" }, { status: 400 });

    const eligibleIds = pedidos.map((p) => p.id);
    const { error: updateErr } = await db.from("orcamentos").update({ status: "a_pagar" }).in("id", eligibleIds);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    const { data: marcaData } = await db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single();
    const brandName = marcaData?.name ?? ctx.marcaSlug;

    for (const p of pedidos) {
      const cli = p.clientes as unknown as { razao_social: string; email: string } | null;
      const total = Number(p.total) || (p.orcamento_itens ?? []).reduce((s: number, i: { valor_total: number }) => s + Number(i.valor_total ?? 0), 0);
      if (!cli?.email) continue;

      if (p.tipo_pedido === "dropshipping") {
        sendDropshippingDispatchedEmail({
          numero: p.numero, clienteEmail: cli.email, clienteNome: cli.razao_social,
          brandName, total,
        }).catch(() => {});
      } else {
        sendShippingEmail({
          numero: p.numero, clienteEmail: cli.email, clienteNome: cli.razao_social,
          brandName, total, transportadora: p.transportadora as string | null,
        }).catch(() => {});
      }
    }
    return NextResponse.json({ ok: true, updated: eligibleIds.length });
  }

  // ── Alterar status em lote (sem email) ──────────────────────────────────────
  if (action === "mudar_status") {
    const validos = ["enviado", "em_separacao", "a_pagar", "pago", "recusado"];
    if (!novoStatus || !validos.includes(novoStatus))
      return NextResponse.json({ error: "Status inválido" }, { status: 400 });

    const { error: updateErr } = await db
      .from("orcamentos")
      .update({ status: novoStatus })
      .eq("marca", ctx.marcaSlug)
      .in("id", ids);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
