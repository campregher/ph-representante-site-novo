import { NextRequest, NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getMlAuthUrl, disconnectMl } from "@/lib/ml-auth";

export const runtime = "nodejs";

// GET → retorna URL do OAuth ou redireciona diretamente
export async function GET(req: NextRequest) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const url = getMlAuthUrl(ctx.marcaSlug);

  // ?json=1 → retorna URL como JSON para o cliente navegar manualmente
  if (new URL(req.url).searchParams.has("json")) {
    return NextResponse.json({ url });
  }

  return NextResponse.redirect(url);
}

// DELETE → desconecta a conta ML
export async function DELETE() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  await disconnectMl(ctx.marcaSlug);
  return NextResponse.json({ ok: true });
}
