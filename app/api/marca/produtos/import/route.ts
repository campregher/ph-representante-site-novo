import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getMarcaUser } from "@/lib/marca-auth";
import { importProducts } from "@/lib/produtos";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";
const BLOCKLIST = new Set(["BRAND", "PART_NUMBER", "HAS_COMPATIBILITIES", "EMPTY_GTIN_REASON"]);

/* colunas fixas que NÃO devem ser mapeadas para atributos ML */
const FIXED_COLS = new Set([
  "sku", "sku *", "nome", "name", "nome *",
  "descricao", "description",
  "preco", "price", "preco de custo (r$)", "preco de custo",
  "preco de revenda (r$) *", "preco de revenda (r$)", "preco de revenda *", "preco de revenda", "resale_price",
  "estoque", "stock", "quantity",
  "imagem1", "imagem 1", "image1",
  "imagem2", "imagem 2", "image2",
  "imagem3", "imagem 3", "image3",
  "imagem4", "imagem 4", "image4",
  "imagem5", "imagem 5", "image5",
  "condicao", "condicao *", "condition",
  "ativo", "active",
]);

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ \*$/, "").trim();

const col = (row: Record<string, string>, ...aliases: string[]): string => {
  for (const key of Object.keys(row)) {
    if (aliases.includes(normalize(key))) return String(row[key] ?? "").trim();
  }
  return "";
};

export async function POST(request: Request) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const formData   = await request.formData();
  const file       = formData.get("file") as File | null;
  const categoriaId = formData.get("categoria_id") as string | null;

  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  /* busca ml_category_id e atributos ML se vier categoria */
  let mlCategoryId:   string | undefined;
  let mlCategoryName: string | undefined;
  let mlCategoryPath: string[] | undefined;
  let mlAttrMap: Record<string, string> = {};  /* { normalizedName → attrId } */

  if (categoriaId) {
    const db = await createAdminClient();
    const { data: cat } = await db
      .from("categorias")
      .select("ml_category_id, ml_category_name, ml_category_path")
      .eq("id", categoriaId)
      .single();

    if (cat?.ml_category_id) {
      mlCategoryId   = cat.ml_category_id;
      mlCategoryName = cat.ml_category_name ?? undefined;
      mlCategoryPath = cat.ml_category_path ?? undefined;

      try {
        const res = await fetch(`${ML_BASE}/categories/${cat.ml_category_id}/attributes`, {
          next: { revalidate: 3600 },
        });
        if (res.ok) {
          const attrs: { id: string; name: string; tags?: Record<string, unknown> }[] = await res.json();
          for (const a of attrs) {
            if (BLOCKLIST.has(a.id)) continue;
            if (a.tags?.hidden || a.tags?.read_only) continue;
            mlAttrMap[normalize(a.name)] = a.id;
          }
        }
      } catch { /* ignora */ }
    }
  }

  /* lê planilha — detecta automaticamente a linha de cabeçalho (ignora títulos) */
  const buffer   = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows  = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" });

  /* procura nas primeiras 10 linhas aquela que contém "sku", "nome" ou "name" */
  const HEADER_MARKERS = new Set(["sku", "nome", "name", "codigo", "cod", "produto", "title", "titulo"]);
  let headerIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const cells = rawRows[i].map(c => normalize(String(c)));
    if (cells.some(c => HEADER_MARKERS.has(c))) { headerIdx = i; break; }
  }

  const headerCells = rawRows[headerIdx].map(c => String(c));
  const rows: Record<string, string>[] = rawRows.slice(headerIdx + 1).map(rawRow => {
    const obj: Record<string, string> = {};
    headerCells.forEach((h, i) => { obj[h] = String((rawRow as string[])[i] ?? "").trim(); });
    return obj;
  });

  const allCols = headerCells.map(k => `"${k}"`).join(", ");
  console.log(`[import] headerIdx=${headerIdx}, total rows: ${rows.length}, cols:`, allCols);

  /* remove linhas sem SKU nem Nome (dicas, instruções e exemplos sem dados reais) */
  const dataRows = rows.filter(r => {
    const sku  = col(r, "sku", "sku *", "codigo", "cod", "ref", "referencia", "code");
    const name = col(r, "nome", "name", "nome *", "produto", "descricao", "description", "nome do produto", "titulo", "title");
    /* descarta linhas de exemplo/dica geradas pelo template */
    if (sku.startsWith("Ex:") || name.startsWith("Ex:")) return false;
    if (["Produto Exemplo A", "Produto Exemplo B"].includes(name)) return false;
    return sku || name;
  });

  if (dataRows.length === 0)
    return NextResponse.json({
      error: `Nenhum produto válido encontrado na planilha. Colunas encontradas: ${allCols}. Verifique se as colunas 'SKU' e 'Nome' estão preenchidas e se está usando o modelo correto.`,
    }, { status: 400 });

  const products = dataRows.map(r => {
    /* atributos ML: colunas não-fixas que batem com um atributo da categoria */
    const attributes: Record<string, string> = {};
    if (Object.keys(mlAttrMap).length > 0) {
      for (const key of Object.keys(r)) {
        const nKey = normalize(key);
        if (FIXED_COLS.has(nKey)) continue;
        const attrId = mlAttrMap[nKey];
        if (attrId && r[key]) {
          attributes[attrId] = String(r[key]).trim();
        }
      }
    }

    const rawAtivo = col(r, "ativo", "active").toUpperCase();
    const active   = rawAtivo !== "NÃO" && rawAtivo !== "NAO" && rawAtivo !== "FALSE" && rawAtivo !== "0";

    return {
      sku:  col(r, "sku", "sku *", "codigo", "cod", "ref", "referencia", "code")
              || `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: col(r, "nome", "name", "nome *", "produto", "nome do produto", "titulo", "title"),
      brand:        ctx.marcaSlug,
      description:  col(r, "descricao", "description", "descricao do produto"),
      price: (() => {
        const v = col(r, "preco", "price", "preco de custo (r$)", "preco de custo", "custo", "custo (r$)");
        return v ? Number(v.replace(",", ".")) : undefined;
      })(),
      resale_price: (() => {
        const v = col(r, "preco de revenda (r$) *", "preco de revenda (r$)", "preco de revenda *", "preco de revenda", "resale_price", "revenda", "preco venda", "valor venda");
        return v ? Number(v.replace(",", ".")) : undefined;
      })(),
      images: [
        col(r, "imagem1", "imagem 1", "image1", "foto1", "foto 1"),
        col(r, "imagem2", "imagem 2", "image2", "foto2", "foto 2"),
        col(r, "imagem3", "imagem 3", "image3", "foto3", "foto 3"),
        col(r, "imagem4", "imagem 4", "image4", "foto4", "foto 4"),
        col(r, "imagem5", "imagem 5", "image5", "foto5", "foto 5"),
      ].filter(Boolean),
      active,
      ml_category_id:   mlCategoryId,
      ml_category_name: mlCategoryName,
      ml_category_path: mlCategoryPath,
      attributes,
      compatibilidades: [],
    };
  }).filter(p => p.name);

  if (products.length === 0) {
    const sample = dataRows[0] ?? {};
    const foundCols = Object.keys(sample).map(k => `"${k}"`).join(", ");
    return NextResponse.json({
      error: `Nenhum produto com Nome preenchido. Colunas encontradas: ${foundCols || "(nenhuma)"}. O cabeçalho da coluna de nome deve ser "Nome".`,
    }, { status: 400 });
  }

  try {
    const count = await importProducts(products);
    return NextResponse.json({ ok: true, count });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[import-products]", msg);
    return NextResponse.json({ error: `Erro ao salvar produtos: ${msg}` }, { status: 500 });
  }
}
