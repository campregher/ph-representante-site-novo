import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";
import { sendWeeklyBillingEmail } from "@/lib/email";

export const runtime = "nodejs";

interface Pedido { numero: number; created_at: string; total: number }

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { cliente_id, weekLabel, pedidos } = await request.json() as {
    cliente_id: string;
    weekLabel:  string;
    pedidos:    Pedido[];
  };

  if (!cliente_id || !weekLabel || !pedidos?.length) {
    return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
  }

  const db = await createAdminClient();

  const { data: cliente } = await db
    .from("clientes")
    .select("email, razao_social")
    .eq("id", cliente_id)
    .single();

  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { data: marca } = await db
    .from("marcas")
    .select("name")
    .eq("slug", ctx.marcaSlug)
    .single();

  const total = pedidos.reduce((s, p) => s + Number(p.total ?? 0), 0);

  await sendWeeklyBillingEmail({
    clienteEmail: cliente.email,
    clienteNome:  cliente.razao_social,
    brandName:    marca?.name ?? ctx.marcaSlug,
    weekLabel,
    pedidos,
    total,
  });

  return NextResponse.json({ ok: true });
}
