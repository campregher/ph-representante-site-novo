import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { precoLiquido } from "@/lib/sistema/preco";

export const runtime = "nodejs";

/**
 * Dados para o lançamento de pedido:
 * ?representada=<id>&cliente=<id>&tabela=<id>
 * Preço líquido = preço bruto do produto − desconto% da tabela (ou override).
 */
export async function GET(request: Request) {
  const profile = await getSistemaProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const representadaId = searchParams.get("representada");
  const clienteId = searchParams.get("cliente");
  const tabelaId = searchParams.get("tabela");
  if (!representadaId) return NextResponse.json({ error: "representada obrigatória" }, { status: 400 });

  const supabase = await createSistemaClient();

  const [{ data: rep }, { data: tabelas }, { data: produtos }] = await Promise.all([
    supabase
      .from("representadas")
      .select("id, pedido_minimo, desconto_maximo_padrao")
      .eq("id", representadaId)
      .maybeSingle(),
    supabase
      .from("tabelas_preco")
      .select("id, nome, tipo, data_fim, ativa, desconto_percentual")
      .eq("representada_id", representadaId)
      .order("nome", { ascending: true }),
    supabase
      .from("produtos")
      .select("id, sku, nome, aplicacao, ativo, preco_bruto")
      .eq("representada_id", representadaId)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);

  let tabelaPadrao: string | null = null;
  if (clienteId) {
    const { data: vinc } = await supabase
      .from("cliente_representada")
      .select("tabela_preco_id")
      .eq("cliente_id", clienteId)
      .eq("representada_id", representadaId)
      .maybeSingle();
    tabelaPadrao = (vinc?.tabela_preco_id as string) ?? null;
  }

  const precos: Record<
    string,
    { preco: number; preco_minimo: number | null; desconto_maximo: number | null }
  > = {};

  if (tabelaId) {
    const tab = (tabelas ?? []).find((t) => t.id === tabelaId);
    const desc = Number(tab?.desconto_percentual ?? 0);

    const { data: overrides } = await supabase
      .from("produtos_precos")
      .select("produto_id, preco")
      .eq("tabela_preco_id", tabelaId);
    const overrideMap = new Map(
      (overrides ?? []).map((o) => [o.produto_id as string, o.preco != null ? Number(o.preco) : null])
    );

    for (const p of produtos ?? []) {
      const bruto = p.preco_bruto != null ? Number(p.preco_bruto) : null;
      const liq = precoLiquido(bruto, desc, overrideMap.get(p.id as string) ?? null);
      precos[p.id as string] = {
        preco: liq ?? 0,
        preco_minimo: null,
        desconto_maximo: null,
      };
    }
  }

  return NextResponse.json({
    representada: {
      pedido_minimo: Number(rep?.pedido_minimo ?? 0),
      desconto_maximo_padrao: Number(rep?.desconto_maximo_padrao ?? 0),
    },
    tabelas: tabelas ?? [],
    produtos: produtos ?? [],
    tabelaPadrao,
    precos,
  });
}
