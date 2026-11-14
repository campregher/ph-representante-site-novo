import { createDropshippingAdminClient, createSistemaAdminClient } from "@/lib/supabase/server";

export interface AnuncioInfo {
  mlContaId: string;
  contaNickname: string | null;
  mlItemId: string;
  status: string;
  precoRevenda: number;
  permalink: string | null;
}

export interface CatalogoDropItem {
  id: string;
  sku: string;
  nome: string;
  descricao: string | null;
  imagem_url: string | null;
  imagens: string[];
  variacao: string | null;
  categoria: string | null;
  estoque_atual: number;
  precoMinimo: number | null;
  custoReferencia: number | null;
  personalizado: boolean;
  mlCategoriaDefinida: boolean;
  /** um produto pode estar anunciado em mais de uma conta do ML do seller ao mesmo tempo */
  anuncios: AnuncioInfo[];
  fornecedorId: string | null;
  fornecedorNome: string | null;
  /** métodos de envio aceitos por esse produto (cadastro do admin) e, dentre
   *  eles, o que esse seller registrou pra usar nesse anúncio (null = ainda
   *  não cadastrou — bloqueia publicar, ver seller-ml-catalogo.ts). */
  transporteAceito: string[];
  metodoEnvio: string | null;
  /** Clássico ou Premium — null = usa Premium (ver resolverListingType em
   *  dropshipping-ml-catalogo.ts). */
  tipoAnuncio: string | null;
}

/**
 * Catálogo do seller CNPJ de dropshipping: produtos ativos e com saldo em
 * estoque do schema `dropshipping`, com preço mínimo de revenda = preço
 * sugerido da tabela CNPJ. Usa o client admin porque é chamado do portal sem
 * sessão (por token). `custoReferencia` (custo real de fábrica) vai só pro
 * seller comparar com o preço de revenda — nunca é enviado ao Mercado Livre
 * nem exibido pro comprador final. `clienteId` opcional: quando informado,
 * também traz o(s) anúncio(s) do ML desse seller (um produto pode estar
 * anunciado em mais de uma conta) e a customização de título/descrição/fotos
 * que esse seller tenha salvo pra esse produto (sem alterar o cadastro do
 * admin, que continua valendo pros outros sellers — ver migration 046).
 */
export async function catalogoDropSeller(clienteId?: string): Promise<CatalogoDropItem[]> {
  const drop = await createDropshippingAdminClient();
  const [{ data }, { data: anunciosData }, { data: customData }] = await Promise.all([
    drop
      .from("produtos")
      .select(
        "id, sku, nome, descricao, imagem_url, imagens, variacao, estoque_atual, ml_category_id, transporte_aceito, fornecedor_id, fornecedor:fornecedores(nome), produto_precos(custo, preco_sugerido, tabela:tabelas_preco(codigo))"
      )
      .eq("ativo", true)
      .gt("estoque_atual", 0)
      .order("nome")
      .limit(2000),
    clienteId
      ? drop
          .from("seller_ml_anuncios")
          .select("produto_id, ml_conta_id, ml_item_id, ml_status, preco_revenda, ml_permalink")
          .eq("cliente_id", clienteId)
      : Promise.resolve({ data: [] as unknown[] }),
    clienteId
      ? drop
          .from("seller_produto_customizacoes")
          .select("produto_id, nome, descricao, imagens, metodo_envio, tipo_anuncio")
          .eq("cliente_id", clienteId)
      : Promise.resolve({ data: [] as unknown[] }),
  ]);

  const rows = (data ?? []) as unknown as {
    id: string;
    sku: string;
    nome: string;
    descricao: string | null;
    imagem_url: string | null;
    imagens: string[] | null;
    variacao: string | null;
    estoque_atual: number;
    ml_category_id: string | null;
    transporte_aceito: string[] | null;
    fornecedor_id: string | null;
    fornecedor: { nome: string } | null;
    produto_precos: { custo: number; preco_sugerido: number | null; tabela: { codigo: string } | null }[];
  }[];

  const anunciosRows = (anunciosData ?? []) as unknown as {
    produto_id: string;
    ml_conta_id: string;
    ml_item_id: string;
    ml_status: string;
    preco_revenda: number;
    ml_permalink: string | null;
  }[];

  const customRows = (customData ?? []) as unknown as {
    produto_id: string;
    nome: string | null;
    descricao: string | null;
    imagens: string[] | null;
    metodo_envio: string | null;
    tipo_anuncio: string | null;
  }[];
  const customPorProduto = new Map(customRows.map((c) => [c.produto_id, c]));

  // `cliente_ml_tokens` (nickname da conta) mora no schema `comercial` — não
  // dá pra fazer embed cross-schema via PostgREST, então resolve numa
  // segunda consulta e junta em código.
  const contaIds = [...new Set(anunciosRows.map((a) => a.ml_conta_id))];
  const nicknamePorConta = new Map<string, string | null>();
  if (contaIds.length) {
    const sistema = await createSistemaAdminClient();
    const { data: contas } = await sistema.from("cliente_ml_tokens").select("id, ml_nickname").in("id", contaIds);
    for (const c of contas ?? []) nicknamePorConta.set(c.id as string, c.ml_nickname as string | null);
  }

  const anunciosPorProduto = new Map<string, AnuncioInfo[]>();
  for (const a of anunciosRows) {
    const lista = anunciosPorProduto.get(a.produto_id) ?? [];
    lista.push({
      mlContaId: a.ml_conta_id,
      contaNickname: nicknamePorConta.get(a.ml_conta_id) ?? null,
      mlItemId: a.ml_item_id,
      status: a.ml_status,
      precoRevenda: Number(a.preco_revenda),
      permalink: a.ml_permalink,
    });
    anunciosPorProduto.set(a.produto_id, lista);
  }

  return rows
    .map((r) => {
      const cnpj = r.produto_precos.find((p) => p.tabela?.codigo === "cnpj");
      const custom = customPorProduto.get(r.id);
      const imagens = custom?.imagens?.length ? custom.imagens : r.imagens ?? [];
      return {
        id: r.id,
        sku: r.sku,
        nome: custom?.nome || r.nome,
        descricao: custom?.descricao || r.descricao,
        imagem_url: imagens[0] ?? r.imagem_url,
        imagens,
        variacao: r.variacao,
        categoria: null,
        estoque_atual: r.estoque_atual,
        precoMinimo: cnpj?.preco_sugerido ?? null,
        custoReferencia: cnpj?.custo ?? null,
        personalizado: !!custom,
        mlCategoriaDefinida: !!r.ml_category_id,
        anuncios: anunciosPorProduto.get(r.id) ?? [],
        fornecedorId: r.fornecedor_id,
        fornecedorNome: r.fornecedor?.nome ?? null,
        transporteAceito: r.transporte_aceito ?? [],
        metodoEnvio: custom?.metodo_envio ?? null,
        tipoAnuncio: custom?.tipo_anuncio ?? null,
      };
    })
    .filter((p) => p.precoMinimo != null);
}
