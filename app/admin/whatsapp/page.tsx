"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import { Upload, Send, CheckCircle, XCircle, Loader2, MessageSquare, Users, FileSpreadsheet, X } from "lucide-react";

interface Contato { telefone: string; nome: string; [k: string]: string }
interface Resultado { telefone: string; nome: string; status: "ok" | "erro"; motivo?: string }

export default function WhatsAppDisparoPage() {
  const [contatos,   setContatos]   = useState<Contato[]>([]);
  const [mensagem,   setMensagem]   = useState("");
  const [enviando,   setEnviando]   = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [progresso,  setProgresso]  = useState(0);
  const [nomeArq,    setNomeArq]    = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    setNomeArq(file.name);
    setResultados(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb   = XLSX.read(e.target?.result, { type: "binary" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

      const parsed: Contato[] = rows
        .map((row) => {
          // Detecta coluna de telefone (primeira coluna com "tel" ou "phone" ou "whats" ou apenas coluna A)
          const keys = Object.keys(row);
          const telKey = keys.find(k => /tel|phone|whats|fone|celular/i.test(k)) ?? keys[0];
          const nomeKey = keys.find(k => /nome|name/i.test(k)) ?? keys[1] ?? "";
          return {
            telefone: String(row[telKey] ?? "").trim(),
            nome:     String(row[nomeKey] ?? "").trim(),
            ...row,
          };
        })
        .filter(c => c.telefone);

      setContatos(parsed);
    };
    reader.readAsBinaryString(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function enviar() {
    if (!contatos.length || !mensagem.trim()) return;
    setEnviando(true);
    setProgresso(0);
    setResultados(null);

    // Envia em lotes de 50 para o progress funcionar
    const LOTE = 50;
    const todos: Resultado[] = [];

    for (let i = 0; i < contatos.length; i += LOTE) {
      const lote = contatos.slice(i, i + LOTE);
      const res = await fetch("/api/admin/whatsapp/disparo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contatos: lote, mensagem, delayMs: 800 }),
      });
      const data = await res.json();
      todos.push(...(data.resultados ?? []));
      setProgresso(Math.min(i + LOTE, contatos.length));
    }

    setResultados(todos);
    setEnviando(false);
  }

  const ok    = resultados?.filter(r => r.status === "ok").length ?? 0;
  const erros = resultados?.filter(r => r.status === "erro").length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      <div className="flex items-center gap-3">
        <MessageSquare size={20} className="text-green-400" />
        <div>
          <h1 className="text-lg font-bold text-white">Disparo WhatsApp</h1>
          <p className="text-xs text-gray-500">Envie mensagens em massa a partir de uma lista Excel</p>
        </div>
      </div>

      {/* Upload */}
      <div
        onDrop={onDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-white/15 rounded-2xl p-8 text-center cursor-pointer hover:border-brand/40 hover:bg-brand/5 transition-all"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        <FileSpreadsheet size={32} className="text-gray-600 mx-auto mb-3" />
        {nomeArq ? (
          <div>
            <p className="text-sm font-semibold text-white">{nomeArq}</p>
            <p className="text-xs text-green-400 mt-1">{contatos.length} contatos carregados</p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400">Arraste o arquivo Excel aqui ou clique para selecionar</p>
            <p className="text-xs text-gray-600 mt-1">.xlsx · .xls · .csv</p>
          </div>
        )}
      </div>

      {/* Preview da lista */}
      {contatos.length > 0 && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-gray-500" />
              <span className="text-xs font-semibold text-white">{contatos.length} contatos</span>
            </div>
            <button onClick={() => { setContatos([]); setNomeArq(""); setResultados(null); }}
              className="text-gray-600 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
            {contatos.slice(0, 100).map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                <span className="text-[10px] text-gray-600 w-6 text-right">{i + 1}</span>
                <span className="text-xs font-medium text-white w-40 truncate">{c.nome || "—"}</span>
                <span className="text-xs text-gray-400 font-mono">{c.telefone}</span>
              </div>
            ))}
            {contatos.length > 100 && (
              <div className="px-4 py-2 text-center text-xs text-gray-600">
                +{contatos.length - 100} contatos não exibidos
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mensagem */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8">
          <p className="text-xs font-semibold text-white">Mensagem</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Use <code className="bg-white/8 px-1 rounded">{"{{nome}}"}</code> para personalizar com o nome do contato
          </p>
        </div>
        <div className="p-4">
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder={"Olá {{nome}}, temos novidades para você! 🎉"}
            rows={5}
            className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 resize-none transition-all"
          />
          <p className="text-[10px] text-gray-600 mt-1.5 text-right">{mensagem.length} caracteres</p>
        </div>
      </div>

      {/* Preview da mensagem */}
      {mensagem && contatos.length > 0 && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Preview (primeiro contato)</p>
          <div className="bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm text-white whitespace-pre-wrap">
            {mensagem.replace(/\{\{nome\}\}/gi, contatos[0]?.nome || "Cliente")}
          </div>
        </div>
      )}

      {/* Enviar */}
      <button
        onClick={enviar}
        disabled={enviando || !contatos.length || !mensagem.trim()}
        className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 disabled:bg-dark-700 disabled:text-gray-600 text-white font-bold rounded-2xl transition-all"
      >
        {enviando ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Enviando {progresso}/{contatos.length}...
          </>
        ) : (
          <>
            <Send size={16} />
            Disparar para {contatos.length} contatos
          </>
        )}
      </button>

      {/* Resultado */}
      {resultados && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm font-bold text-green-400">
              <CheckCircle size={14} /> {ok} enviados
            </span>
            {erros > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-bold text-red-400">
                <XCircle size={14} /> {erros} com erro
              </span>
            )}
          </div>
          {erros > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
              {resultados.filter(r => r.status === "erro").map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <XCircle size={12} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs text-white font-mono">{r.telefone}</span>
                  <span className="text-xs text-gray-500">{r.nome}</span>
                  <span className="text-[10px] text-red-400 ml-auto">{r.motivo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
