import { createSistemaAdminClient } from "@/lib/supabase/server";
import { getValidMlToken } from "@/lib/sistema/ml-auth";

/**
 * Publicação de anúncios no Mercado Livre (D5). Adaptado de
 * `app/api/portal/ml/publicar/route.ts` e `app/api/ml/preditor/route.ts`
 * (removidos no commit 63c1fd9) — sem o editor de atributos dinâmicos por
 * categoria do código antigo (nosso catálogo não guarda atributo por
 * atributo, só BRAND/PART_NUMBER via marca/sku do produto). Categorias que
 * exigem mais atributos obrigatórios podem rejeitar a publicação — o erro
 * do ML é repassado pro seller/admin.
 */

const ML_BASE = "https://api.mercadolibre.com";

export interface CategoriaSugestao {
  id: string;
  nome: string;
  caminho: string[];
}

/**
 * Sugere categorias do ML a partir de um texto (nome do produto). Usa
 * `domain_discovery/search` — o antigo `category_predictor/predict` (usado
 * no código de 2026-06 de onde isso foi adaptado) foi descontinuado pelo ML
 * (retorna 404 mesmo com token válido, confirmado em 2026-09-18).
 */
export async function predizerCategoriaML(q: string, token: string): Promise<CategoriaSugestao[]> {
  if (!q.trim()) return [];
  const res = await fetch(`${ML_BASE}/sites/MLB/domain_discovery/search?q=${encodeURIComponent(q)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { category_id: string; category_name: string; domain_name: string }[];
  return data.map((d) => ({ id: d.category_id, nome: d.category_name, caminho: [d.domain_name] }));
}

export interface AnuncioProduto {
  id: string;
  sku: string;
  nome: string;
  descricao: string | null;
  marca: string | null;
  imagem_url: string | null;
  ml_category_id: string | null;
}

type MlResult<T> = ({ ok: true } & T) | { ok: false; error: string };

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

/**
 * Categorias de autopeças no ML usam o modelo "family" (atributos com
 * hierarchy=FAMILY, ex. VEHICLE_TYPE) — descoberto testando em produção
 * (2026-09-18): sem isso o ML rejeita com "body does not contains
 * [family_name]", e com family_name o corpo muda (sem `title`, com
 * `family_name` + os atributos FAMILY obrigatórios). Resolve automático só
 * quando o atributo tem 1 único valor possível (caso comum, ex. "Tipo de
 * veículo" = "Carro/Caminhonete"); com mais de 1 opção não dá pra adivinhar.
 */
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
 * Publica um produto como anúncio novo no ML e grava o vínculo em
 * seller_ml_anuncios. `mlContaId` é o id de `cliente_ml_tokens` — o seller
 * pode ter várias contas conectadas, e o mesmo produto pode estar anunciado
 * em mais de uma ao mesmo tempo (cada uma vira uma linha própria).
 */
export async function publicarAnuncioML(
  clienteId: string,
  mlContaId: string,
  produto: AnuncioProduto,
  precoRevenda: number
): Promise<MlResult<{ mlItemId: string; permalink: string }>> {
  if (!produto.ml_category_id)
    return { ok: false, error: "Produto sem categoria do Mercado Livre definida (fale com a PH)." };

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

  const pictures = produto.imagem_url ? [{ source: produto.imagem_url }] : [];
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

  const db = await createSistemaAdminClient();
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

/** Atualiza preço e/ou status (pausar/reativar) de um anúncio já publicado numa conta específica. */
export async function atualizarAnuncioML(
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
    const db = await createSistemaAdminClient();
    await db
      .from("seller_ml_anuncios")
      .update(dbPatch)
      .eq("ml_conta_id", mlContaId)
      .eq("produto_id", produtoId);
  }
  return { ok: true };
}

/**
 * D8 — pausa automaticamente todo anúncio ativo de um produto que zerou o
 * estoque (não dá pra vender o que não existe mais). Chamado depois de
 * qualquer baixa de estoque da linha própria (venda ML, confirmação de
 * pedido drop manual, ajuste). Um mesmo produto pode estar anunciado por
 * mais de um seller — pausa o anúncio de todos.
 */
export async function pausarAnunciosPorEstoqueZerado(produtoId: string): Promise<void> {
  const db = await createSistemaAdminClient();
  const { data: produto } = await db
    .from("produtos")
    .select("estoque_atual")
    .eq("id", produtoId)
    .maybeSingle();
  if (!produto || Number(produto.estoque_atual) > 0) return;

  const { data: anuncios } = await db
    .from("seller_ml_anuncios")
    .select("cliente_id, ml_conta_id, ml_item_id")
    .eq("produto_id", produtoId)
    .eq("ml_status", "active");
  for (const a of anuncios ?? []) {
    const res = await atualizarAnuncioML(a.ml_conta_id as string, produtoId, a.ml_item_id as string, {
      status: "paused",
    });
    if (!res.ok) console.error("[pausarAnunciosPorEstoqueZerado]", a.cliente_id, res.error);
  }
}
