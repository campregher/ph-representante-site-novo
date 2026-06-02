import { NextResponse } from "next/server";
import { verifyToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { sheetsRead, env } from "@/lib/google-sheets";

export const runtime = "nodejs";

// Rota one-shot: migra produtos do Google Sheets para Supabase.
// Chame uma única vez via GET /api/admin/migrate-produtos no painel admin.
// Após a migração bem-sucedida, esta rota pode ser removida.

function parseDateSafe(raw: string | undefined): string {
  if (!raw) return new Date().toISOString();
  // Tenta parsear formato BR: "DD/MM/YYYY HH:MM" ou "DD/MM/YYYY, HH:MM"
  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})[,\s]+(\d{2}):(\d{2})/);
  if (brMatch) {
    const [, d, m, y, h, min] = brMatch;
    const iso = new Date(`${y}-${m}-${d}T${h}:${min}:00`);
    if (!isNaN(iso.getTime())) return iso.toISOString();
  }
  const parsed = new Date(raw);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function rowToInsert(row: string[]) {
  const images = [row[6], row[7], row[8]].filter(Boolean);
  const price  = row[5] ? parseFloat(row[5].replace(",", ".")) : null;
  return {
    id:          row[0] || undefined,
    sku:         row[1] ?? "",
    name:        row[2] ?? "",
    brand:       row[3] ?? "",
    description: row[4] ?? "",
    price:       isNaN(price as number) ? null : price,
    images,
    active:      (row[9] ?? "").toUpperCase() === "TRUE",
    created_at:  parseDateSafe(row[10]),
  };
}

export async function GET() {
  const jar   = await cookies();
  const token = jar.get(ADMIN_COOKIE)?.value;
  const ok    = token ? await verifyToken(token) : false;
  if (!ok) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

  try {
    const spreadsheetId = env("GOOGLE_SHEETS_SPREADSHEET_ID");
    const sheet         = process.env.PRODUTOS_SHEET_NAME || "Produtos";

    const rows = await sheetsRead(spreadsheetId, `${sheet}!A2:K`);
    const valid = rows.filter(r => r[0] && r[1] && r[2] && r[3]);

    if (!valid.length) {
      return NextResponse.json({ ok: true, migrated: 0, message: "Nenhum produto encontrado no Sheets." });
    }

    const allRows = valid.map(rowToInsert);

    // Deduplica por (brand, sku) mantendo a última ocorrência
    const seen = new Map<string, typeof allRows[0]>();
    for (const r of allRows) seen.set(`${r.brand}::${r.sku}`, r);
    const inserts = Array.from(seen.values());

    const db = await createAdminClient();

    // Insere em lotes de 100 para evitar payload excessivo
    let migrated = 0;
    const erros: string[] = [];

    for (let i = 0; i < inserts.length; i += 100) {
      const batch = inserts.slice(i, i + 100);
      const { error } = await db
        .from("produtos")
        .upsert(batch, { onConflict: "brand,sku", ignoreDuplicates: false });

      if (error) {
        erros.push(`Lote ${i}-${i + batch.length}: ${error.message}`);
      } else {
        migrated += batch.length;
      }
    }

    return NextResponse.json({
      ok:       erros.length === 0,
      migrated,
      total:    inserts.length,
      erros:    erros.length ? erros : undefined,
      message:  `${migrated} de ${inserts.length} produtos migrados para o Supabase.`,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
