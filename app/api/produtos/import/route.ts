import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { importProducts } from "@/lib/produtos";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { brands } from "@/lib/brands";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    if (!(await verifyToken(cookieStore.get(ADMIN_COOKIE)?.value ?? ""))) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Planilha vazia ou sem dados" }, { status: 400 });
    }

    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

    const col = (row: Record<string, string>, ...aliases: string[]): string => {
      for (const key of Object.keys(row)) {
        if (aliases.includes(normalize(key))) return String(row[key] ?? "").trim();
      }
      return "";
    };

    // Map from any variation → canonical slug
    const brandMap: Record<string, string> = {};
    for (const b of brands) {
      brandMap[b.slug] = b.slug;
      brandMap[b.name.toLowerCase()] = b.slug;
      brandMap[normalize(b.name)] = b.slug;
    }

    function resolveBrand(raw: string): string {
      const key = normalize(raw);
      return brandMap[key] ?? brandMap[raw.toLowerCase()] ?? (Object.values(brandMap).includes(raw) ? raw : "");
    }

    const products = rows
      .filter((r) => col(r, "sku") || col(r, "nome", "name"))
      .map((r) => {
        const brandVal = col(r, "marca", "brand");
        return {
          sku: col(r, "sku"),
          name: col(r, "nome", "name"),
          brand: resolveBrand(brandVal),
          description: col(r, "descricao", "description"),
          images: [
            col(r, "imagem1", "imagem 1", "image1"),
            col(r, "imagem2", "imagem 2", "image2"),
            col(r, "imagem3", "imagem 3", "image3"),
            col(r, "imagem4", "imagem 4", "image4"),
            col(r, "imagem5", "imagem 5", "image5"),
          ].filter(Boolean),
          active: col(r, "ativo", "active").toUpperCase() !== "FALSE",
        };
      });

    if (products.length === 0) {
      return NextResponse.json({ error: "Nenhum produto válido encontrado" }, { status: 400 });
    }

    const count = await importProducts(products);
    return NextResponse.json({ ok: true, count });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
