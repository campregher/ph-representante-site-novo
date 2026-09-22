import { NextResponse } from "next/server";
import { requireRole } from "@/lib/sistema/auth";
import { getAdminMlAuthUrl, mlAdminConfigurado } from "@/lib/sistema/ml-admin-auth";

export const runtime = "nodejs";

/** Inicia o OAuth do ML da EMPRESA — só admin/gerente, nada a ver com sellers. */
export async function GET() {
  await requireRole("admin", "gerente");
  if (!mlAdminConfigurado()) {
    return NextResponse.json({ error: "Integração com Mercado Livre não configurada." }, { status: 503 });
  }
  return NextResponse.redirect(getAdminMlAuthUrl());
}
