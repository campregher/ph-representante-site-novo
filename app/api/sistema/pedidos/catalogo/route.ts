import { NextResponse } from "next/server";
import { getSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { precoLiquido, brutoEfetivo } from "@/lib/sistema/preco";

export const runtime = "nodejs";

// O PostgREST limita cada resposta a 1.000 linhas. Para representadas com
// catálogo grande, buscamos em páginas de 1.000 até esgotar.
const PAGE = 1000;

async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  makeQuery: (from: number, to: number) => any
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await makeQuery(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

type ProdutoRow = {
  id: string;
  sku: string;
  nome: string;
  aplicacao: string | null;
  ativo: boolean;
  preco_bruto: number | null;
  tem_variacoes: boolean;
};

type VariacaoRow = {
  id: string;
  produto_id: string;
  sku: string;
  atributos: Record<string, string> | null;
  preco_bruto: number | null;
};

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

  try {
    const [{ data: rep }, { data: tabelas }] = await Promise.all([
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
    ]);

    const produtos = await fetchAll<ProdutoRow>((from, to) =>
      supabase
        .from("produtos")
        .select("id, sku, nome, aplicacao, ativo, preco_bruto, tem_variacoes")
        .eq("representada_id", representadaId)
        .eq("ativo", true)
        .order("nome", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    );

    // variações ativas dos produtos desta representada (via FK, sem .in gigante)
    const variacoesRaw = await fetchAll<VariacaoRow & { produtos: unknown }>((from, to) =>
      supabase
        .from("produto_variacoes")
        .select("id, produto_id, sku, atributos, preco_bruto, produtos!inner(representada_id)")
        .eq("produtos.representada_id", representadaId)
        .eq("ativo", true)
        .order("produto_id", { ascending: true })
        .order("ordem", { ascending: true })
        .range(from, to)
    );

    const variacoes: Record<
      string,
      { id: string; sku: string; atributos: Record<string, string>; preco_bruto: number | null }[]
    > = {};
    for (const v of variacoesRaw) {
      (variacoes[v.produto_id] ??= []).push({
        id: v.id,
        sku: v.sku,
        atributos: v.atributos ?? {},
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

      const overrides = await fetchAll<{ produto_id: string; preco: number | null }>((from, to) =>
        supabase
          .from("produtos_precos")
          .select("produto_id, preco")
          .eq("tabela_preco_id", tabelaId)
          .order("produto_id", { ascending: true })
          .range(from, to)
      );
      const overrideMap = new Map(
        overrides.map((o) => [o.produto_id, o.preco != null ? Number(o.preco) : null])
      );

      for (const p of produtos) {
        const bruto = p.preco_bruto != null ? Number(p.preco_bruto) : null;
        const ov = overrideMap.get(p.id) ?? null;

        precos[p.id] = {
          preco: precoLiquido(bruto, desc, ov) ?? 0,
          preco_minimo: null,
          desconto_maximo: null,
        };

        for (const v of variacoes[p.id] ?? []) {
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
      produtos,
      variacoes,
      tabelaPadrao,
      precos,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao carregar o catálogo.";
    return NextResponse.json({ error: `Catálogo: ${msg}` }, { status: 500 });
  }
}
