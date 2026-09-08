"use client";

import { useState } from "react";
import { FileDown } from "lucide-react";

export default function ExcelExportButton({
  filename,
  sheetName = "Dados",
  columns,
  rows,
}: {
  filename: string;
  sheetName?: string;
  columns: string[];
  rows: (string | number | null)[][];
}) {
  const [busy, setBusy] = useState(false);

  async function exportar() {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const aoa = [columns, ...rows.map((r) => r.map((c) => (c == null ? "" : c)))];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws["!cols"] = columns.map((_, i) => ({ wch: i < 2 ? 32 : 14 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      const safe = filename.replace(/[^\p{L}\p{N}_.-]+/gu, "_");
      XLSX.writeFile(wb, safe.endsWith(".xlsx") ? safe : `${safe}.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={exportar}
      disabled={busy}
      className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 print:hidden"
    >
      <FileDown size={15} /> {busy ? "Gerando…" : "Exportar Excel"}
    </button>
  );
}
