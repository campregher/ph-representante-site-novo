import { createSistemaAdminClient } from "@/lib/supabase/server";
import { margemMinimaEfetiva, precoMinimoVenda } from "@/lib/sistema/preco";

export interface CatalogoDropItem {
  id: string;
  sku: string;
  nome: string;
  imagem_url: string | null;
  categoria: string | null;
  estoque_atual: number;
  precoMinimo: number | null;
}

/**
 * Catálogo público do seller (drop): só linha própria, ativos e com saldo em
 * estoque. Usa o client admin porque é chamado do portal sem sessão (por
 * token). Não expõe custo — só o preço mínimo de revenda já calculado.
 * Produto sem margem definida (nem no produto, nem na categoria) fica de
 * fora — sem margem não dá pra saber o preço mínimo.
 */
export async function catalogoDropSeller(): Promise<CatalogoDropItem[]> {
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("produtos")
    .select(
      "id, sku, nome, imagem_url, custo, estoque_atual, margem_minima_percentual, categoria:categorias_produtos(nome, margem_minima_percentual)"
    )
    .eq("linha_propria", true)
    .eq("ativo", true)
    .gt("estoque_atual", 0)
    .order("nome")
    .limit(2000);

  const rows = (data ?? []) as unknown as {
    id: string;
    sku: string;
    nome: string;
    imagem_url: string | null;
    custo: number | null;
    estoque_atual: number;
    margem_minima_percentual: number | null;
    categoria: { nome: string; margem_minima_percentual: number | null } | null;
  }[];

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
      };
    })
    .filter((p) => p.precoMinimo != null);
}
