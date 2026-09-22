import { NextResponse } from "next/server";
import { createSistemaClient, createSistemaAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Resolve o portal_token do seller logado (/drop/login) pra redirecionar
 * pro portal existente (/drop/portal/[token]), que continua sendo a área
 * de fato — login só troca a porta de entrada, não o resto do fluxo.
 */
export async function GET() {
  const session = await createSistemaClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return NextResponse.json({ error: "não autenticado" }, { status: 401 });

  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("portal_token")
    .eq("auth_user_id", user.id)
    .eq("is_seller", true)
    .maybeSingle();

  if (!cliente) return NextResponse.json({ error: "seller não encontrado" }, { status: 404 });

  return NextResponse.json({ token: cliente.portal_token });
}
