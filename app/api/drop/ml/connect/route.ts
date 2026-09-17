import { NextResponse } from "next/server";
import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getPortalMlAuthUrl, mlConfigurado } from "@/lib/sistema/ml-auth";

export const runtime = "nodejs";

/** Inicia o OAuth do ML pro seller identificado pelo token do portal (?token=). */
export async function GET(request: Request) {
  if (!mlConfigurado()) {
    return NextResponse.json({ error: "Integração com Mercado Livre não configurada." }, { status: 503 });
  }
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Link inválido." }, { status: 400 });

  const db = await createSistemaAdminClient();
  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("portal_token", token)
    .maybeSingle();
  if (!cliente) return NextResponse.json({ error: "Link inválido." }, { status: 404 });

  return NextResponse.redirect(getPortalMlAuthUrl(cliente.id as string));
}
