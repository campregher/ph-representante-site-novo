import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { precoLiquido, brutoEfetivo } from "@/lib/sistema/preco";

export const runtime = "nodejs";

/**
 * Dados para o lançamento de pedido:
 * ?representada=<id>&cliente=<id>&tabela=<id>
 * Preço líquido = preço bruto (da variação, senão do produto) − desconto% da
 * tabela (ou override do produto). O override em `produtos_precos` é por produto
 * e vale para todas as suas variações.
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
      .select("id, sku, nome, aplicacao, ativo, preco_bruto, tem_variacoes")
      .eq("representada_id", representadaId)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
  ]);

  const produtoIds = (produtos ?? []).map((p) => p.id as string);

  const { data: variacoesRaw } = produtoIds.length
    ? await supabase
        .from("produto_variacoes")
        .select("id, produto_id, sku, atributos, preco_bruto, ativo")
        .in("produto_id", produtoIds)
        .eq("ativo", true)
        .order("ordem", { ascending: true })
    : { data: [] as Record<string, unknown>[] };

  const variacoes: Record<
    string,
    { id: string; sku: string; atributos: Record<string, string>; preco_bruto: number | null }[]
  > = {};
  for (const v of variacoesRaw ?? []) {
    const pid = v.produto_id as string;
    (variacoes[pid] ??= []).push({
      id: v.id as string,
      sku: v.sku as string,
      atributos: (v.atributos as Record<string, string>) ?? {},
      preco_bruto: v.preco_bruto != null ? Number(v.preco_bruto) : null,
    });
  }

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

  // precos indexado por produto_id (produtos sem variação) e por variacao_id.
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
      const pid = p.id as string;
      const bruto = p.preco_bruto != null ? Number(p.preco_bruto) : null;
      const ov = overrideMap.get(pid) ?? null;

      precos[pid] = {
        preco: precoLiquido(bruto, desc, ov) ?? 0,
        preco_minimo: null,
        desconto_maximo: null,
      };

      for (const v of variacoes[pid] ?? []) {
        precos[v.id] = {
          preco: precoLiquido(brutoEfetivo(v.preco_bruto, bruto), desc, ov) ?? 0,
          preco_minimo: null,
          desconto_maximo: null,
        };
      }
    }
  }

  return NextResponse.json({
    representada: {
      pedido_minimo: Number(rep?.pedido_minimo ?? 0),
      desconto_maximo_padrao: Number(rep?.desconto_maximo_padrao ?? 0),
    },
    tabelas: tabelas ?? [],
    produtos: produtos ?? [],
    variacoes,
    tabelaPadrao,
    precos,
  });
}
