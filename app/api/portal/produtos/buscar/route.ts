import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Busca produtos de marcas aprovadas para o cliente logado */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const db = await createAdminClient();

  /* id do cliente */
  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!cliente) return NextResponse.json({ produtos: [] });

  /* marcas aprovadas */
  const { data: aprovadas } = await db
    .from("marca_clientes")
    .select("marca_slug")
    .eq("cliente_id", cliente.id)
    .eq("status", "aprovado")
    .eq("bloqueado", false);

  const slugs = (aprovadas ?? []).map(a => a.marca_slug as string);
  if (!slugs.length) return NextResponse.json({ produtos: [] });

  const url = new URL(request.url);
  const q   = url.searchParams.get("q")?.trim() ?? "";

  let query = db
    .from("produtos")
    .select("id, sku, name, brand, resale_price, price, images, ml_category_name")
    .in("brand", slugs)
    .eq("active", true)
    .order("name", { ascending: true })
    .limit(30);

  if (q) {
    const safe = q.replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`);
  }

  const { data: produtos } = await query;

  return NextResponse.json({ produtos: produtos ?? [] });
}
