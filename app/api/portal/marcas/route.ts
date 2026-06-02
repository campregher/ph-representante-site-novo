import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const db = await createAdminClient();

    const { data: marcas, error } = await db
      .from("marcas")
      .select("id, slug, name, segment, logo_url")
      .eq("ativo", true)
      .order("name");
    if (error) throw error;

    if (!user) return NextResponse.json(marcas ?? []);

    const { data: cliente } = await db
      .from("clientes")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!cliente) return NextResponse.json(marcas ?? []);

    const { data: mcRows } = await db
      .from("marca_clientes")
      .select("marca_slug, status, bloqueado, condicoes_pagamento_drop")
      .eq("cliente_id", cliente.id);

    const mcMap = Object.fromEntries(
      (mcRows ?? []).map((mc) => [mc.marca_slug, mc])
    );

    const result = (marcas ?? []).map((m) => ({
      ...m,
      acesso: mcMap[m.slug]
        ? {
            status:                  mcMap[m.slug].status as string,
            bloqueado:               mcMap[m.slug].bloqueado as boolean,
            condicoes_pagamento_drop: (mcMap[m.slug].condicoes_pagamento_drop as string[] | null) ?? ["pix", "boleto", "semanal"],
          }
        : null,
    }));

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
