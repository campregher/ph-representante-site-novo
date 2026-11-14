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
  hierarchy?: string;
  value_type: string;
  tags?: { required?: boolean };
  values?: { id: string; name: string }[];
}

async function atributosFamilyObrigatorios(
  categoryId: string
): Promise<{ id: string; value_id: string }[] | { ambiguo: string }> {
  const res = await fetch(`${ML_BASE}/categories/${categoryId}/attributes`);
  if (!res.ok) return [];
  const attrs = (await res.json()) as CategoriaAttr[];
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

/** Atualiza preço e/ou status (pausar/reativar) de um anúncio do catálogo de dropshipping já publicado. */
export async function atualizarAnuncioMLDrop(
  mlContaId: string,
  produtoId: string,
  mlItemId: string,
  patch: { price?: number; status?: "active" | "paused" }
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
