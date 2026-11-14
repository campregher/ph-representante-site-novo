import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { getValidMlToken } from "@/lib/sistema/ml-auth";

/**
 * Publicação de anúncios no Mercado Livre para o catálogo de dropshipping
 * (schema `dropshipping`). Mesma lógica de `lib/sistema/ml-catalogo.ts`
 * (linha própria / schema `comercial`) — duplicada em vez de parametrizada
 * porque aquele arquivo ainda é usado pelo fluxo de sincronização de pedidos
 * (`ml-pedido-sync.ts`, `pedido-drop.ts`, `linha-propria.ts`), que continua
 * no schema antigo; não dá pra repontar sem quebrar esses três chamadores.
 */

const ML_BASE = "https://api.mercadolibre.com";

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
}

type MlResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Mapeia o(s) transporte(s) que o produto aceita (definidos no admin) pro
 * objeto `shipping` que a API do Mercado Livre espera na criação do item —
 * mas só considera um método se o SELLER também disse (no questionário de
 * onboarding) que usa esse método; se o seller não respondeu/não declarou
 * nenhum, cai de volta pra lista do produto sozinha (não bloqueia quem ainda
 * não preencheu o questionário). "shopee_express" não existe no ML — só
 * serve pro catálogo da Shopee — e por isso nunca entra nesse mapa.
 * Prioridade quando mais de um método bate: Mercado Envios (mode "me2", sem
 * logistic_type — deixa a conta do seller decidir qual sub-tipo ela tem
 * habilitado) > Flex (me2 + logistic_type "self_service", só funciona se a
 * conta do seller tiver Flex habilitado pelo ML) > Correios/Entrega Direta
 * (mode "custom" — seller cuida do envio fora da rede do Mercado Envios).
 *
 * IMPORTANTE: essa parte ainda não foi testada contra uma conta real do ML
 * conectada — os nomes dos campos (mode/logistic_type/self_service/custom)
 * seguem a documentação pública da API de Items + Shipping do Mercado Livre,
 * mas elegibilidade de Flex/me2 depende de habilitação por conta e categoria
 * que só a resposta real da API confirma. Teste com uma publicação real
 * antes de confiar nisso em produção.
 */
function resolverShippingML(
  transporteAceito: string[],
  sellerMetodosEnvio: string[]
): { shipping: Record<string, unknown> } | { error: string } {
  const disponiveis =
    sellerMetodosEnvio.length > 0
      ? transporteAceito.filter((t) => sellerMetodosEnvio.includes(t))
      : transporteAceito;

  if (disponiveis.includes("mercado_envios")) {
    return { shipping: { mode: "me2", local_pick_up: false, free_shipping: false } };
  }
  if (disponiveis.includes("flex")) {
    return { shipping: { mode: "me2", local_pick_up: false, free_shipping: false, logistic_type: "self_service" } };
  }
  if (disponiveis.includes("correios") || disponiveis.includes("entrega_direta")) {
    return { shipping: { mode: "custom" } };
  }
  if (transporteAceito.length === 0) {
    return { error: "Produto sem transporte aceito configurado (fale com a PH)." };
  }
  if (disponiveis.length === 0) {
    return {
      error:
        "Nenhum dos métodos de envio que você usa (configurados no seu cadastro) bate com o transporte aceito por esse produto.",
    };
  }
  return { error: "Nenhum dos transportes aceitos por esse produto funciona no Mercado Livre (ex.: Shopee Express é só pra Shopee)." };
}

function mlErro(data: unknown, fallback: string): string {
  const d = data as { cause?: { message?: string }[]; message?: string };
  return d.cause?.[0]?.message ?? d.message ?? fallback;
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
 * Acha o atributo que o Mercado Livre usa como variação nessa categoria
 * (ex.: COLOR pra "Apoios de Braço" — tag `allow_variations`). Se a
 * categoria não tiver exatamente um, não dá pra publicar como variações
 * (o chamador cai pra erro pedindo contato com a PH).
 */
async function atributoVariacaoML(categoryId: string): Promise<CategoriaAttr | null> {
  const attrs = await categoriaAttrs(categoryId);
  const candidatos = attrs.filter((a) => a.tags?.allow_variations);
  return candidatos.length === 1 ? candidatos[0] : null;
}

/** Resolve o valor desse atributo de variação pro texto da cor/variação
 *  cadastrada (ex.: "Couro Bege") — value_name direto se o atributo aceita
 *  texto livre, ou acha o value_id correspondente se é uma lista fechada. */
function valorAtributoVariacao(
  attr: CategoriaAttr,
  variacaoTexto: string
): { value_name: string } | { value_id: string } | null {
  if (attr.value_type === "string") return { value_name: variacaoTexto };
  if (attr.value_type === "list") {
    const match = attr.values?.find((v) => v.name.toLowerCase() === variacaoTexto.toLowerCase());
    return match ? { value_id: match.id } : null;
  }
  return null;
}

/**
 * Publica um produto do catálogo de dropshipping como anúncio novo no ML e
 * grava o vínculo em `dropshipping.seller_ml_anuncios`.
 */
export async function publicarAnuncioMLDrop(
  clienteId: string,
  mlContaId: string,
  produto: AnuncioProdutoDrop,
  precoRevenda: number,
  sellerMetodosEnvio: string[] = []
): Promise<MlResult<{ mlItemId: string; permalink: string }>> {
  if (!produto.ml_category_id)
    return { ok: false, error: "Produto sem categoria do Mercado Livre definida (fale com a PH)." };

  const shippingRes = resolverShippingML(produto.transporte_aceito, sellerMetodosEnvio);
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
    listing_type_id: "gold_pro",
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
  variantes: VariacaoProdutoDrop[];
}

/**
 * Publica um GRUPO de variações (cor/acabamento) do mesmo produto como UM
 * único anúncio com variações no ML — corrige o bug de cada variação virar
 * um anúncio simples separado. Grava uma linha em
 * `dropshipping.seller_ml_anuncios` por produto/variação, todas apontando
 * pro mesmo `ml_item_id` (cada uma com seu `ml_variation_id` próprio).
 */
export async function publicarAnuncioMLDropComVariacoes(
  clienteId: string,
  mlContaId: string,
  grupo: AnuncioGrupoDrop,
  precoRevenda: number,
  sellerMetodosEnvio: string[] = []
): Promise<MlResult<{ mlItemId: string; permalink: string }>> {
  if (!grupo.ml_category_id)
    return { ok: false, error: "Produto sem categoria do Mercado Livre definida (fale com a PH)." };
  if (grupo.variantes.length < 2) return { ok: false, error: "Esse produto não tem variações pra agrupar." };

  const shippingRes = resolverShippingML(grupo.transporte_aceito, sellerMetodosEnvio);
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

  const attrVariacao = await atributoVariacaoML(grupo.ml_category_id);
  if (!attrVariacao) {
    return {
      ok: false,
      error: "Essa categoria do Mercado Livre não tem um atributo de variação (ex.: cor) bem definido — fale com a PH.",
    };
  }

  const variations: Record<string, unknown>[] = [];
  for (const v of grupo.variantes) {
    const valor = valorAtributoVariacao(attrVariacao, v.variacao);
    if (!valor) {
      return {
        ok: false,
        error: `Não consegui mapear a variação "${v.variacao}" (produto ${v.sku}) pro Mercado Livre — fale com a PH.`,
      };
    }
    variations.push({
      attribute_combinations: [{ id: attrVariacao.id, ...valor }],
      price: precoRevenda,
      available_quantity: v.estoque_atual,
      seller_custom_field: v.sku,
    });
  }

  // Pool de fotos compartilhado por todas as variações — a API do ML permite
  // atribuir foto específica por variação (picture_ids), mas isso exige um
  // 2º passo (upload de fotos retorna id, só depois dá pra linkar na
  // variação); não implementado ainda, então todas as variações mostram a
  // mesma galeria por enquanto (hoje elas já compartilham as mesmas fotos
  // na prática, então não há perda real).
  const fotos = [...new Set(grupo.variantes.flatMap((v) => v.imagens))];
  const pictures = fotos.map((url) => ({ source: url }));
  const attributes = [...(grupo.marca ? [{ id: "BRAND", value_name: grupo.marca }] : []), ...familyAttrs];
  const nomeCurto = grupo.nome.slice(0, 60);
  const isFamily = familyAttrs.length > 0;

  const body = {
    ...(isFamily ? { family_name: nomeCurto } : { title: nomeCurto }),
    category_id: grupo.ml_category_id,
    currency_id: "BRL",
    buying_mode: "buy_it_now",
    condition: "new",
    listing_type_id: "gold_pro",
    pictures,
    attributes,
    variations,
    shipping: shippingRes.shipping,
  };

  const res = await fetch(`${ML_BASE}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: mlErro(data, "Erro ao publicar no Mercado Livre.") };

  if (grupo.descricao) {
    await fetch(`${ML_BASE}/items/${data.id}/description`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ plain_text: grupo.descricao }),
    }).catch(() => {});
  }

  const variacoesResp = (data.variations ?? []) as { id: number | string; seller_custom_field?: string }[];
  const variationIdPorSku = new Map<string, string>();
  for (const vr of variacoesResp) {
    if (vr.seller_custom_field) variationIdPorSku.set(vr.seller_custom_field, String(vr.id));
  }

  const db = await createDropshippingAdminClient();
  const linhas = grupo.variantes.map((v) => ({
    cliente_id: clienteId,
    produto_id: v.id,
    ml_conta_id: mlContaId,
    ml_item_id: data.id as string,
    ml_variation_id: variationIdPorSku.get(v.sku) ?? null,
    ml_status: (data.status as string) ?? "active",
    ml_permalink: data.permalink as string | null,
    preco_revenda: precoRevenda,
  }));
  const { error } = await db
    .from("seller_ml_anuncios")
    .upsert(linhas, { onConflict: "cliente_id,produto_id,ml_conta_id" });
  if (error) return { ok: false, error: `Anunciado no ML, mas falhou salvar localmente: ${error.message}` };

  return { ok: true, mlItemId: data.id as string, permalink: data.permalink as string };
}

/** Atualiza preço (em todas as variações, que precisam ficar com o mesmo
 *  preço — regra do próprio ML pra esse tipo de anúncio) e/ou status de um
 *  anúncio com variações já publicado. */
export async function atualizarAnuncioMLDropComVariacoes(
  mlContaId: string,
  mlItemId: string,
  patch: { price?: number; status?: "active" | "paused" | "closed"; mlVariationIds: string[] }
): Promise<{ ok: true } | { ok: false; error: string }> {
  let token: string;
  try {
    token = await getValidMlToken(mlContaId);
  } catch {
    return { ok: false, error: "Conecte sua conta do Mercado Livre primeiro." };
  }

  const body: Record<string, unknown> = {};
  if (patch.status) body.status = patch.status;
  if (patch.price != null) {
    body.variations = patch.mlVariationIds.map((id) => ({ id: Number(id), price: patch.price }));
  }

  const res = await fetch(`${ML_BASE}/items/${mlItemId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: mlErro(data, "Erro ao atualizar anúncio no Mercado Livre.") };

  const dbPatch: Record<string, unknown> = {};
  if (patch.price != null) dbPatch.preco_revenda = patch.price;
  if (patch.status) dbPatch.ml_status = (data.status as string) ?? patch.status;
  if (Object.keys(dbPatch).length) {
    const db = await createDropshippingAdminClient();
    await db.from("seller_ml_anuncios").update(dbPatch).eq("ml_conta_id", mlContaId).eq("ml_item_id", mlItemId);
  }
  return { ok: true };
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
