import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendPaymentConfirmationEmail, sendOrderReceivedEmail, sendShippingEmail, sendDropshippingDispatchedEmail, sendExpedicaoEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { action, ids } = await request.json() as { action: string; ids: string[] };

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

    const { data: marcaFull } = await db.from("marcas").select("name, email_expedicao").eq("slug", ctx.marcaSlug).single();

    for (const p of pedidos) {
      const cli = p.clientes as unknown as { razao_social: string; email: string } | null;
      const total = Number(p.total) || (p.orcamento_itens ?? []).reduce((s: number, i: { valor_total: number }) => s + Number(i.valor_total ?? 0), 0);
      if (cli?.email) {
        sendOrderReceivedEmail({
          numero: p.numero, clienteEmail: cli.email, clienteNome: cli.razao_social,
          brandName, tipoPedido: "estoque", total,
        }).catch(() => {});
      }

      // Expedicao email
      if (marcaFull?.email_expedicao) {
        ;(async (pedidoId: string, numero: number, clienteNome: string) => {
          try {
            const [{ data: itemsData }, { data: labelsData }, { data: orcData }] = await Promise.all([
              db.from("orcamento_itens").select("produto_sku, produto_nome, quantidade").eq("orcamento_id", pedidoId),
              db.from("orcamento_etiquetas").select("nome, url").eq("orcamento_id", pedidoId),
              db.from("orcamentos").select("observacoes").eq("id", pedidoId).single(),
            ]);
            await sendExpedicaoEmail({
              expedicaoEmail: marcaFull.email_expedicao!,
              numero,
              marcaNome:   marcaFull.name ?? ctx.marcaSlug,
              clienteNome,
              isDrop:      false,
              items:       (itemsData ?? []).map(i => ({ sku: i.produto_sku ?? "", nome: i.produto_nome ?? "", quantidade: Number(i.quantidade) })),
              labels:      (labelsData ?? []).map(l => ({ nome: l.nome, url: l.url })),
              observacoes: orcData?.observacoes ?? null,
            });
          } catch {}
        })(p.id, p.numero, cli?.razao_social ?? "");
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

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
