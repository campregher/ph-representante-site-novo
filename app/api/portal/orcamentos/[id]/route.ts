import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendChangeAlert } from "@/lib/email";

export const runtime = "nodejs";

interface ItemInput {
  produto_sku: string; produto_nome: string;
  quantidade: number; valor_unitario: number;
}

function admin() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const body = await request.json();
    const db = admin();

    const { data: orc } = await db
      .from("orcamentos")
      .select("id, status, numero, marca, clientes(user_id, razao_social, email)")
      .eq("id", id)
      .single();

    if (!orc) return NextResponse.json({ error: "Orçamento não encontrado" }, { status: 404 });

    const ownerUserId = (orc.clientes as unknown as { user_id: string } | null)?.user_id;
    if (ownerUserId !== user.id) return NextResponse.json({ error: "Acesso negado" }, { status: 403 });

    // ── Horário de postagem (permitido para orçamentos aprovados) ──
    if (body.action === "postagem") {
      const { error: pErr } = await db
        .from("orcamentos")
        .update({ horario_postagem: body.horario_postagem ?? null })
        .eq("id", id);
      if (pErr) throw new Error(pErr.message);
      return NextResponse.json({ ok: true });
    }

    const editableStatuses = ["rascunho", "enviado", "aprovado"];
    if (!editableStatuses.includes(orc.status)) {
      return NextResponse.json({ error: "Orçamento não pode ser alterado" }, { status: 422 });
    }

    // ── Cancelar (deleta — itens são removidos em cascata) ──
    if (body.action === "cancelar") {
      if (orc.status === "aprovado") {
        return NextResponse.json({ error: "Pedido aprovado não pode ser cancelado" }, { status: 422 });
      }
      const { error } = await db.from("orcamentos").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // ── Editar pedido aprovado (notifica fornecedor) ──
    const isApprovedEdit = body.action === "editar_aprovado";
    if (isApprovedEdit && orc.status !== "aprovado") {
      return NextResponse.json({ error: "Ação inválida para este status" }, { status: 422 });
    }
    if (orc.status === "aprovado" && !isApprovedEdit) {
      return NextResponse.json({ error: "Use a ação editar_aprovado para pedidos confirmados" }, { status: 422 });
    }

    const { items, condicao, prazoBoleto, transportadora, observacoes, motivo } = body;
    if (!items?.length) return NextResponse.json({ error: "Adicione ao menos um produto" }, { status: 400 });
    if (!condicao)      return NextResponse.json({ error: "Condição de pagamento obrigatória" }, { status: 400 });
    if (isApprovedEdit && !motivo?.trim()) {
      return NextResponse.json({ error: "Informe o motivo da alteração" }, { status: 400 });
    }

    const { error: delErr } = await db.from("orcamento_itens").delete().eq("orcamento_id", id);
    if (delErr) throw new Error(delErr.message);

    const updatePayload: Record<string, unknown> = {
      condicao_pagamento: condicao,
      prazo_boleto:       condicao === "boleto" ? (prazoBoleto || null) : null,
      transportadora:     transportadora || null,
      observacoes:        observacoes    || null,
    };
    if (!isApprovedEdit) {
      updatePayload.status = "enviado";
    } else {
      updatePayload.alteracao_pendente   = true;
      updatePayload.alteracao_descricao  = motivo.trim();
    }

    const { error: updErr } = await db.from("orcamentos").update(updatePayload).eq("id", id);
    if (updErr) throw new Error(updErr.message);

    const { error: iErr } = await db.from("orcamento_itens").insert(
      items.map((i: ItemInput) => ({
        orcamento_id:   id,
        produto_sku:    i.produto_sku,
        produto_nome:   i.produto_nome,
        quantidade:     i.quantidade,
        valor_unitario: i.valor_unitario,
      }))
    );
    if (iErr) throw new Error(iErr.message);

    // Envia alerta de alteração ao fornecedor (em background)
    if (isApprovedEdit) {
      const cliente = orc.clientes as unknown as { razao_social: string; email: string } | null;
      const { data: brand } = orc.marca
        ? await db.from("marcas").select("name, email").eq("slug", orc.marca).single()
        : { data: null };

      const toEmail   = brand?.email ?? process.env.EMAIL_ADMIN;
      const adminEmail = process.env.EMAIL_ADMIN;
      if (toEmail && cliente) {
        sendChangeAlert({
          numero:       orc.numero,
          brandEmail:   toEmail,
          brandName:    brand?.name ?? orc.marca ?? "",
          clienteNome:  cliente.razao_social,
          motivo:       motivo.trim(),
          adminEmail,
        }).catch((err) => console.error("[email-change]", err));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
