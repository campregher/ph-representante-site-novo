import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const body = await request.json() as { ids: string[]; patch: Record<string, unknown> };
  const { ids, patch } = body;

  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids obrigatório" }, { status: 400 });
  if (!patch || Object.keys(patch).length === 0)
    return NextResponse.json({ error: "patch obrigatório" }, { status: 400 });

  const allowed = new Set(["active", "resale_price", "price"]);
  const safePatch = Object.fromEntries(
    Object.entries(patch).filter(([k]) => allowed.has(k))
  );
  if (Object.keys(safePatch).length === 0)
    return NextResponse.json({ error: "Nenhum campo permitido no patch" }, { status: 400 });

  const db = await createAdminClient();
  const { error } = await db
    .from("produtos")
    .update(safePatch)
    .in("id", ids)
    .eq("brand", ctx.marcaSlug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: ids.length });
}

export async function DELETE(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { ids } = await request.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0)
    return NextResponse.json({ error: "ids obrigatório" }, { status: 400 });

  const db = await createAdminClient();
  const { error } = await db
    .from("produtos")
    .delete()
    .in("id", ids)
    .eq("brand", ctx.marcaSlug);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, count: ids.length });
}
