import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { sendApprovalEmail, sendSupplierNotification } from "@/lib/email";

export const runtime = "nodejs";

async function isAdmin() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  return await verifyToken(token);
}

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const supabase = adminDb();
    const { data, error } = await supabase
      .from("orcamentos")
      .select("*, orcamento_itens(*), orcamento_etiquetas(*), clientes(razao_social, cnpj, cidade, estado, email, whatsapp)")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "ID obrigatório" }, { status: 400 });

    const supabase = adminDb();

    // ── Notificação do fornecedor para o cliente ──
    if (body.action === "notificar_cliente") {
      const { tipo, mensagem } = body as { tipo: "nao_enviara_hoje" | "alteracao"; mensagem?: string };

      const { data: orc } = await supabase
        .from("orcamentos")
        .select("numero, marca, clientes(email, razao_social)")
        .eq("id", id)
        .single();

      if (!orc?.clientes) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

      const cliente = orc.clientes as unknown as { email: string; razao_social: string };
      const { data: brand } = orc.marca
        ? await supabase.from("marcas").select("name").eq("slug", orc.marca).single()
        : { data: null };

      await sendSupplierNotification({
        numero:       orc.numero,
        clienteEmail: cliente.email,
        clienteNome:  cliente.razao_social,
        brandName:    brand?.name ?? orc.marca ?? "",
        tipo,
        mensagem,
      });

      // Salva a notificação no registro
      await supabase
        .from("orcamentos")
        .update({ notificacao_fornecedor: tipo === "nao_enviara_hoje" ? "Pedido não será enviado hoje" : (mensagem || "Houve uma alteração no pedido") })
        .eq("id", id);

      return NextResponse.json({ ok: true });
    }

    // ── Limpar flag de alteração pendente ──
    if (body.action === "limpar_alteracao") {
      await supabase
        .from("orcamentos")
        .update({ alteracao_pendente: false, alteracao_descricao: null })
        .eq("id", id);
      return NextResponse.json({ ok: true });
    }

    // ── Atualizar status_pagamento ──
    if (body.action === "status_pagamento") {
      const { status_pagamento } = body;
      await supabase.from("orcamentos").update({ status_pagamento }).eq("id", id);
      return NextResponse.json({ ok: true });
    }

    // ── Aprovar / Recusar ──
    const { status, observacao_admin } = body;
    if (!status) return NextResponse.json({ error: "Status obrigatório" }, { status: 400 });

    const { error } = await supabase
      .from("orcamentos")
      .update({ status, observacao_admin: observacao_admin || null })
      .eq("id", id);
    if (error) throw new Error(error.message);

    if (status === "aprovado") {
      const { data: orc } = await supabase
        .from("orcamentos")
        .select("numero, tipo_pedido, observacoes, marca, orcamento_itens(valor_total), orcamento_etiquetas(id), clientes(email, razao_social)")
        .eq("id", id)
        .single();

      if (orc?.clientes) {
        const cliente = orc.clientes as unknown as { email: string; razao_social: string };
        const { data: brand } = orc.marca
          ? await supabase.from("marcas").select("name").eq("slug", orc.marca).single()
          : { data: null };
        const itens = (orc.orcamento_itens ?? []) as { valor_total: number }[];
        const total = itens.reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
        const hasEtiquetas = ((orc.orcamento_etiquetas ?? []) as unknown[]).length > 0;

        sendApprovalEmail({
          numero:       orc.numero,
          clienteEmail: cliente.email,
          clienteNome:  cliente.razao_social,
          brandName:    brand?.name ?? orc.marca ?? "",
          tipoPedido:   orc.tipo_pedido ?? "estoque",
          total,
          observacoes:  orc.observacoes ?? null,
          hasEtiquetas,
        }).catch((err) => console.error("[email-approval]", err));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro interno" }, { status: 500 });
  }
}
