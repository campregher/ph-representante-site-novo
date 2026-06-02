import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendAccessStatusEmail } from "@/lib/email";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();

  const [{ data: mcRows }, { data: orders }] = await Promise.all([
    db.from("marca_clientes")
      .select("id, status, bloqueado, observacao, created_at, condicoes_pagamento_drop, clientes(id, razao_social, nome_fantasia, cnpj, inscricao_estadual, email, whatsapp, cep, logradouro, numero, complemento, bairro, cidade, estado)")
      .eq("marca_slug", ctx.marcaSlug)
      .order("created_at", { ascending: false }),
    db.from("orcamentos")
      .select("cliente_id, status, total")
      .eq("marca", ctx.marcaSlug)
      .not("status", "eq", "rascunho"),
  ]);

  const statsMap = new Map<string, { totalPedidos: number; totalValor: number }>();
  for (const o of orders ?? []) {
    const cid = o.cliente_id as string;
    if (!statsMap.has(cid)) statsMap.set(cid, { totalPedidos: 0, totalValor: 0 });
    const s = statsMap.get(cid)!;
    s.totalPedidos += 1;
    if (!["rascunho", "recusado"].includes(o.status ?? "")) s.totalValor += Number(o.total ?? 0);
  }

  const result = (mcRows ?? []).map((mc) => {
    const cliente = mc.clientes as unknown as {
      id: string; razao_social: string; nome_fantasia: string | null; cnpj: string;
      inscricao_estadual: string | null; email: string; whatsapp: string; cep: string | null;
      logradouro: string | null; numero: string | null; complemento: string | null;
      bairro: string | null; cidade: string | null; estado: string | null;
    } | null;
    const stats = statsMap.get(cliente?.id ?? "") ?? { totalPedidos: 0, totalValor: 0 };
    return {
      id:              mc.id,
      status:          mc.status,
      bloqueado:       mc.bloqueado,
      observacao:      mc.observacao,
      created_at:      mc.created_at,
      condicoes_pagamento_drop: (mc.condicoes_pagamento_drop as string[] | null) ?? ["pix", "boleto", "semanal"],
      ...stats,
      cliente_id:      cliente?.id ?? "",
      razao_social:    cliente?.razao_social ?? "",
      nome_fantasia:   cliente?.nome_fantasia ?? null,
      cnpj:                cliente?.cnpj ?? "",
      inscricao_estadual:  cliente?.inscricao_estadual ?? null,
      email:               cliente?.email ?? "",
      whatsapp:        cliente?.whatsapp ?? "",
      cep:             cliente?.cep ?? null,
      logradouro:      cliente?.logradouro ?? null,
      numero:          cliente?.numero ?? null,
      complemento:     cliente?.complemento ?? null,
      bairro:          cliente?.bairro ?? null,
      cidade:          cliente?.cidade ?? null,
      estado:          cliente?.estado ?? null,
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json() as {
    cliente_id: string;
    action: "aprovar" | "recusar" | "bloquear" | "desbloquear" | "set_condicoes";
    observacao?: string;
    condicoes?: string[];
  };
  const { cliente_id, action, observacao, condicoes } = body;

  if (!cliente_id || !action) return NextResponse.json({ error: "cliente_id e action obrigatórios" }, { status: 400 });

  const db = await createAdminClient();

  if (action === "set_condicoes") {
    if (!condicoes || !Array.isArray(condicoes)) return NextResponse.json({ error: "condicoes obrigatório" }, { status: 400 });
    const allowed = ["pix", "boleto", "semanal"];
    const filtered = condicoes.filter(c => allowed.includes(c));
    const { error } = await db
      .from("marca_clientes")
      .update({ condicoes_pagamento_drop: filtered })
      .eq("marca_slug", ctx.marcaSlug)
      .eq("cliente_id", cliente_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const allowed = ["pix", "boleto", "semanal"];
  const updateMap: Record<string, Record<string, unknown>> = {
    aprovar:     {
      status:    "aprovado",
      bloqueado: false,
      observacao: observacao ?? null,
      ...(condicoes ? { condicoes_pagamento_drop: condicoes.filter(c => allowed.includes(c)) } : {}),
    },
    recusar:     { status: "recusado",  bloqueado: false, observacao: observacao ?? null },
    bloquear:    { bloqueado: true,  observacao: observacao ?? null },
    desbloquear: { bloqueado: false, observacao: null },
  };

  const patch = updateMap[action];
  if (!patch) return NextResponse.json({ error: "Ação inválida" }, { status: 400 });

  const { error } = await db
    .from("marca_clientes")
    .update(patch)
    .eq("marca_slug", ctx.marcaSlug)
    .eq("cliente_id", cliente_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (["aprovar", "recusar", "bloquear", "desbloquear"].includes(action)) {
    try {
      const [{ data: clienteData }, { data: marcaData }] = await Promise.all([
        db.from("clientes").select("email, razao_social").eq("id", cliente_id).single(),
        db.from("marcas").select("name").eq("slug", ctx.marcaSlug).single(),
      ]);
      if (clienteData?.email) {
        const emailAction = action === "aprovar" ? "aprovado" : action === "recusar" ? "recusado" : action === "bloquear" ? "bloqueado" : "desbloquear";
        await sendAccessStatusEmail({
          clienteEmail: clienteData.email as string,
          clienteNome:  clienteData.razao_social as string,
          marcaNome:    (marcaData?.name ?? ctx.marcaSlug) as string,
          action:       emailAction as "aprovado" | "recusado" | "bloqueado" | "desbloquear",
          observacao:   observacao ?? null,
        });
      }
    } catch { /* email failure does not block action */ }
  }

  return NextResponse.json({ ok: true });
}
