import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { getProducts } from "@/lib/produtos";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const db = await createAdminClient();

    const { data: marca, error } = await db
      .from("marcas")
      .select("id, slug, name, segment, logo_url")
      .eq("slug", slug)
      .eq("ativo", true)
      .single();

    if (error || !marca) {
      return NextResponse.json({ error: "Marca não encontrada" }, { status: 404 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    let acesso: { status: string; bloqueado: boolean } | null = null;

    if (user) {
      const { data: cliente } = await db
        .from("clientes")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (cliente) {
        const { data: mc } = await db
          .from("marca_clientes")
          .select("status, bloqueado")
          .eq("marca_slug", slug)
          .eq("cliente_id", cliente.id)
          .single();

        if (mc) acesso = { status: mc.status as string, bloqueado: mc.bloqueado as boolean };
      }
    }

    const aprovado = acesso?.status === "aprovado" && !acesso.bloqueado;
    const produtos = aprovado ? await getProducts({ brand: slug, activeOnly: true }) : [];

    return NextResponse.json({ marca, acesso, produtos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
