import { createAdminClient } from "@/lib/supabase/server";

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  price?: number;         // preço de custo
  resale_price?: number;  // preço de revenda
  images: string[];
  active: boolean;
  createdAt: string;
  ml_category_id?: string;
  ml_category_name?: string;
  ml_category_path?: string[];
  attributes?: Record<string, string>;
  compatibilidades?: Compatibilidade[];
  ml_item_id?: string;
  ml_status?: string;
  ml_error?: unknown;
  ml_published_at?: string;
}

export interface Compatibilidade {
  marcaCodigo: string;
  marcaNome: string;
  modeloCodigo: string;
  modeloNome: string;
  anoCodigo: string;
  anoNome: string;
}

type DbRow = Record<string, unknown>;

function rowToProduct(row: DbRow): Product {
  return {
    id:                 row.id as string,
    sku:                row.sku as string,
    name:               row.name as string,
    brand:              row.brand as string,
    description:        (row.description as string) ?? "",
    price:              row.price        != null ? Number(row.price)        : undefined,
    resale_price:       row.resale_price != null ? Number(row.resale_price) : undefined,
    images:             (row.images as string[]) ?? [],
    active:             row.active as boolean,
    createdAt:          row.created_at as string,
    ml_category_id:     (row.ml_category_id as string) ?? undefined,
    ml_category_name:   (row.ml_category_name as string) ?? undefined,
    ml_category_path:   (row.ml_category_path as string[]) ?? undefined,
    attributes:         (row.attributes as Record<string, string>) ?? {},
    compatibilidades:   (row.compatibilidades as Compatibilidade[]) ?? [],
    ml_item_id:         (row.ml_item_id as string)    ?? undefined,
    ml_status:          (row.ml_status as string)     ?? undefined,
    ml_error:           row.ml_error                  ?? undefined,
    ml_published_at:    (row.ml_published_at as string) ?? undefined,
  };
}

export async function getProducts(filters?: {
  brand?: string;
  q?: string;
  activeOnly?: boolean;
  ml_category_id?: string;
}): Promise<Product[]> {
  const db = await createAdminClient();

  let query = db.from("produtos").select("*").order("name", { ascending: true });

  if (filters?.brand)           query = query.eq("brand", filters.brand);
  if (filters?.activeOnly)      query = query.eq("active", true);
  if (filters?.ml_category_id)  query = query.eq("ml_category_id", filters.ml_category_id);
  if (filters?.q) {
    const q = filters.q.replace(/[%_]/g, "\\$&");
    query = query.or(`name.ilike.%${q}%,sku.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToProduct);
}

export async function getProductById(id: string): Promise<Product | null> {
  const db = await createAdminClient();
  const { data, error } = await db.from("produtos").select("*").eq("id", id).single();
  if (error || !data) return null;
  return rowToProduct(data as DbRow);
}

export async function createProduct(
  data: Omit<Product, "id" | "createdAt">
): Promise<Product> {
  const db = await createAdminClient();
  const { data: row, error } = await db
    .from("produtos")
    .insert({
      sku:               data.sku.trim(),
      name:              data.name.trim(),
      brand:             data.brand,
      description:       data.description?.trim() ?? "",
      price:             data.price        != null ? Number(data.price)        : null,
      resale_price:      data.resale_price  != null ? Number(data.resale_price) : null,
      images:            data.images ?? [],
      active:            data.active !== false,
      ml_category_id:    data.ml_category_id ?? null,
      ml_category_name:  data.ml_category_name ?? null,
      ml_category_path:  data.ml_category_path ?? null,
      attributes:        data.attributes ?? {},
      compatibilidades:  data.compatibilidades ?? [],
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToProduct(row as DbRow);
}

export async function updateProduct(
  productId: string,
  data: Partial<Omit<Product, "id" | "createdAt">>
): Promise<Product> {
  const db = await createAdminClient();

  const patch: Record<string, unknown> = {};
  if (data.sku         !== undefined) patch.sku         = data.sku.trim();
  if (data.name        !== undefined) patch.name        = data.name.trim();
  if (data.brand       !== undefined) patch.brand       = data.brand;
  if (data.description !== undefined) patch.description = data.description.trim();
  if (data.price        !== undefined) patch.price        = data.price        != null ? Number(data.price)        : null;
  if (data.resale_price !== undefined) patch.resale_price = data.resale_price != null ? Number(data.resale_price) : null;
  if (data.images            !== undefined) patch.images            = data.images;
  if (data.active            !== undefined) patch.active            = data.active;
  if (data.ml_category_id   !== undefined) patch.ml_category_id   = data.ml_category_id;
  if (data.ml_category_name !== undefined) patch.ml_category_name = data.ml_category_name;
  if (data.ml_category_path !== undefined) patch.ml_category_path = data.ml_category_path;
  if (data.attributes        !== undefined) patch.attributes        = data.attributes;
  if (data.compatibilidades  !== undefined) patch.compatibilidades  = data.compatibilidades;

  const { data: row, error } = await db
    .from("produtos")
    .update(patch)
    .eq("id", productId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (!row) throw new Error("Produto não encontrado");
  return rowToProduct(row as DbRow);
}

export async function deleteProduct(productId: string): Promise<void> {
  const db = await createAdminClient();
  const { error } = await db.from("produtos").delete().eq("id", productId);
  if (error) throw new Error(error.message);
}

export async function importProducts(
  rows: Omit<Product, "id" | "createdAt">[]
): Promise<number> {
  const db = await createAdminClient();

  const safeNum = (v: number | undefined): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return isNaN(n) ? null : n;
  };

  /* remove SKUs duplicados dentro do próprio lote — mantém a última ocorrência */
  const deduped = [...new Map(rows.map(r => [`${r.sku.trim()}|${r.brand}`, r])).values()];

  const { error } = await db.from("produtos").upsert(
    deduped.map(r => ({
      sku:              r.sku.trim(),
      name:             r.name.trim(),
      brand:            r.brand,
      description:      r.description?.trim() ?? "",
      price:            safeNum(r.price),
      resale_price:     safeNum(r.resale_price),
      images:           r.images ?? [],
      active:           r.active !== false,
      ml_category_id:   r.ml_category_id   ?? null,
      ml_category_name: r.ml_category_name ?? null,
      ml_category_path: r.ml_category_path ?? null,
      attributes:       r.attributes       ?? {},
      compatibilidades: r.compatibilidades  ?? [],
    })),
    { onConflict: "sku,brand" }
  );
  if (error) throw new Error(error.message);
  return deduped.length;
}
