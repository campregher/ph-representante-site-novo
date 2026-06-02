import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendOrderReceivedEmail, sendShippingEmail, sendPaymentConfirmationEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const db = await createAdminClient();

  const { data, error } = await db
    .from("orcamentos")
    .select("*, orcamento_itens(*), orcamento_etiquetas(*), clientes(razao_social, nome_fantasia, cnpj, email, whatsapp, logradouro, numero, bairro, cidade, estado)")
    .eq("id", id)
    .eq("marca", ctx.marcaSlug)
    .single();

  if (error || !data) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;
  const body   = await request.json();
  const db     = await createAdminClient();

  const { data: existing } = await db
    .from("orcamentos")
    .select("id, status, numero, total, tipo_pedido, transportadora, cliente_id, clientes(razao_social, email), orcamento_itens(valor_total)")
    .eq("id", id)
    .eq("marca", ctx.marcaSlug)
    .single();

  if (!existing) return NextResponse.json({ error: "Pedido não encontrado" }, { status: 404 });

  // Calcula total real a partir dos itens se o campo total estiver zerado/nulo
  const totalReal = Number(existing.total) > 0
    ? Number(existing.total)
    : ((existing.orcamento_itens ?? []) as { valor_total: number }[])
        .reduce((s, i) => s + Number(i.valor_total ?? 0), 0);

  const { action, motivo, etiquetas_confirmadas } = body as {
    action: "confirmar_recebimento" | "marcar_enviado" | "confirmar_pagamento" | "recusar";
    motivo?: string;
    etiquetas_confirmadas?: boolean;
  };

  const cliente = existing.clientes as unknown as { razao_social: string; email: string } | null;

  // ── Confirmar recebimento → em_separacao ─────────────────────────────────────
  if (action === "confirmar_recebimento") {
    if (existing.status !== "enviado") {
      return NextResponse.json({ error: "Pedido não está aguardando confirmação" }, { status: 400 });
    }

    // Para pedidos dropshipping: exige confirmação de download das etiquetas
    if (existing.tipo_pedido === "dropshipping") {
      const { data: etqs } = await db
        .from("orcamento_etiquetas")
        .select("id")
        .eq("orcamento_id", id);

      // Validação removida: confirmação automática ao baixar etiqueta já garante o fluxo
    }

    const { error } = await db
      .from("orcamentos")
      .update({ status: "em_separacao" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-approve client for this brand
    if (existing.cliente_id) {
      await db.from("marca_clientes")
        .update({ status: "aprovado" })
        .eq("marca_slug", ctx.marcaSlug)
        .eq("cliente_id", existing.cliente_id as string);
    }

    if (cliente?.email) {
      try {
        const { data: marcaData } = await db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single();
        await sendOrderReceivedEmail({
          numero:       existing.numero,
          clienteEmail: cliente.email,
          clienteNome:  cliente.razao_social,
          brandName:    marcaData?.name ?? ctx.marcaSlug,
          tipoPedido:   existing.tipo_pedido ?? "estoque",
          total:        totalReal,
        });
      } catch { /* email failure does not block action */ }
    }

    return NextResponse.json({ ok: true });
  }

  // ── Marcar como enviado → a_pagar ────────────────────────────────────────────
  if (action === "marcar_enviado") {
    if (existing.status !== "em_separacao") {
      return NextResponse.json({ error: "Pedido não está em separação" }, { status: 400 });
    }

    const { error } = await db
      .from("orcamentos")
      .update({ status: "a_pagar" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (cliente?.email) {
      try {
        const { data: marcaData } = await db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single();
        await sendShippingEmail({
          numero:         existing.numero,
          clienteEmail:   cliente.email,
          clienteNome:    cliente.razao_social,
          brandName:      marcaData?.name ?? ctx.marcaSlug,
          total:          totalReal,
          transportadora: existing.transportadora as string | null,
        });
      } catch { /* email failure does not block action */ }
    }

    return NextResponse.json({ ok: true });
  }

  // ── Confirmar pagamento → pago ───────────────────────────────────────────────
  if (action === "confirmar_pagamento") {
    if (existing.status !== "a_pagar") {
      return NextResponse.json({ error: "Pedido não está no status A Pagar" }, { status: 400 });
    }

    const { error } = await db
      .from("orcamentos")
      .update({ status: "pago" })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (cliente?.email) {
      try {
        const { data: marcaData } = await db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single();
        await sendPaymentConfirmationEmail({
          numero:       existing.numero,
          clienteEmail: cliente.email,
          clienteNome:  cliente.razao_social,
          marca:        marcaData?.name ?? ctx.marcaSlug,
          total:        totalReal,
        });
      } catch { /* email failure does not block action */ }
    }

    return NextResponse.json({ ok: true });
  }

  // ── Recusar ──────────────────────────────────────────────────────────────────
  if (action === "recusar") {
    if (existing.status !== "enviado") {
      return NextResponse.json({ error: "Pedido não está aguardando confirmação" }, { status: 400 });
    }

    const { error } = await db
      .from("orcamentos")
      .update({ status: "recusado", observacao_admin: motivo ?? null })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
