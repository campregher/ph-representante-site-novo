import { createAdminClient } from "@/lib/supabase/server";

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  price?: number;
  images: string[];
  active: boolean;
  createdAt: string;
}

type DbRow = Record<string, unknown>;

function rowToProduct(row: DbRow): Product {
  return {
    id:          row.id as string,
    sku:         row.sku as string,
    name:        row.name as string,
    brand:       row.brand as string,
    description: (row.description as string) ?? "",
    price:       row.price != null ? Number(row.price) : undefined,
    images:      (row.images as string[]) ?? [],
    active:      row.active as boolean,
    createdAt:   row.created_at as string,
  };
}

export async function getProducts(filters?: {
  brand?: string;
  q?: string;
  activeOnly?: boolean;
}): Promise<Product[]> {
  const db = await createAdminClient();

  let query = db.from("produtos").select("*").order("name", { ascending: true });

  if (filters?.brand)      query = query.eq("brand", filters.brand);
  if (filters?.activeOnly) query = query.eq("active", true);
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
      sku:         data.sku.trim(),
      name:        data.name.trim(),
      brand:       data.brand,
      description: data.description?.trim() ?? "",
      price:       data.price != null ? Number(data.price) : null,
      images:      data.images ?? [],
      active:      data.active !== false,
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
  if (data.price       !== undefined) patch.price       = data.price != null ? Number(data.price) : null;
  if (data.images      !== undefined) patch.images      = data.images;
  if (data.active      !== undefined) patch.active      = data.active;

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
  const { error } = await db.from("produtos").insert(
    rows.map(r => ({
      sku:         r.sku.trim(),
      name:        r.name.trim(),
      brand:       r.brand,
      description: r.description?.trim() ?? "",
      price:       r.price != null ? Number(r.price) : null,
      images:      r.images ?? [],
      active:      r.active !== false,
    }))
  );
  if (error) throw new Error(error.message);
  return rows.length;
}
