import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";

export interface OndeComprarSeller {
  nome: string;
  permalink: string;
}

export interface OndeComprarProduto {
  id: string;
  sku: string;
  nome: string;
  imagem_url: string | null;
  vendedores: OndeComprarSeller[];
}

/**
 * Busca pública (sem login) pro visitante achar um produto de dropshipping e
 * ver quais sellers CNPJ revendem ele — nunca retorna preço/custo em nenhum
 * campo. `cliente_ml_tokens`/`clientes` (nome do seller) moram no schema
 * `comercial`; resolve numa segunda consulta e junta em código, já que não
 * dá pra fazer embed cross-schema via PostgREST.
 */
export async function buscarOndeComprar(busca: string): Promise<OndeComprarProduto[]> {
  if (!busca.trim()) return [];
  const drop = await createDropshippingAdminClient();
  const t = busca.replace(/[%_]/g, "\\$&");
  const { data: produtos } = await drop
    .from("produtos")
    .select("id, sku, nome, imagem_url")
    .eq("ativo", true)
    .or(`sku.ilike.%${t}%,nome.ilike.%${t}%`)
    .limit(30);
  if (!produtos?.length) return [];

  const produtoIds = produtos.map((p) => p.id as string);
  const { data: anuncios } = await drop
    .from("seller_ml_anuncios")
    .select("produto_id, cliente_id, ml_permalink")
    .eq("ml_status", "active")
    .in("produto_id", produtoIds);

  const clienteIds = [...new Set((anuncios ?? []).map((a) => a.cliente_id as string))];
  const nomePorCliente = new Map<string, string>();
  if (clienteIds.length) {
    const sistema = await createSistemaAdminClient();
    const { data: clientes } = await sistema
      .from("clientes")
      .select("id, nome_fantasia, razao_social")
      .in("id", clienteIds);
    for (const c of clientes ?? []) {
      nomePorCliente.set(c.id as string, (c.nome_fantasia as string) || (c.razao_social as string) || "Seller");
    }
  }

  return produtos.map((p) => ({
    id: p.id as string,
    sku: p.sku as string,
    nome: p.nome as string,
    imagem_url: p.imagem_url as string | null,
    vendedores: (anuncios ?? [])
      .filter((a) => a.produto_id === p.id && a.ml_permalink)
      .map((a) => ({
        nome: nomePorCliente.get(a.cliente_id as string) ?? "Seller",
        permalink: a.ml_permalink as string,
      })),
  }));
}
