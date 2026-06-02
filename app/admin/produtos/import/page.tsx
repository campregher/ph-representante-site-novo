"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, Upload, CheckCircle, AlertCircle, Download, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";

const BRAND_SLUGS = ["attis", "ecoflex", "mega", "sofisticar", "tevic", "tiger", "topmix", "vhip"];

function downloadTemplate() {
  const headers = ["SKU", "Nome", "Marca", "Descricao", "Imagem1", "Imagem2", "Imagem3", "Ativo"];
  const examples = [
    ["ATT-001", "Tapete Universal Borracha", "attis", "Tapete antiderrapante para veículos", "https://...", "", "", "TRUE"],
    ["ECO-001", "Capa Chuva Premium", "ecoflex", "", "", "", "", "TRUE"],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);

  // Column widths
  ws["!cols"] = [
    { wch: 14 }, // SKU
    { wch: 36 }, // Nome
    { wch: 14 }, // Marca
    { wch: 36 }, // Descricao
    { wch: 40 }, // Imagem1
    { wch: 40 }, // Imagem2
    { wch: 40 }, // Imagem3
    { wch: 8  }, // Ativo
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "modelo-importacao.xlsx");
}

export default function ImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count?: number; error?: string } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/produtos/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao importar");
      setResult({ count: data.count });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (err) {
      setResult({ error: err instanceof Error ? err.message : "Erro ao importar" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/produtos" className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">Importar Excel</h1>
          <p className="text-xs text-gray-500 mt-0.5">Importe vários produtos de uma planilha .xlsx</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Upload area */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-6 space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${file ? "border-brand/50 bg-brand/5" : "border-white/10 hover:border-white/20"}`}
            onClick={() => inputRef.current?.click()}
          >
            <FileSpreadsheet size={28} className={`mx-auto mb-3 ${file ? "text-brand" : "text-gray-600"}`} />
            {file ? (
              <>
                <p className="text-white font-semibold text-sm">{file.name}</p>
                <p className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm font-medium">Clique para selecionar o arquivo Excel</p>
                <p className="text-gray-600 text-xs mt-1">.xlsx</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
              onChange={(e) => { setFile(e.target.files?.[0] ?? null); setResult(null); }}
            />
          </div>

          {result?.count !== undefined && (
            <div className="flex items-center gap-2 text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm">
              <CheckCircle size={16} /> {result.count} produto{result.count !== 1 ? "s" : ""} importado{result.count !== 1 ? "s" : ""} com sucesso!
            </div>
          )}
          {result?.error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {result.error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={handleUpload} disabled={!file || loading}
              className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40"
            >
              {loading ? "Importando..." : "Importar produtos"}
            </button>
            {result?.count !== undefined && (
              <Link href="/admin/produtos"
                className="px-4 py-2.5 bg-dark-700 border border-white/10 text-gray-300 hover:text-white rounded-xl text-sm transition-all"
              >
                Ver produtos
              </Link>
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Formato da planilha</h2>
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/20 hover:bg-brand/20 rounded-lg transition-colors"
            >
              <Download size={12} /> Baixar modelo .xlsx
            </button>
          </div>

          <p className="text-gray-500 text-xs">A primeira linha da planilha deve conter os cabeçalhos abaixo. Cada linha seguinte é um produto.</p>

          <div className="overflow-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-dark-900">
                  <th className="text-left px-3 py-2 text-gray-400 border border-white/8 font-semibold">Coluna</th>
                  <th className="text-left px-3 py-2 text-gray-400 border border-white/8 font-semibold">Obrigatório</th>
                  <th className="text-left px-3 py-2 text-gray-400 border border-white/8 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["SKU", "Sim", "Código único do produto"],
                  ["Nome", "Sim", "Nome completo do produto"],
                  ["Marca", "Sim", "Slug da marca (ver lista abaixo)"],
                  ["Descricao", "Não", "Descrição opcional"],
                  ["Imagem1", "Não", "URL da imagem principal"],
                  ["Imagem2", "Não", "URL da segunda imagem"],
                  ["Imagem3", "Não", "URL da terceira imagem"],
                  ["Ativo", "Não", "TRUE ou FALSE (padrão: TRUE)"],
                ].map(([col, req, obs]) => (
                  <tr key={col} className="hover:bg-white/3">
                    <td className="px-3 py-2 border border-white/8 font-mono text-brand/80">{col}</td>
                    <td className="px-3 py-2 border border-white/8 text-gray-400">{req}</td>
                    <td className="px-3 py-2 border border-white/8 text-gray-500">{obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-2">Slugs válidos para a coluna <span className="text-brand/80 font-mono">Marca</span>:</p>
            <div className="flex flex-wrap gap-1.5">
              {BRAND_SLUGS.map((s) => (
                <span key={s} className="px-2 py-0.5 bg-dark-900 border border-white/8 rounded-md font-mono text-xs text-gray-400">{s}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
