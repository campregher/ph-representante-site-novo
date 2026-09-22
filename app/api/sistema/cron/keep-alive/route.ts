import { NextResponse } from "next/server";
import { createSistemaAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ping diário pro Supabase (Vercel Cron, ver vercel.json). Projetos free do
 * Supabase pausam sozinhos após 7 dias sem atividade — essa rota só existe
 * pra gerar uma query por dia e evitar a pausa automática.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }

  const db = await createSistemaAdminClient();
  const { error } = await db.from("profiles").select("id").limit(1);

  if (error) {
    console.error("keep-alive:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, checked_at: new Date().toISOString() });
}
