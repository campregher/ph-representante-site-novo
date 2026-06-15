import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getMarcaUser } from "@/lib/marca-auth";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const ML_BASE = "https://api.mercadolibre.com";

interface MLAttr {
  id: string;
  name: string;
  value_type: string;
  tags?: Record<string, unknown>;
  values?: { id: string; name: string }[];
  hint?: string;
}

const BLOCKLIST = new Set(["BRAND", "PART_NUMBER", "HAS_COMPATIBILITIES", "EMPTY_GTIN_REASON"]);

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await getMarcaUser();
  if (!ctx) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  const { id } = await params;

  const db = await createAdminClient();
  const { data: cat, error } = await db
    .from("categorias")
    .select("nome, ml_category_id, ml_category_name")
    .eq("id", id)
    .single();

  if (error || !cat) return NextResponse.json({ error: "Categoria não encontrada" }, { status: 404 });

  /* busca atributos ML */
  let mlAttrs: { id: string; name: string; required: boolean; hint?: string; values?: string[] }[] = [];

  if (cat.ml_category_id) {
    try {
      const res = await fetch(`${ML_BASE}/categories/${cat.ml_category_id}/attributes`, {
        next: { revalidate: 3600 },
      });
      if (res.ok) {
        const raw: MLAttr[] = await res.json();
        mlAttrs = raw
          .filter(a => !BLOCKLIST.has(a.id))
          .filter(a => !a.tags?.hidden && !a.tags?.read_only)
          .map(a => ({
            id:       a.id,
            name:     a.name,
            required: a.tags?.required === true,
            hint:     a.hint,
            values:   a.values?.map(v => v.name),
          }));
      }
    } catch { /* ignora se ML falhar */ }
  }

  /* atributos: obrigatórios primeiro */
  const required = mlAttrs.filter(a => a.required);
  const optional = mlAttrs.filter(a => !a.required);
  const allAttrs = [...required, ...optional];

  /* ── cabeçalhos ── */
  const fixedHeaders = [
    "SKU *",
    "Nome *",
    "Preço de custo (R$)",
    "Preço de revenda (R$) *",
    "Descrição",
    "Imagem 1",
    "Imagem 2",
    "Imagem 3",
    "Imagem 4",
    "Imagem 5",
    "Condição *",
    "Ativo",
  ];

  const attrHeaders = allAttrs.map(a => a.required ? `${a.name} *` : a.name);
  const headers = [...fixedHeaders, ...attrHeaders];

  /* ── linha de dicas ── */
  const hints: string[] = [
    "Ex: TAP-001",
    "Ex: Tapete Automotivo Universal 5 peças",
    "Ex: 89.90 (custo interno)",
    "Ex: 149.90 (preço para o cliente)",
    "Descrição detalhada do produto",
    "URL da imagem principal",
    "URL da imagem 2 (opcional)",
    "URL da imagem 3 (opcional)",
    "URL da imagem 4 (opcional)",
    "URL da imagem 5 (opcional)",
    "Novo  |  Usado",
    "SIM  |  NÃO",
    ...allAttrs.map(a => {
      if (a.values?.length) return a.values.slice(0, 5).join("  |  ");
      return a.hint ?? "";
    }),
  ];

  /* ── linha de exemplo ── */
  const example: string[] = [
    "Ex: SEU-SKU-001",
    `Ex: Tapete ${cat.nome} Universal 5 peças`,
    "89.90",
    "149.90",
    `Ex: Tapete de alta qualidade para ${cat.nome}`,
    "https://sua-url-de-imagem.jpg",
    "",
    "",
    "",
    "",
    "Novo",
    "SIM",
    ...Array(attrHeaders.length).fill(""),
  ];

  /* ── monta planilha única ── */
  const wb = XLSX.utils.book_new();

  /* bloco de instruções no topo (linhas A1:A6) — antes dos dados */
  const instrBlock: (string | undefined)[][] = [
    [`TEMPLATE DE IMPORTAÇÃO — ${cat.nome.toUpperCase()}`, undefined, cat.ml_category_id ? `Categoria ML: ${cat.ml_category_id}` : "Sem categoria ML vinculada"],
    ["Campos marcados com * são OBRIGATÓRIOS.", undefined, "Preço: use ponto como decimal (ex: 149.90)"],
    ["Condição: Novo ou Usado  ·  Ativo: SIM ou NÃO", undefined, "Não altere os cabeçalhos da linha 4."],
    [],
    headers,
    hints,
    example,
  ];

  const ws = XLSX.utils.aoa_to_sheet(instrBlock);

  /* larguras de coluna */
  const colWidths = headers.map((h, i) => ({
    wch: Math.max(h.length, (hints[i] ?? "").length, (example[i] ?? "").length, 18),
  }));
  ws["!cols"] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, "Produtos");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const slug = cat.nome
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-");

  return new NextResponse(buf, {
    headers: {
      "Content-Type":        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="template-${slug}.xlsx"`,
    },
  });
}
