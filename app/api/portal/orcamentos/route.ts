import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendNewOrderAlert } from "@/lib/email";

export const runtime = "nodejs";

interface ItemInput {
  produto_sku: string;
  produto_nome: string;
  quantidade: number;
  valor_unitario: number;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { items, condicao, prazoBoleto, transportadora, observacoes, marca, tipoPedido, etiquetas, horarioPostagem } = await request.json();

    if (!marca)         return NextResponse.json({ error: "Selecione uma marca" }, { status: 400 });
    if (!tipoPedido)    return NextResponse.json({ error: "Selecione o tipo de pedido" }, { status: 400 });
    if (!items?.length) return NextResponse.json({ error: "Adicione ao menos um produto" }, { status: 400 });
    if (!condicao)      return NextResponse.json({ error: "Condição de pagamento obrigatória" }, { status: 400 });

    const admin = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: clienteRow } = await admin
      .from("clientes")
      .select("id, status, bloqueado, razao_social, nome_fantasia, cnpj, email, whatsapp, logradouro, numero, bairro, cidade, estado")
      .eq("user_id", user.id)
      .single();

    if (!clienteRow) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
    if (clienteRow.bloqueado) return NextResponse.json({ error: "Sua conta está bloqueada para novos pedidos por pendência de pagamento. Entre em contato com a PH Representante." }, { status: 403 });
    if (clienteRow.status !== "aprovado") return NextResponse.json({ error: "Cadastro não aprovado" }, { status: 403 });

    // Verifica aprovação e bloqueio desta marca para este cliente
    if (marca) {
      const { data: marcaCliente } = await admin
        .from("marca_clientes")
        .select("status, bloqueado")
        .eq("marca_slug", marca)
        .eq("cliente_id", clienteRow.id)
        .single();

      if (!marcaCliente || marcaCliente.status !== "aprovado") {
        return NextResponse.json({ error: "Você ainda não tem acesso aprovado a esta marca. Solicite acesso na seção Marcas." }, { status: 403 });
      }
      if (marcaCliente.bloqueado) {
        return NextResponse.json({ error: "Sua conta está bloqueada para pedidos desta marca. Entre em contato com a PH Representante." }, { status: 403 });
      }
    }

    // Cria orçamento
    const { data: orcamento, error: oErr } = await admin
      .from("orcamentos")
      .insert({
        cliente_id:         clienteRow.id,
        marca:              marca         || null,
        tipo_pedido:        tipoPedido    || null,
        condicao_pagamento: condicao,
        prazo_boleto:       condicao === "boleto" ? (prazoBoleto || null) : null,
        transportadora:     transportadora || null,
        observacoes:        observacoes    || null,
        horario_postagem:   tipoPedido === "dropshipping" ? (horarioPostagem || null) : null,
        status:             "enviado",
      })
      .select()
      .single();
    if (oErr) throw new Error(oErr.message);

    // Insere itens
    const { error: iErr } = await admin.from("orcamento_itens").insert(
      items.map((i: ItemInput) => ({
        orcamento_id:   orcamento.id,
        produto_sku:    i.produto_sku,
        produto_nome:   i.produto_nome,
        quantidade:     i.quantidade,
        valor_unitario: i.valor_unitario,
      }))
    );
    if (iErr) throw new Error(iErr.message);

    // Insere etiquetas (dropshipping)
    if (tipoPedido === "dropshipping" && Array.isArray(etiquetas) && etiquetas.length > 0) {
      const { error: eErr } = await admin.from("orcamento_etiquetas").insert(
        etiquetas.map((e: { nome: string; url: string }) => ({
          orcamento_id: orcamento.id,
          nome: e.nome,
          url: e.url,
        }))
      );
      if (eErr) throw new Error(eErr.message);
    }

    // Busca itens completos (com valor_total gerado pelo banco)
    const { data: itensCompletos } = await admin
      .from("orcamento_itens")
      .select("*")
      .eq("orcamento_id", orcamento.id);

    // Busca dados da marca
    const { data: brand } = marca
      ? await admin.from("marcas").select("name, email").eq("slug", marca).single()
      : { data: null };

    const total = (itensCompletos ?? []).reduce((s: number, i: { valor_total: number }) => s + Number(i.valor_total ?? 0), 0);

    // Salva o total calculado de volta no orcamento
    if (total > 0) {
      await admin.from("orcamentos").update({ total }).eq("id", orcamento.id);
    }

    const now   = new Date(orcamento.created_at);
    const dataBR = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const horaBR = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    // Envia alerta por email (em background — não bloqueia a resposta ao cliente)
    const adminEmail = process.env.EMAIL_ADMIN;
    const toEmail    = brand?.email ?? adminEmail;
    if (toEmail) {
      sendNewOrderAlert({
        id:          orcamento.id,
        numero:      orcamento.numero,
        dataBR,
        horaBR,
        tipoPedido,
        brandEmail:  toEmail,
        brandName:   brand?.name ?? marca,
        brandSlug:   marca,
        clienteNome: clienteRow.razao_social,
        total,
        observacoes: observacoes || null,
      }).catch((err) => console.error("[email]", err));
    }

    return NextResponse.json({ id: orcamento.id });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
