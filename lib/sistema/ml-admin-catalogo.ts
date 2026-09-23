import { getValidAdminMlToken, getAdminMlRecord } from "@/lib/sistema/ml-admin-auth";

const ML_BASE = "https://api.mercadolibre.com";

export interface MlAnuncioEmpresa {
  mlItemId: string;
  titulo: string;
  preco: number;
  imagemUrl: string | null;
  categoryId: string;
  categoryNome: string;
  marca: string | null;
  quantidadeDisponivel: number;
  permalink: string;
  status: string;
  listingTypeId: string;
  logisticType: string | null;
  vendidos: number;
  ean: string | null;
  pesoKg: number | null;
  alturaCm: number | null;
  larguraCm: number | null;
  comprimentoCm: number | null;
}

interface MlItemBody {
  id: string;
  title: string;
  price: number;
  thumbnail?: string;
  pictures?: { url: string }[];
  category_id: string;
  available_quantity?: number;
  sold_quantity?: number;
  permalink: string;
  status: string;
  listing_type_id: string;
  shipping?: { logistic_type?: string; dimensions?: string | null };
  attributes?: { id: string; value_name: string | null }[];
}

/** "dimensions" do ML vem como "COMPxLARGxALT,PESO_GRAMAS" (cm e gramas). */
function parseDimensoesML(
  dimensions: string | null | undefined
): { pesoKg: number | null; alturaCm: number | null; larguraCm: number | null; comprimentoCm: number | null } {
  const m = dimensions?.match(/^(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)$/);
  if (!m) return { pesoKg: null, alturaCm: null, larguraCm: null, comprimentoCm: null };
  const [, comprimento, largura, altura, pesoGramas] = m;
  return {
    comprimentoCm: Number(comprimento),
    larguraCm: Number(largura),
    alturaCm: Number(altura),
    pesoKg: Math.round((Number(pesoGramas) / 1000) * 1000) / 1000,
  };
}

/** status considerados aqui — fora "closed"/"inactive" (anúncio encerrado/expirado, não importável). */
const STATUS_BUSCADOS = ["active", "paused"];

/**
 * Lista os anúncios (ativos e pausados) da conta do Mercado Livre da empresa
 * (admin_ml_token). Pagina via items/search (até 1000 por status, limite da
 * API) e busca detalhes em lotes de 20 via multiget — o jeito mais econômico
 * de trazer título/preço/foto/categoria/envio/tipo sem 1 chamada por anúncio.
 */
export async function listarAnunciosEmpresaML(): Promise<MlAnuncioEmpresa[]> {
  const record = await getAdminMlRecord();
  if (!record) return [];
  const token = await getValidAdminMlToken();

  const ids: string[] = [];
  for (const status of STATUS_BUSCADOS) {
    const limit = 100;
    let offset = 0;
    for (;;) {
      const res = await fetch(
        `${ML_BASE}/users/${record.ml_user_id}/items/search?status=${status}&limit=${limit}&offset=${offset}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) break;
      const data = (await res.json()) as { results?: string[] };
      const results = data.results ?? [];
      ids.push(...results);
      offset += limit;
      if (results.length < limit || offset >= 1000) break;
    }
  }
  if (ids.length === 0) return [];

  const itensBrutos: MlItemBody[] = [];
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const res = await fetch(`${ML_BASE}/items?ids=${chunk.join(",")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) continue;
    const arr = (await res.json()) as { code: number; body: MlItemBody }[];
    for (const entry of arr) {
      if (entry.code === 200) itensBrutos.push(entry.body);
    }
  }

  const categoriaIds = [...new Set(itensBrutos.map((b) => b.category_id))];
  const nomesPorCategoria = new Map<string, string>();
  await Promise.all(
    categoriaIds.map(async (id) => {
      const res = await fetch(`${ML_BASE}/categories/${id}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.name) nomesPorCategoria.set(id, data.name as string);
    })
  );

  return itensBrutos.map((b) => ({
    mlItemId: b.id,
    titulo: b.title,
    preco: b.price,
    imagemUrl: b.thumbnail ?? b.pictures?.[0]?.url ?? null,
    categoryId: b.category_id,
    categoryNome: nomesPorCategoria.get(b.category_id) ?? b.category_id,
    marca: b.attributes?.find((a) => a.id === "BRAND")?.value_name ?? null,
    quantidadeDisponivel: b.available_quantity ?? 0,
    permalink: b.permalink,
    status: b.status,
    listingTypeId: b.listing_type_id,
    logisticType: b.shipping?.logistic_type ?? null,
    vendidos: b.sold_quantity ?? 0,
    ean: b.attributes?.find((a) => a.id === "GTIN")?.value_name ?? null,
    ...parseDimensoesML(b.shipping?.dimensions),
  }));
}

/** Descrição em texto puro do anúncio — endpoint separado no ML, só vale a pena buscar no momento de importar (não pra lista inteira). */
export async function buscarDescricaoAnuncioML(mlItemId: string): Promise<string | null> {
  const token = await getValidAdminMlToken();
  const res = await fetch(`${ML_BASE}/items/${mlItemId}/description`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return (data.plain_text as string) || null;
}
