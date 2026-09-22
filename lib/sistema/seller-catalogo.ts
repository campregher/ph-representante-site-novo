import { createSistemaAdminClient } from "@/lib/supabase/server";
import { margemMinimaEfetiva, precoMinimoVenda } from "@/lib/sistema/preco";

export interface AnuncioInfo {
  mlItemId: string;
  status: string;
  precoRevenda: number;
  permalink: string | null;
}

export interface CatalogoDropItem {
  id: string;
  sku: string;
  nome: string;
  imagem_url: string | null;
  categoria: string | null;
  estoque_atual: number;
  precoMinimo: number | null;
  mlCategoriaDefinida: boolean;
  anuncio: AnuncioInfo | null;
  fornecedorId: string | null;
  fornecedorNome: string | null;
}

/**
 * Catálogo do seller (drop): só linha própria, ativos e com saldo em
 * estoque. Usa o client admin porque é chamado do portal sem sessão (por
 * token). Não expõe custo — só o preço mínimo de revenda já calculado.
 * Produto sem margem definida (nem no produto, nem na categoria) fica de
 * fora — sem margem não dá pra saber o preço mínimo. `clienteId` opcional:
 * quando informado, traz também o estado do anúncio do ML desse seller
 * pra cada produto (D5).
 */
export async function catalogoDropSeller(clienteId?: string): Promise<CatalogoDropItem[]> {
  const db = await createSistemaAdminClient();
  const [{ data }, { data: anunciosData }] = await Promise.all([
    db
      .from("produtos")
      .select(
        "id, sku, nome, imagem_url, custo, estoque_atual, margem_minima_percentual, ml_category_id, fornecedor_id, fornecedor:fornecedores(nome), categoria:categorias_produtos(nome, margem_minima_percentual)"
      )
      .eq("linha_propria", true)
      .eq("ativo", true)
      .gt("estoque_atual", 0)
      .order("nome")
      .limit(2000),
    clienteId
      ? db
          .from("seller_ml_anuncios")
          .select("produto_id, ml_item_id, ml_status, preco_revenda, ml_permalink")
          .eq("cliente_id", clienteId)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const rows = (data ?? []) as unknown as {
    id: string;
    sku: string;
    nome: string;
    imagem_url: string | null;
    custo: number | null;
    estoque_atual: number;
    margem_minima_percentual: number | null;
    ml_category_id: string | null;
    fornecedor_id: string | null;
    fornecedor: { nome: string } | null;
    categoria: { nome: string; margem_minima_percentual: number | null } | null;
  }[];

  const anuncioPorProduto = new Map(
    ((anunciosData ?? []) as unknown as {
      produto_id: string;
      ml_item_id: string;
      ml_status: string;
      preco_revenda: number;
      ml_permalink: string | null;
    }[]).map((a) => [
      a.produto_id,
      { mlItemId: a.ml_item_id, status: a.ml_status, precoRevenda: Number(a.preco_revenda), permalink: a.ml_permalink },
    ])
  );

  return rows
    .map((r) => {
      const margem = margemMinimaEfetiva(r.margem_minima_percentual, r.categoria?.margem_minima_percentual);
      return {
        id: r.id,
        sku: r.sku,
        nome: r.nome,
        imagem_url: r.imagem_url,
        categoria: r.categoria?.nome ?? null,
        estoque_atual: r.estoque_atual,
        precoMinimo: precoMinimoVenda(r.custo, margem),
        mlCategoriaDefinida: !!r.ml_category_id,
        anuncio: anuncioPorProduto.get(r.id) ?? null,
        fornecedorId: r.fornecedor_id,
        fornecedorNome: r.fornecedor?.nome ?? null,
      };
    })
    .filter((p) => p.precoMinimo != null);
}
