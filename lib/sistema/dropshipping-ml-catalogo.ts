import { createHash } from "node:crypto";
import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { getValidMlToken, getMlContaInfo } from "@/lib/sistema/ml-auth";

/**
 * Publicação de anúncios no Mercado Livre para o catálogo de dropshipping
 * (schema `dropshipping`). Mesma lógica de `lib/sistema/ml-catalogo.ts`
 * (linha própria / schema `comercial`) — duplicada em vez de parametrizada
 * porque aquele arquivo ainda é usado pelo fluxo de sincronização de pedidos
 * (`ml-pedido-sync.ts`, `pedido-drop.ts`, `linha-propria.ts`), que continua
 * no schema antigo; não dá pra repontar sem quebrar esses três chamadores.
 */

const ML_BASE = "https://api.mercadolibre.com";

/** Os dois tipos de anúncio que o seller pode escolher pra uma revenda (ver
 *  ML_TIPO_ANUNCIO_OPTIONS em lib/sistema/schemas.ts) — "Clássico" tem
 *  comissão menor, "Premium" tem mais exposição. Os outros ids que a API
 *  retorna (Diamante/Ouro/Prata/Bronze/Grátis) são tiers legados/promocionais
 *  do próprio ML, não uma escolha real pra publicar um anúncio novo.
 *  "gold_pro" é o padrão — mesmo comportamento de antes pra quem não mexer
 *  nesse campo. */
const LISTING_TYPE_PADRAO = "gold_pro";
const LISTING_TYPES_VALIDOS = new Set(["gold_special", "gold_pro"]);
function resolverListingType(tipoAnuncio: string | null): string {
  return tipoAnuncio && LISTING_TYPES_VALIDOS.has(tipoAnuncio) ? tipoAnuncio : LISTING_TYPE_PADRAO;
}

export interface AnuncioProdutoDrop {
  id: string;
  sku: string;
  nome: string;
  descricao: string | null;
  marca: string | null;
  imagem_url: string | null;
  imagens: string[];
  ml_category_id: string | null;
  transporte_aceito: string[];
  metodo_envio: string | null;
  tipo_anuncio: string | null;
}

type MlResult<T> = ({ ok: true } & T) | { ok: false; error: string };

function mlErro(data: unknown, fallback: string): string {
  const d = data as { cause?: { message?: string }[]; message?: string };
  return d.cause?.[0]?.message ?? d.message ?? fallback;
}

const LABEL_METODO_ENVIO: Record<string, string> = {
  correios: "Correios",
  mercado_envios: "Mercado Envios",
  flex: "Flex",
  entrega_direta: "Entrega Direta",
};

/**
 * Consulta no Mercado Livre quais métodos de envio estão de fato ATIVOS
 * agora nessa conta conectada (não só o que o produto aceita, cadastrado
 * pelo admin) — GET /users/{user_id}/shipping_preferences. Testado ao vivo
 * contra uma conta real conectada: `logistics` vem como uma lista de
 * {mode, types: [{type, status}]} — "me2"/"drop_off" = Mercado Envios,
 * "me2"/"self_service" = Flex, "custom"/"custom" = envio fora da rede do
 * Mercado Envios (nosso "correios" e "entrega_direta" caem nesse mesmo modo
 * do lado do ML, que não distingue os dois — por isso os dois ficam
 * disponíveis juntos quando "custom" está ativo).
 */
export async function metodosEnvioAtivosML(mlContaId: string): Promise<MlResult<{ metodos: string[] }>> {
  let token: string;
  let mlUserId: string;
  try {
    ({ token, mlUserId } = await getMlContaInfo(mlContaId));
  } catch {
    return { ok: false, error: "Conecte sua conta do Mercado Livre primeiro." };
  }

  const res = await fetch(`${ML_BASE}/users/${mlUserId}/shipping_preferences`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: mlErro(data, "Erro ao consultar métodos de envio no Mercado Livre.") };

  const logistics = (data.logistics ?? []) as { mode: string; types: { type: string; status: string }[] }[];
  const ativo = (mode: string, type: string) =>
    logistics.some((l) => l.mode === mode && l.types.some((t) => t.type === type && t.status === "active"));

  const metodos: string[] = [];
  if (ativo("me2", "drop_off")) metodos.push("mercado_envios");
  if (ativo("me2", "self_service")) metodos.push("flex");
  if (ativo("custom", "custom")) metodos.push("correios", "entrega_direta");

  return { ok: true, metodos };
}

export interface RecebimentoML {
  comissao: number;
  /** true só quando o modo de envio é me2 (Mercado Envios/Flex) — só aí
   *  existe o "frete grátis que o seller banca" que o ML gerencia e
   *  consegue calcular. Pra item JÁ PUBLICADO, confirma isso com o modo de
   *  envio REAL do item na API do ML (`GET /items/{id}` → `shipping.mode`),
   *  não com o que está só cadastrado localmente — o cadastro local pode
   *  estar errado ou ter ficado desatualizado se algo mudou direto no
   *  painel do ML. Pra item ainda não publicado (sem item_id), não tem
   *  modo real pra checar — usa o método escolhido como estimativa. */
  freteAplicavel: boolean;
  /** null = ainda não dá pra saber (freteAplicavel true mas item ainda não
   *  publicado) OU não se aplica (freteAplicavel false). */
  frete: number | null;
  recebe: number;
}

/**
 * "Quanto você recebe" igual à Central de Vendedores do próprio Mercado
 * Livre — testado ao vivo contra os números reais de um anúncio publicado
 * (bateram certinho): comissão = `sale_fee_amount` de
 * GET /sites/MLB/listing_prices (só precisa preço+categoria+tipo de
 * anúncio, dá pra calcular mesmo ANTES de publicar); frete grátis que o
 * seller banca = `list_cost` de
 * GET /users/{seller_id}/shipping_options/free?item_id=X — só busca esse
 * valor quando o modo de envio é me2 (Mercado Envios/Flex). Pra item já
 * publicado, confirma o modo de envio consultando o item de verdade na API
 * (`GET /items/{id}`) em vez de confiar só no método cadastrado localmente.
 */
export async function calcularRecebimentoML(
  mlContaId: string,
  categoryId: string,
  preco: number,
  tipoAnuncio: string | null,
  metodoEnvio: string | null,
  mlItemId?: string
): Promise<MlResult<RecebimentoML>> {
  let token: string;
  let mlUserId: string;
  try {
    ({ token, mlUserId } = await getMlContaInfo(mlContaId));
  } catch {
    return { ok: false, error: "Conecte sua conta do Mercado Livre primeiro." };
  }

  const resComissao = await fetch(
    `${ML_BASE}/sites/MLB/listing_prices?price=${preco}&category_id=${categoryId}&listing_type_id=${resolverListingType(tipoAnuncio)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const dataComissao = await resComissao.json();
  if (!resComissao.ok) return { ok: false, error: mlErro(dataComissao, "Erro ao calcular a comissão no Mercado Livre.") };
  const comissao = Number(dataComissao.sale_fee_amount ?? 0);

  let freteAplicavel: boolean;
  let frete: number | null = null;
  if (mlItemId) {
    const resItem = await fetch(`${ML_BASE}/items/${mlItemId}?attributes=shipping`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const dataItem = await resItem.json();
    freteAplicavel = resItem.ok && dataItem.shipping?.mode === "me2";
    if (freteAplicavel) {
      const resFrete = await fetch(`${ML_BASE}/users/${mlUserId}/shipping_options/free?item_id=${mlItemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resFrete.ok) {
        const dataFrete = await resFrete.json();
        const custo = Number(dataFrete.coverage?.all_country?.list_cost);
        if (Number.isFinite(custo)) frete = custo;
      }
    }
  } else {
    freteAplicavel = metodoEnvio === "mercado_envios" || metodoEnvio === "flex";
  }

  return { ok: true, comissao, freteAplicavel, frete, recebe: preco - comissao - (frete ?? 0) };
}

/**
 * Mapeia o método de envio que o SELLER cadastrou pra esse produto (em
 * "Detalhes do produto", antes de anunciar — ver
 * lib/sistema/actions/seller-ml-catalogo.ts) pro objeto `shipping` que a API
 * do Mercado Livre espera na criação do item — mas só aceita um método que
 * esteja de fato ATIVO agora na conta que vai publicar (ver
 * `metodosEnvioAtivosML`), não só cadastrado. "shopee_express" não existe
 * no ML — só serve pro catálogo da Shopee — e por isso nunca é aceito aqui.
 */
async function resolverShippingML(
  mlContaId: string,
  transporteAceito: string[],
  metodoEnvio: string | null
): Promise<{ shipping: Record<string, unknown> } | { error: string }> {
  if (transporteAceito.length === 0) {
    return { error: "Produto sem transporte aceito configurado (fale com a PH)." };
  }
  if (!metodoEnvio) {
    return { error: "Cadastre o método de envio desse produto em \"Detalhes do produto\" antes de anunciar." };
  }
  if (!transporteAceito.includes(metodoEnvio)) {
    return { error: "O método de envio cadastrado pra esse produto não é mais aceito por ele — revise em \"Detalhes do produto\"." };
  }
  if (!(metodoEnvio in LABEL_METODO_ENVIO)) {
    return { error: "Esse método de envio não funciona no Mercado Livre (ex.: Shopee Express é só pra Shopee) — escolha outro em \"Detalhes do produto\"." };
  }

  const ativosRes = await metodosEnvioAtivosML(mlContaId);
  if (!ativosRes.ok) return { error: ativosRes.error };
  if (!ativosRes.metodos.includes(metodoEnvio)) {
    return {
      error: `"${LABEL_METODO_ENVIO[metodoEnvio]}" não está ativo nessa conta do Mercado Livre agora — ative-o no painel do ML ou escolha outro método em "Detalhes do produto".`,
    };
  }

  if (metodoEnvio === "mercado_envios") {
    return { shipping: { mode: "me2", local_pick_up: false, free_shipping: false } };
  }
  if (metodoEnvio === "flex") {
    return { shipping: { mode: "me2", local_pick_up: false, free_shipping: false, logistic_type: "self_service" } };
  }
  return { shipping: { mode: "custom" } };
}

interface CategoriaAttr {
  id: string;
  name: string;
  hierarchy?: string;
  value_type: string;
  tags?: { required?: boolean; allow_variations?: boolean };
  values?: { id: string; name: string }[];
}

async function categoriaAttrs(categoryId: string): Promise<CategoriaAttr[]> {
  const res = await fetch(`${ML_BASE}/categories/${categoryId}/attributes`);
  if (!res.ok) return [];
  return (await res.json()) as CategoriaAttr[];
}

async function atributosFamilyObrigatorios(
  categoryId: string
): Promise<{ id: string; value_id: string }[] | { ambiguo: string }> {
  const attrs = await categoriaAttrs(categoryId);
  const obrigatorios = attrs.filter((a) => a.tags?.required && a.hierarchy === "FAMILY");
  const resolvidos: { id: string; value_id: string }[] = [];
  for (const a of obrigatorios) {
    if (a.value_type === "list" && a.values?.length === 1) {
      resolvidos.push({ id: a.id, value_id: a.values[0].id });
    } else {
      return { ambiguo: a.id };
    }
  }
  return resolvidos;
}

/**
 * Publica um produto do catálogo de dropshipping como anúncio novo no ML e
 * grava o vínculo em `dropshipping.seller_ml_anuncios`.
 */
export async function publicarAnuncioMLDrop(
  clienteId: string,
  mlContaId: string,
  produto: AnuncioProdutoDrop,
  precoRevenda: number
): Promise<MlResult<{ mlItemId: string; permalink: string }>> {
  if (!produto.ml_category_id)
    return { ok: false, error: "Produto sem categoria do Mercado Livre definida (fale com a PH)." };

  const shippingRes = await resolverShippingML(mlContaId, produto.transporte_aceito, produto.metodo_envio);
  if ("error" in shippingRes) return { ok: false, error: shippingRes.error };

  let token: string;
  try {
    token = await getValidMlToken(mlContaId);
  } catch {
    return { ok: false, error: "Conecte sua conta do Mercado Livre primeiro." };
  }

  const familyAttrs = await atributosFamilyObrigatorios(produto.ml_category_id);
  if ("ambiguo" in familyAttrs) {
    return {
      ok: false,
      error: `Categoria do Mercado Livre exige o atributo "${familyAttrs.ambiguo}" com mais de uma opção possível — fale com a PH pra configurar.`,
    };
  }

  const fotos = produto.imagens.length > 0 ? produto.imagens : produto.imagem_url ? [produto.imagem_url] : [];
  const pictures = fotos.map((url) => ({ source: url }));
  const attributes = [
    ...(produto.marca ? [{ id: "BRAND", value_name: produto.marca }] : []),
    { id: "PART_NUMBER", value_name: produto.sku },
    ...familyAttrs,
  ];
  const nomeCurto = produto.nome.slice(0, 60);
  const isFamily = familyAttrs.length > 0;

  const body = {
    ...(isFamily ? { family_name: nomeCurto } : { title: nomeCurto }),
    category_id: produto.ml_category_id,
    price: precoRevenda,
    currency_id: "BRL",
    available_quantity: 1,
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: resolverListingType(produto.tipo_anuncio),
    pictures,
    attributes,
    shipping: shippingRes.shipping,
  };

  const res = await fetch(`${ML_BASE}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: mlErro(data, "Erro ao publicar no Mercado Livre.") };

  if (produto.descricao) {
    await fetch(`${ML_BASE}/items/${data.id}/description`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plain_text: produto.descricao }),
    }).catch(() => {});
  }

  const db = await createDropshippingAdminClient();
  const { error } = await db.from("seller_ml_anuncios").upsert(
    {
      cliente_id: clienteId,
      produto_id: produto.id,
      ml_conta_id: mlContaId,
      ml_item_id: data.id,
      ml_status: data.status ?? "active",
      ml_permalink: data.permalink ?? null,
      preco_revenda: precoRevenda,
    },
    { onConflict: "cliente_id,produto_id,ml_conta_id" }
  );
  if (error) return { ok: false, error: `Anunciado no ML, mas falhou salvar localmente: ${error.message}` };

  return { ok: true, mlItemId: data.id as string, permalink: data.permalink as string };
}

export interface VariacaoProdutoDrop {
  id: string;
  sku: string;
  variacao: string;
  estoque_atual: number;
  imagens: string[];
}

export interface AnuncioGrupoDrop {
  nome: string;
  descricao: string | null;
  marca: string | null;
  ml_category_id: string | null;
  transporte_aceito: string[];
  metodo_envio: string | null;
  tipo_anuncio: string | null;
  variantes: VariacaoProdutoDrop[];
}

/**
 * PART_NUMBER sintético e estável, compartilhado por todas as variações do
 * mesmo produto (hash do nome) — é isso que faz o Mercado Livre agrupar os
 * itens na mesma "família" (visualmente, 1 produto com seletor de cor),
 * com COLOR como o atributo que varia entre eles.
 *
 * IMPORTANTE — por que não usa `variations[]`: pra categorias com atributo
 * FAMILY obrigatório (a maioria de peças automotivas daqui, ex.: COLOR
 * exige VEHICLE_TYPE), testei ao vivo contra a API real e o ML REJEITA o
 * item ("the field variations is invalid with family name") quando o body
 * tem `variations` E `family_name` juntos. O jeito certo é publicar cada
 * variação como item SEPARADO, com BRAND+PART_NUMBER iguais (atributos
 * PARENT_PK dessa categoria) e COLOR (CHILD_PK) diferente — confirmado
 * criando 2 itens de teste reais: vieram com o mesmo `family_id`.
 */
function partNumberDoGrupo(nome: string): string {
  return createHash("sha1").update(nome).digest("hex").slice(0, 16);
}

export interface PublicarVarianteResultado {
  produtoId: string;
  sku: string;
  ok: boolean;
  error?: string;
  mlItemId?: string;
  permalink?: string;
}

/**
 * Publica um GRUPO de variações (cor/acabamento) do mesmo produto no ML —
 * um item por variação (ver `partNumberDoGrupo`), que o próprio ML agrupa
 * visualmente numa família. Continua (parcialmente, se alguma variação
 * falhar) salvando 1 linha por produto/variação em
 * `dropshipping.seller_ml_anuncios`, cada uma com seu PRÓPRIO ml_item_id.
 */
export async function publicarGrupoMLDrop(
  clienteId: string,
  mlContaId: string,
  grupo: AnuncioGrupoDrop,
  precoRevenda: number
): Promise<MlResult<{ resultados: PublicarVarianteResultado[] }>> {
  if (!grupo.ml_category_id)
    return { ok: false, error: "Produto sem categoria do Mercado Livre definida (fale com a PH)." };
  if (grupo.variantes.length < 2) return { ok: false, error: "Esse produto não tem variações pra agrupar." };

  const shippingRes = await resolverShippingML(mlContaId, grupo.transporte_aceito, grupo.metodo_envio);
  if ("error" in shippingRes) return { ok: false, error: shippingRes.error };

  let token: string;
  try {
    token = await getValidMlToken(mlContaId);
  } catch {
    return { ok: false, error: "Conecte sua conta do Mercado Livre primeiro." };
  }

  const familyAttrs = await atributosFamilyObrigatorios(grupo.ml_category_id);
  if ("ambiguo" in familyAttrs) {
    return {
      ok: false,
      error: `Categoria do Mercado Livre exige o atributo "${familyAttrs.ambiguo}" com mais de uma opção possível — fale com a PH pra configurar.`,
    };
  }

  const partNumber = partNumberDoGrupo(grupo.nome);
  const nomeCurto = grupo.nome.slice(0, 60);
  const isFamily = familyAttrs.length > 0;
  const db = await createDropshippingAdminClient();
  const resultados: PublicarVarianteResultado[] = [];

  for (const v of grupo.variantes) {
    const attributes = [
      ...(grupo.marca ? [{ id: "BRAND", value_name: grupo.marca }] : []),
      { id: "PART_NUMBER", value_name: partNumber },
      { id: "COLOR", value_name: v.variacao },
      ...familyAttrs,
    ];
    const body = {
      ...(isFamily ? { family_name: nomeCurto } : { title: nomeCurto }),
      category_id: grupo.ml_category_id,
      price: precoRevenda,
      currency_id: "BRL",
      available_quantity: 1,
      buying_mode: "buy_it_now",
      condition: "new",
      listing_type_id: resolverListingType(grupo.tipo_anuncio),
      pictures: v.imagens.map((url) => ({ source: url })),
      attributes,
      shipping: shippingRes.shipping,
    };

    const res = await fetch(`${ML_BASE}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      resultados.push({ produtoId: v.id, sku: v.sku, ok: false, error: mlErro(data, "Erro ao publicar no Mercado Livre.") });
      continue;
    }

    if (grupo.descricao) {
      await fetch(`${ML_BASE}/items/${data.id}/description`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ plain_text: grupo.descricao }),
      }).catch(() => {});
    }

    const { error } = await db.from("seller_ml_anuncios").upsert(
      {
        cliente_id: clienteId,
        produto_id: v.id,
        ml_conta_id: mlContaId,
        ml_item_id: data.id as string,
        ml_status: (data.status as string) ?? "active",
        ml_permalink: data.permalink as string | null,
        preco_revenda: precoRevenda,
      },
      { onConflict: "cliente_id,produto_id,ml_conta_id" }
    );
    if (error) {
      resultados.push({ produtoId: v.id, sku: v.sku, ok: false, error: `Publicado no ML, mas falhou salvar localmente: ${error.message}` });
      continue;
    }
    resultados.push({ produtoId: v.id, sku: v.sku, ok: true, mlItemId: data.id as string, permalink: data.permalink as string });
  }

  return { ok: true, resultados };
}

/** Atualiza preço e/ou status (pausar/reativar) de um anúncio do catálogo de dropshipping já publicado. */
export async function atualizarAnuncioMLDrop(
  mlContaId: string,
  produtoId: string,
  mlItemId: string,
  patch: { price?: number; status?: "active" | "paused" | "closed" }
): Promise<{ ok: true } | { ok: false; error: string }> {
  let token: string;
  try {
    token = await getValidMlToken(mlContaId);
  } catch {
    return { ok: false, error: "Conecte sua conta do Mercado Livre primeiro." };
  }

  const res = await fetch(`${ML_BASE}/items/${mlItemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(patch),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: mlErro(data, "Erro ao atualizar anúncio no Mercado Livre.") };

  const dbPatch: Record<string, unknown> = {};
  if (patch.price != null) dbPatch.preco_revenda = patch.price;
  if (patch.status) dbPatch.ml_status = (data.status as string) ?? patch.status;
  if (Object.keys(dbPatch).length) {
    const db = await createDropshippingAdminClient();
    await db
      .from("seller_ml_anuncios")
      .update(dbPatch)
      .eq("ml_conta_id", mlContaId)
      .eq("produto_id", produtoId);
  }
  return { ok: true };
}

/**
 * Chamada pelo webhook do ML (topic "items", `app/api/drop/ml/webhook/route.ts`)
 * — mantém `dropshipping.seller_ml_anuncios` sincronizado com o que está de
 * verdade no Mercado Livre, mesmo quando a mudança (pausar, reativar, fechar,
 * mudar preço) acontece direto no painel do ML, fora do nosso portal.
 * Idempotente — webhook do ML reenvia a mesma notificação várias vezes.
 *
 * IMPORTANTE: o tópico "items" precisa estar habilitado nas notificações do
 * app no painel de desenvolvedores do Mercado Livre (notifications_url +
 * lista de tópicos) — isso é configuração externa, feita lá, não tem como
 * habilitar por código daqui.
 */
export async function sincronizarAnuncioMLDrop(mlItemId: string): Promise<void> {
  const db = await createDropshippingAdminClient();
  const { data: linhas } = await db
    .from("seller_ml_anuncios")
    .select("id, ml_variation_id, ml_conta_id")
    .eq("ml_item_id", mlItemId);
  if (!linhas || linhas.length === 0) return; // não é um anúncio nosso (ou já foi excluído localmente)

  // item ativo/pausado é público; closed às vezes só é legível autenticado —
  // tenta sem token primeiro (evita bater em getValidMlToken/refresh à toa).
  let res = await fetch(`${ML_BASE}/items/${mlItemId}`);
  if (!res.ok) {
    try {
      const token = await getValidMlToken(linhas[0].ml_conta_id as string);
      res = await fetch(`${ML_BASE}/items/${mlItemId}`, { headers: { Authorization: `Bearer ${token}` } });
    } catch {
      return;
    }
  }
  if (!res.ok) return;
  const data = await res.json();
  const status = data.status as string | undefined;
  if (!status) return;

  // "closed" é definitivo no ML (não dá pra reabrir) — limpa local também,
  // igual ao que a exclusão pelo nosso portal já faz.
  if (status === "closed") {
    await db.from("seller_ml_anuncios").delete().eq("ml_item_id", mlItemId);
    return;
  }

  const variacoes = (data.variations ?? []) as { id: number | string; price?: number }[];
  if (variacoes.length > 0) {
    const precoPorVariationId = new Map(variacoes.map((v) => [String(v.id), v.price]));
    for (const linha of linhas) {
      const preco = linha.ml_variation_id ? precoPorVariationId.get(linha.ml_variation_id as string) : undefined;
      const patch: Record<string, unknown> = { ml_status: status };
      if (preco != null) patch.preco_revenda = preco;
      await db.from("seller_ml_anuncios").update(patch).eq("id", linha.id as string);
    }
  } else {
    const patch: Record<string, unknown> = { ml_status: status };
    if (data.price != null) patch.preco_revenda = data.price;
    await db.from("seller_ml_anuncios").update(patch).eq("ml_item_id", mlItemId);
  }
}
