import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { getValidToken } from "@/lib/ml-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  let token: string;
  try {
    token = await getValidToken(ctx.marcaSlug);
  } catch {
    return NextResponse.json({ error: "Não conectado" }, { status: 400 });
  }

  const res = await fetch("https://api.mercadolibre.com/users/me", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return NextResponse.json({ error: "Falha ao buscar dados do ML" }, { status: res.status });

  const data = await res.json();
  const nickname = data.nickname ?? data.first_name ?? null;

  /* salva/atualiza o nickname no banco */
  if (nickname) {
    const db = await createAdminClient();
    await db.from("marcas").update({ ml_nickname: nickname }).eq("slug", ctx.marcaSlug);
  }

  return NextResponse.json({
    id:       data.id,
    nickname: data.nickname,
    name:     `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim(),
    email:    data.email,
    points:   data.points,
    level_id: data.seller_reputation?.level_id,
  });
}
