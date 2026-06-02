"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, Upload, CheckCircle, AlertCircle, Download, FileSpreadsheet, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

const COLUMNS = [
  { col: "SKU",       req: "Sim", obs: "Código único do produto" },
  { col: "Nome",      req: "Sim", obs: "Nome completo do produto" },
  { col: "Descricao", req: "Não", obs: "Descrição opcional" },
  { col: "Preco",     req: "Não", obs: "Valor numérico (ex: 29.90)" },
  { col: "Imagem1",   req: "Não", obs: "URL da imagem principal" },
  { col: "Imagem2",   req: "Não", obs: "URL da segunda imagem" },
  { col: "Imagem3",   req: "Não", obs: "URL da terceira imagem" },
  { col: "Ativo",     req: "Não", obs: "TRUE ou FALSE (padrão: TRUE)" },
];

function downloadTemplate() {
  const headers = ["SKU", "Nome", "Descricao", "Preco", "Imagem1", "Imagem2", "Imagem3", "Ativo"];
  const examples = [
    ["001", "Produto Exemplo A", "Descrição do produto A", "29.90", "https://...", "", "", "TRUE"],
    ["002", "Produto Exemplo B", "",                        "59.00", "",           "", "", "TRUE"],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...examples]);
  ws["!cols"] = [
    { wch: 14 }, // SKU
    { wch: 36 }, // Nome
    { wch: 36 }, // Descricao
    { wch: 10 }, // Preco
    { wch: 40 }, // Imagem1
    { wch: 40 }, // Imagem2
    { wch: 40 }, // Imagem3
    { wch: 8  }, // Ativo
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Produtos");
  XLSX.writeFile(wb, "modelo-importacao-produtos.xlsx");
}

export default function ImportProdutosPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file,    setFile]    = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result,  setResult]  = useState<{ count?: number; error?: string } | null>(null);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/marca/produtos/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao importar");
      setResult({ count: data.count });
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Erro ao importar" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/marca/produtos"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft size={15} />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-white">Importar produtos via planilha</h1>
            <p className="text-[11px] text-gray-500 mt-0.5">Importe vários produtos de uma vez com arquivo .xlsx</p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Upload */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-6 space-y-4">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Arquivo Excel</p>

          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              file ? "border-brand/50 bg-brand/5" : "border-white/10 hover:border-white/25 hover:bg-white/2"
            }`}
            onClick={() => inputRef.current?.click()}
          >
            <FileSpreadsheet size={30} className={`mx-auto mb-3 ${file ? "text-brand" : "text-gray-600"}`} />
            {file ? (
              <>
                <p className="text-white font-semibold text-sm">{file.name}</p>
                <p className="text-gray-500 text-xs mt-1">{(file.size / 1024).toFixed(1)} KB · clique para trocar</p>
              </>
            ) : (
              <>
                <p className="text-gray-400 text-sm font-medium">Clique para selecionar o arquivo Excel</p>
                <p className="text-gray-600 text-xs mt-1">Apenas .xlsx</p>
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
            <div className="flex items-center gap-2 text-green-400 bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm font-semibold">
              <CheckCircle size={16} />
              {result.count} produto{result.count !== 1 ? "s" : ""} importado{result.count !== 1 ? "s" : ""} com sucesso!
            </div>
          )}
          {result?.error && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} /> {result.error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-40"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {loading ? "Importando..." : "Importar produtos"}
            </button>
            {result?.count !== undefined && (
              <Link href="/marca/produtos"
                className="px-4 py-2.5 bg-dark-700 border border-white/10 text-gray-300 hover:text-white rounded-xl text-sm transition-all"
              >
                Ver produtos
              </Link>
            )}
          </div>
        </div>

        {/* Instruções */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Formato da planilha</p>
            <button onClick={downloadTemplate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand bg-brand/10 border border-brand/20 hover:bg-brand/20 rounded-lg transition-colors"
            >
              <Download size={12} /> Baixar modelo .xlsx
            </button>
          </div>

          <p className="text-gray-500 text-xs">
            A primeira linha da planilha deve conter os cabeçalhos abaixo. Cada linha seguinte representa um produto.
            A marca é preenchida automaticamente com a sua conta.
          </p>

          <div className="overflow-auto rounded-xl border border-white/8">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-dark-900 border-b border-white/8">
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Coluna</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Obrigatório</th>
                  <th className="text-left px-3 py-2.5 text-gray-400 font-semibold">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {COLUMNS.map(({ col, req, obs }) => (
                  <tr key={col} className="hover:bg-white/3 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-brand/80">{col}</td>
                    <td className={`px-3 py-2.5 font-semibold ${req === "Sim" ? "text-white" : "text-gray-600"}`}>{req}</td>
                    <td className="px-3 py-2.5 text-gray-500">{obs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-brand/5 border border-brand/15 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-400">
              <span className="font-bold text-brand">Dica:</span> Baixe o modelo acima, preencha os dados no Excel e faça o upload. Produtos duplicados (mesmo SKU) serão adicionados normalmente — verifique os SKUs antes de importar.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
