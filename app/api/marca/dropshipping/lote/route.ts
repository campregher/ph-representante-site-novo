import { NextResponse } from "next/server";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const db = await createAdminClient();

  const { data, error } = await db
    .from("orcamentos")
    .select(`
      id, numero, total, created_at, ml_order_id, horario_postagem, observacoes,
      clientes(razao_social, cnpj, cidade, estado, email),
      orcamento_itens(id, produto_sku, produto_nome, quantidade, valor_unitario),
      orcamento_etiquetas(id, nome, url)
    `)
    .eq("marca", ctx.marcaSlug)
    .eq("tipo_pedido", "dropshipping")
    .eq("status", "em_separacao")
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const pedidos = data ?? [];

  /* Agrupa itens por produto para o resumo */
  const resumoMap: Record<string, { produto_sku: string; produto_nome: string; total_qtd: number }> = {};
  for (const p of pedidos) {
    for (const item of (p.orcamento_itens as { produto_sku: string; produto_nome: string; quantidade: number }[]) ?? []) {
      const key = item.produto_sku ?? item.produto_nome;
      if (!resumoMap[key]) {
        resumoMap[key] = { produto_sku: item.produto_sku, produto_nome: item.produto_nome, total_qtd: 0 };
      }
      resumoMap[key].total_qtd += Number(item.quantidade ?? 0);
    }
  }

  const resumo = Object.values(resumoMap).sort((a, b) => b.total_qtd - a.total_qtd);

  return NextResponse.json({ pedidos, resumo });
}
