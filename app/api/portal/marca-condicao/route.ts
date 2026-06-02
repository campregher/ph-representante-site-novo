import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const marca = searchParams.get("marca");
  if (!marca) return NextResponse.json({ error: "marca obrigatória" }, { status: 400 });

  const db = await createAdminClient();

  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!cliente) return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });

  const { data: mc } = await db
    .from("marca_clientes")
    .select("condicoes_pagamento_drop")
    .eq("marca_slug", marca)
    .eq("cliente_id", cliente.id)
    .single();

  const condicoes = (mc?.condicoes_pagamento_drop as string[] | null) ?? ["pix", "boleto", "semanal"];
  return NextResponse.json({ condicoes });
}
