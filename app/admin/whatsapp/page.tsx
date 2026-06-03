"use client";

import { useState, useRef } from "react";
import * as XLSX from "xlsx";
import {
  Send, CheckCircle, XCircle, Loader2, MessageSquare,
  Users, FileSpreadsheet, X, Download, AlertTriangle, Info, ImagePlus, Trash2,
} from "lucide-react";

interface Contato {
  telefone: string;
  nome:     string;
  empresa:  string;
  email:    string;
  [k: string]: string;
}

interface ContatoValidado extends Contato {
  telefoneNorm: string | null;
  erros:        string[];
  aviso:        string | null;
}

interface Resultado { telefone: string; nome: string; status: "ok" | "erro"; motivo?: string }

// ── Validações ─────────────────────────────────────────────────────────────

function normalizarTelefone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11) return `55${digits}`;   // (11) 99999-9999
  if (digits.length === 10) return `55${digits}`;   // (11) 9999-9999
  if (digits.length === 13) return digits;           // 5511999999999
  if (digits.length === 12) return digits;           // 551199999999
  return null;
}

function validarTelefone(raw: string): { norm: string | null; erro: string | null; aviso: string | null } {
  if (!raw.trim()) return { norm: null, erro: "Telefone obrigatório", aviso: null };

  const digits = raw.replace(/\D/g, "");

  if (digits.length < 10) return { norm: null, erro: "Número muito curto (mín. 10 dígitos)", aviso: null };
  if (digits.length > 13) return { norm: null, erro: "Número muito longo (máx. 13 dígitos)", aviso: null };

  const norm = normalizarTelefone(raw);
  if (!norm)   return { norm: null, erro: "Formato inválido", aviso: null };

  // Avisa se não parece ser celular brasileiro (9º dígito após DDD)
  const sem55 = norm.replace(/^55/, "");
  const aviso = sem55.length === 11 && sem55[2] !== "9"
    ? "Pode não ser celular (não começa com 9 após o DDD)"
    : null;

  return { norm, erro: null, aviso };
}

function validarContato(c: Contato, vistos: Set<string>): ContatoValidado {
  const erros: string[] = [];
  let   aviso: string | null = null;

  if (!c.nome.trim())    erros.push("Nome obrigatório");
  if (!c.empresa.trim()) erros.push("Empresa obrigatória");

  const tel = validarTelefone(c.telefone);
  if (tel.erro) erros.push(tel.erro);
  if (tel.aviso) aviso = tel.aviso;

  if (tel.norm && vistos.has(tel.norm)) {
    erros.push("Número duplicado");
  } else if (tel.norm) {
    vistos.add(tel.norm);
  }

  return { ...c, telefoneNorm: tel.norm, erros, aviso };
}

// ── Componente ──────────────────────────────────────────────────────────────

export default function WhatsAppDisparoPage() {
  const [contatos,   setContatos]   = useState<ContatoValidado[]>([]);
  const [mensagem,   setMensagem]   = useState("");
  const [enviando,   setEnviando]   = useState(false);
  const [resultados, setResultados] = useState<Resultado[] | null>(null);
  const [progresso,  setProgresso]  = useState(0);
  const [nomeArq,    setNomeArq]    = useState("");
  const [filtro,     setFiltro]     = useState<"todos" | "validos" | "invalidos">("todos");
  const [imagem,     setImagem]     = useState<{ preview: string; nome: string; mediaId: string | null; erro: string | null; carregando: boolean } | null>(null);
  const inputRef    = useRef<HTMLInputElement>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);

  const validos   = contatos.filter(c => c.erros.length === 0);
  const invalidos = contatos.filter(c => c.erros.length > 0);
  const avisos    = contatos.filter(c => c.aviso && c.erros.length === 0);

  const msgErro =
    !mensagem.trim()       ? "Mensagem não pode estar vazia" :
    mensagem.length > 4096 ? `Mensagem muito longa (${mensagem.length}/4096 caracteres)` :
    mensagem.length < 5    ? "Mensagem muito curta" :
    null;

  function handleFile(file: File) {
    setNomeArq(file.name);
    setResultados(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const wb   = XLSX.read(e.target?.result, { type: "binary" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

      const vistos = new Set<string>();
      const parsed = rows.map((row) => {
        const keys     = Object.keys(row);
        const telKey   = keys.find(k => /tel|phone|whats|fone|celular/i.test(k)) ?? keys[2] ?? keys[0];
        const nomeKey  = keys.find(k => /^nome$/i.test(k)) ?? keys.find(k => /nome|name/i.test(k)) ?? keys[0];
        const empKey   = keys.find(k => /empresa|company|loja|fantasia/i.test(k)) ?? keys[1] ?? "";
        const emailKey = keys.find(k => /email|e-mail/i.test(k)) ?? "";
        const c: Contato = {
          telefone: String(row[telKey]   ?? "").trim(),
          nome:     String(row[nomeKey]  ?? "").trim(),
          empresa:  empKey   ? String(row[empKey]   ?? "").trim() : "",
          email:    emailKey ? String(row[emailKey] ?? "").trim() : "",
          ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)])),
        };
        return validarContato(c, vistos);
      });

      setContatos(parsed);
      setFiltro(parsed.some(c => c.erros.length > 0) ? "invalidos" : "todos");
    };
    reader.readAsBinaryString(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  async function handleImagem(file: File) {
    const preview = URL.createObjectURL(file);
    setImagem({ preview, nome: file.name, mediaId: null, erro: null, carregando: true });

    const form = new FormData();
    form.append("imagem", file);
    const res  = await fetch("/api/admin/whatsapp/upload-imagem", { method: "POST", body: form });
    const data = await res.json();

    if (!res.ok) {
      setImagem(prev => prev ? { ...prev, erro: data.error, carregando: false } : null);
    } else {
      setImagem(prev => prev ? { ...prev, mediaId: data.mediaId, carregando: false } : null);
    }
  }

  async function enviar() {
    if (!validos.length || msgErro) return;
    if (!confirm(`Enviar mensagem para ${validos.length} contato(s) válido(s)?`)) return;

    setEnviando(true);
    setProgresso(0);
    setResultados(null);

    const LOTE = 50;
    const todos: Resultado[] = [];

    for (let i = 0; i < validos.length; i += LOTE) {
      const lote = validos.slice(i, i + LOTE).map(c => ({
        telefone: c.telefoneNorm!,
        nome:     c.nome,
        empresa:  c.empresa,
        email:    c.email,
      }));
      const res  = await fetch("/api/admin/whatsapp/disparo", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ contatos: lote, mensagem, imagemId: imagem?.mediaId ?? null, delayMs: 45000 }),
      });
      const data = await res.json();
      todos.push(...(data.resultados ?? []));
      setProgresso(Math.min(i + LOTE, validos.length));
    }

    setResultados(todos);
    setEnviando(false);
  }

  const listaFiltrada =
    filtro === "validos"   ? validos :
    filtro === "invalidos" ? invalidos :
    contatos;

  const ok    = resultados?.filter(r => r.status === "ok").length ?? 0;
  const erros = resultados?.filter(r => r.status === "erro").length ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <MessageSquare size={20} className="text-green-400" />
        <div>
          <h1 className="text-lg font-bold text-white">Disparo WhatsApp</h1>
          <p className="text-xs text-gray-500">Envie mensagens em massa a partir de uma lista Excel</p>
        </div>
        <a
          href="/api/admin/whatsapp/template"
          download
          className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-dark-800 border border-white/8 hover:border-brand/30 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
        >
          <Download size={13} /> Baixar template
        </a>
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
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
        />
        <FileSpreadsheet size={32} className="text-gray-600 mx-auto mb-3" />
        {nomeArq ? (
          <div>
            <p className="text-sm font-semibold text-white">{nomeArq}</p>
            <div className="flex items-center justify-center gap-3 mt-2 flex-wrap">
              <span className="text-xs text-green-400">{validos.length} válidos</span>
              {invalidos.length > 0 && <span className="text-xs text-red-400">{invalidos.length} com erro</span>}
              {avisos.length > 0   && <span className="text-xs text-yellow-400">{avisos.length} com aviso</span>}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-400">Arraste o arquivo Excel aqui ou clique para selecionar</p>
            <p className="text-xs text-gray-600 mt-1">.xlsx · .xls · .csv · Campos obrigatórios: Nome, Empresa, Telefone</p>
          </div>
        )}
      </div>

      {/* Preview da lista */}
      {contatos.length > 0 && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-1">
              <Users size={14} className="text-gray-500" />
              <span className="text-xs font-semibold text-white">{contatos.length} contatos</span>
            </div>
            {/* Filtros */}
            <div className="flex items-center gap-1">
              {(["todos", "validos", "invalidos"] as const).map(f => (
                <button key={f} onClick={() => setFiltro(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                    filtro === f
                      ? "bg-brand/20 text-brand border border-brand/30"
                      : "text-gray-500 hover:text-white"
                  }`}
                >
                  {f === "todos" ? `Todos (${contatos.length})` :
                   f === "validos" ? `✓ Válidos (${validos.length})` :
                   `✗ Erros (${invalidos.length})`}
                </button>
              ))}
            </div>
            <button onClick={() => { setContatos([]); setNomeArq(""); setResultados(null); }}
              className="text-gray-600 hover:text-red-400 transition-colors">
              <X size={14} />
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-white/5">
            {listaFiltrada.slice(0, 200).map((c, i) => (
              <div key={i} className={`px-4 py-2.5 ${c.erros.length > 0 ? "bg-red-400/5" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-gray-600 w-6 text-right flex-shrink-0">
                    {contatos.indexOf(c) + 1}
                  </span>
                  {c.erros.length > 0
                    ? <XCircle size={11} className="text-red-400 flex-shrink-0" />
                    : c.aviso
                      ? <AlertTriangle size={11} className="text-yellow-400 flex-shrink-0" />
                      : <CheckCircle size={11} className="text-green-400 flex-shrink-0" />
                  }
                  <span className="text-xs font-medium text-white w-28 truncate flex-shrink-0">{c.nome || "—"}</span>
                  <span className="text-xs text-gray-500 w-28 truncate flex-shrink-0">{c.empresa || "—"}</span>
                  <span className="text-xs text-gray-400 font-mono flex-shrink-0">{c.telefoneNorm ?? c.telefone}</span>
                </div>
                {c.erros.length > 0 && (
                  <div className="ml-10 mt-1 flex flex-wrap gap-1">
                    {c.erros.map((e, ei) => (
                      <span key={ei} className="text-[10px] bg-red-400/15 text-red-300 px-2 py-0.5 rounded-full">{e}</span>
                    ))}
                  </div>
                )}
                {c.aviso && c.erros.length === 0 && (
                  <p className="ml-10 mt-1 text-[10px] text-yellow-400">{c.aviso}</p>
                )}
              </div>
            ))}
            {listaFiltrada.length > 200 && (
              <div className="px-4 py-2 text-center text-xs text-gray-600">
                +{listaFiltrada.length - 200} contatos não exibidos
              </div>
            )}
          </div>
        </div>
      )}

      {/* Imagem opcional */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-white">Imagem <span className="text-gray-600 font-normal">(opcional)</span></p>
            <p className="text-[10px] text-gray-500 mt-0.5">JPG · PNG · WebP · máx. 5MB — enviada antes do texto</p>
          </div>
          {imagem && (
            <button onClick={() => setImagem(null)} className="text-gray-600 hover:text-red-400 transition-colors">
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div className="p-4">
          {!imagem ? (
            <button
              onClick={() => imgInputRef.current?.click()}
              className="w-full border-2 border-dashed border-white/10 rounded-xl p-6 flex flex-col items-center gap-2 hover:border-brand/30 hover:bg-brand/5 transition-all"
            >
              <ImagePlus size={24} className="text-gray-600" />
              <span className="text-xs text-gray-500">Clique para selecionar imagem</span>
            </button>
          ) : (
            <div className="flex items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imagem.preview} alt="preview" className="w-20 h-20 object-cover rounded-xl border border-white/10 flex-shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs font-medium text-white truncate">{imagem.nome}</p>
                {imagem.carregando && (
                  <p className="text-xs text-gray-400 flex items-center gap-1.5">
                    <Loader2 size={11} className="animate-spin" /> Enviando para Meta...
                  </p>
                )}
                {imagem.erro && (
                  <p className="text-xs text-red-400 flex items-center gap-1"><XCircle size={11} /> {imagem.erro}</p>
                )}
                {imagem.mediaId && (
                  <p className="text-xs text-green-400 flex items-center gap-1"><CheckCircle size={11} /> Pronta para envio</p>
                )}
              </div>
            </div>
          )}
          <input
            ref={imgInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImagem(f); e.target.value = ""; }}
          />
        </div>
      </div>

      {/* Mensagem */}
      <div className={`bg-dark-800 border rounded-2xl overflow-hidden ${msgErro && mensagem ? "border-red-400/30" : "border-white/8"}`}>
        <div className="px-4 py-3 border-b border-white/8">
          <p className="text-xs font-semibold text-white">Mensagem</p>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Variáveis:{" "}
            {["{{nome}}", "{{empresa}}", "{{telefone}}", "{{email}}"].map(v => (
              <code key={v} className="bg-white/8 px-1 rounded mx-0.5">{v}</code>
            ))}
          </p>
        </div>
        <div className="p-4">
          <textarea
            value={mensagem}
            onChange={e => setMensagem(e.target.value)}
            placeholder="Olá {{nome}} da {{empresa}}, temos novidades para você! 🎉"
            rows={5}
            className="w-full bg-dark-900 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 resize-none transition-all"
          />
          <div className="flex items-center justify-between mt-1.5">
            {msgErro && mensagem ? (
              <p className="text-[10px] text-red-400 flex items-center gap-1"><XCircle size={10} /> {msgErro}</p>
            ) : mensagem ? (
              <p className="text-[10px] text-green-400 flex items-center gap-1"><CheckCircle size={10} /> Mensagem válida</p>
            ) : <span />}
            <p className={`text-[10px] ${mensagem.length > 4096 ? "text-red-400" : "text-gray-600"}`}>
              {mensagem.length}/4096
            </p>
          </div>
        </div>
      </div>

      {/* Preview */}
      {mensagem && !msgErro && validos.length > 0 && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <Info size={12} className="text-gray-500" />
            <p className="text-[10px] text-gray-500 uppercase tracking-wide">Preview — {validos[0].nome}</p>
          </div>
          <div className="bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-3 text-sm text-white whitespace-pre-wrap">
            {mensagem
              .replace(/\{\{nome\}\}/gi,     validos[0].nome)
              .replace(/\{\{empresa\}\}/gi,   validos[0].empresa)
              .replace(/\{\{telefone\}\}/gi,  validos[0].telefone)
              .replace(/\{\{email\}\}/gi,     validos[0].email)
            }
          </div>
        </div>
      )}

      {/* Resumo de validação */}
      {contatos.length > 0 && invalidos.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-yellow-400/8 border border-yellow-400/20 rounded-2xl">
          <AlertTriangle size={14} className="text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-yellow-300">
            <span className="font-bold">{invalidos.length} contato(s) com erro</span> serão ignorados no disparo.
            Apenas os <span className="font-bold">{validos.length} válidos</span> receberão a mensagem.
          </p>
        </div>
      )}

      {/* Botão enviar */}
      <button
        onClick={enviar}
        disabled={enviando || !validos.length || !!msgErro || !!imagem?.carregando || !!imagem?.erro}
        className="w-full flex items-center justify-center gap-2 py-3 bg-green-500 hover:bg-green-600 disabled:bg-dark-700 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-2xl transition-all"
      >
        {enviando ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            Enviando {progresso}/{validos.length}...
          </>
        ) : (
          <>
            <Send size={16} />
            {validos.length > 0
              ? `Disparar para ${validos.length} contato${validos.length !== 1 ? "s" : ""} válido${validos.length !== 1 ? "s" : ""}`
              : "Nenhum contato válido"}
          </>
        )}
      </button>

      {/* Resultado */}
      {resultados && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-white/8 flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-sm font-bold text-green-400">
              <CheckCircle size={14} /> {ok} enviados com sucesso
            </span>
            {erros > 0 && (
              <span className="flex items-center gap-1.5 text-sm font-bold text-red-400">
                <XCircle size={14} /> {erros} com falha
              </span>
            )}
          </div>
          {erros > 0 && (
            <div className="max-h-48 overflow-y-auto divide-y divide-white/5">
              {resultados.filter(r => r.status === "erro").map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <XCircle size={12} className="text-red-400 flex-shrink-0" />
                  <span className="text-xs font-mono text-white">{r.telefone}</span>
                  <span className="text-xs text-gray-500 truncate">{r.nome}</span>
                  <span className="text-[10px] text-red-400 ml-auto flex-shrink-0">{r.motivo}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
