import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { disconnectPortalMl } from "@/lib/portal-ml-auth";

export const runtime = "nodejs";

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  try {
    await disconnectPortalMl(user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Erro" }, { status: 500 });
  }
}
