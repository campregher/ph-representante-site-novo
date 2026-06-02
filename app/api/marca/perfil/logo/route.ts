import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
  if (!allowedTypes.includes(file.type))
    return NextResponse.json({ error: "Formato inválido. Use PNG, JPG, WEBP ou SVG." }, { status: 400 });

  if (file.size > 2 * 1024 * 1024)
    return NextResponse.json({ error: "Arquivo muito grande. Máximo 2 MB." }, { status: 400 });

  const db = await createAdminClient();
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const path = `marcas/${ctx.marcaSlug}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await db.storage.from("avatars").upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: { publicUrl } } = db.storage.from("avatars").getPublicUrl(path);
  const url = `${publicUrl}?t=${Date.now()}`;

  await db.from("marcas").update({ logo_url: url }).eq("slug", ctx.marcaSlug);

  return NextResponse.json({ url });
}
