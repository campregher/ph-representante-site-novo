import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getSistemaProfile, canManage } from "@/lib/sistema/auth";

export const runtime = "nodejs";

const MAX_ROWS = 5000;
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function POST(request: Request) {
  const profile = await getSistemaProfile();
  if (!profile) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!canManage(profile.role))
    return NextResponse.json({ error: "Sem permissão." }, { status: 403 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Envie um arquivo .xlsx, .xls ou .csv." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Arquivo muito grande (máx. 8 MB)." }, { status: 400 });
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return NextResponse.json({ error: "Planilha vazia." }, { status: 400 });

    const matrix = XLSX.utils.sheet_to_json<(string | number)[]>(sheet, {
      header: 1,
      blankrows: false,
      defval: "",
    });
    if (matrix.length < 2) {
      return NextResponse.json({ error: "A planilha precisa de um cabeçalho e ao menos uma linha." }, { status: 400 });
    }

    const header = (matrix[0] as unknown[]).map((c, i) => {
      const name = String(c ?? "").trim();
      return name || `Coluna ${i + 1}`;
    });

    const rows: Record<string, string | number>[] = [];
    for (let i = 1; i < matrix.length && rows.length < MAX_ROWS; i++) {
      const arr = matrix[i] as unknown[];
      if (!arr || arr.every((c) => String(c ?? "").trim() === "")) continue;
      const obj: Record<string, string | number> = {};
      header.forEach((h, idx) => {
        const val = arr[idx];
        obj[h] = typeof val === "number" ? val : String(val ?? "").trim();
      });
      rows.push(obj);
    }

    return NextResponse.json({
      sheetName,
      columns: header,
      rows,
      total: rows.length,
      truncated: matrix.length - 1 > MAX_ROWS,
    });
  } catch {
    return NextResponse.json({ error: "Não foi possível ler o arquivo." }, { status: 400 });
  }
}
