import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = await createAdminClient();
  const { data: notificacoes } = await db
    .from("portal_ml_notificacoes")
    .select("*")
    .eq("cliente_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const unread = (notificacoes ?? []).filter(n => !n.lida).length;

  return NextResponse.json({ notificacoes: notificacoes ?? [], unread });
}

/** PATCH { id, lida, acao_tomada? } — marca notificação como lida */
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id, acao_tomada } = await request.json() as {
    id: string;
    acao_tomada?: string;
  };

  const db = await createAdminClient();
  await db.from("portal_ml_notificacoes")
    .update({ lida: true, ...(acao_tomada && { acao_tomada }) })
    .eq("id", id)
    .eq("cliente_id", user.id);

  return NextResponse.json({ ok: true });
}
