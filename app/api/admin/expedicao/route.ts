import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { sendExpedicaoEmail } from "@/lib/email";

export const runtime = "nodejs";

function adminDb() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE)?.value ?? "";
  if (!(await verifyToken(token))) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { ids } = await request.json() as { ids: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Nenhum pedido selecionado" }, { status: 400 });
  }

  const db = adminDb();

  const { data: pedidos, error } = await db
    .from("orcamentos")
    .select("id, numero, tipo_pedido, marca, observacoes, clientes(razao_social, logradouro, numero, bairro, cidade, estado), orcamento_itens(produto_sku, produto_nome, quantidade), orcamento_etiquetas(nome, url)")
    .in("id", ids)
    .eq("status", "em_separacao");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!pedidos?.length) return NextResponse.json({ error: "Nenhum pedido em separação encontrado" }, { status: 400 });

  const marcaSlugs = [...new Set(pedidos.map((p) => p.marca).filter(Boolean) as string[])];
  const { data: marcas } = await db.from("marcas").select("slug, name, email_expedicao").in("slug", marcaSlugs);
  const marcaMap = Object.fromEntries((marcas ?? []).map((m) => [m.slug, m]));

  let sent = 0;
  const errors: string[] = [];

  for (const p of pedidos) {
    const marca = p.marca ? marcaMap[p.marca] : null;
    if (!marca?.email_expedicao) continue;

    const cli = p.clientes as unknown as { razao_social: string; logradouro?: string; numero?: string; bairro?: string; cidade?: string; estado?: string } | null;
    const enderecoStr = cli?.logradouro
      ? `${cli.logradouro}${cli.numero ? `, ${cli.numero}` : ""} — ${cli.bairro ?? ""}, ${cli.cidade ?? ""}/${cli.estado ?? ""}`
      : undefined;

    try {
      await sendExpedicaoEmail({
        expedicaoEmail:  marca.email_expedicao,
        numero:          p.numero,
        marcaNome:       marca.name ?? p.marca ?? "",
        clienteNome:     cli?.razao_social ?? "",
        clienteEndereco: enderecoStr,
        isDrop:          p.tipo_pedido === "dropshipping",
        items:           (p.orcamento_itens ?? []).map((i: { produto_sku: string; produto_nome: string; quantidade: number }) => ({
                           sku: i.produto_sku ?? "", nome: i.produto_nome ?? "", quantidade: Number(i.quantidade),
                         })),
        labels:          (p.orcamento_etiquetas ?? []).map((l: { nome: string; url: string }) => ({ nome: l.nome, url: l.url })),
        observacoes:     p.observacoes ?? null,
      });
      sent++;
    } catch (e) {
      errors.push(`#${p.numero}: ${e instanceof Error ? e.message : "erro"}`);
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}
