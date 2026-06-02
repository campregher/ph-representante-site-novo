"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw, Users, Mail, Phone, MapPin, XCircle, Ban, ShieldCheck, Loader2, CheckSquare, Square, ChevronDown, ChevronUp, Hash, Home } from "lucide-react";

interface MarcaCliente {
  id: string; status: string; bloqueado: boolean; observacao: string | null;
  created_at: string; cliente_id: string;
  razao_social: string; nome_fantasia: string | null;
  cnpj: string; inscricao_estadual: string | null; email: string; whatsapp: string;
  cep: string | null; logradouro: string | null; numero: string | null;
  complemento: string | null; bairro: string | null;
  cidade: string | null; estado: string | null;
  totalPedidos: number; totalValor: number;
  condicoes_pagamento_drop: string[];
}

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

const statusLabel: Record<string, string> = { pendente: "Aguardando", aprovado: "Aprovado", recusado: "Recusado" };
const statusColors: Record<string, string> = {
  pendente: "bg-yellow-400/15 text-yellow-400 border-yellow-400/25",
  aprovado: "bg-green-400/15 text-green-400 border-green-400/25",
  recusado: "bg-red-400/15 text-red-400 border-red-400/25",
};

const CONDICOES_OPTIONS = [
  { value: "pix",     label: "PIX à vista" },
  { value: "boleto",  label: "Boleto"      },
  { value: "semanal", label: "Semanal"     },
];

export default function MarcaClientesPage() {
  const [clientes,   setClientes]   = useState<MarcaCliente[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [acting,     setActing]     = useState<string | null>(null);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [savingCondicoes, setSavingCondicoes] = useState<string | null>(null);

  // Modal de aprovação (com condições DROP)
  const [aprovarModal, setAprovarModal] = useState<{ cliente_id: string; nome: string } | null>(null);
  const [aprovarCondicoes, setAprovarCondicoes] = useState<string[]>(["pix", "boleto", "semanal"]);
  const [aprovarObs, setAprovarObs] = useState("");

  // Modal de bloqueio/recusa
  const [obsModal, setObsModal] = useState<{ cliente_id: string; action: string; nome: string } | null>(null);
  const [obsText,  setObsText]  = useState("");

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/marca/clientes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar clientes"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function doAction(cliente_id: string, action: string, observacao?: string, condicoes?: string[]) {
    setActing(`${cliente_id}-${action}`);
    try {
      const res = await fetch("/api/marca/clientes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cliente_id, action, observacao, condicoes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(
        action === "aprovar"     ? "Cliente aprovado!"     :
        action === "recusar"     ? "Cliente recusado."     :
        action === "bloquear"    ? "Cliente bloqueado."    :
                                   "Cliente desbloqueado."
      );
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao executar ação"); }
    finally { setActing(null); }
  }

  async function toggleCondicao(cliente_id: string, current: string[], value: string) {
    if (current[0] === value) return; // já é a condição ativa
    const next = [value];
    setSavingCondicoes(cliente_id);
    setClientes(prev => prev.map(c => c.cliente_id === cliente_id ? { ...c, condicoes_pagamento_drop: next } : c));
    try {
      const res = await fetch("/api/marca/clientes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ cliente_id, action: "set_condicoes", condicoes: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar condição");
      setClientes(prev => prev.map(c => c.cliente_id === cliente_id ? { ...c, condicoes_pagamento_drop: current } : c));
    } finally { setSavingCondicoes(null); }
  }

  function openApprove(cliente_id: string, nome: string) {
    setAprovarModal({ cliente_id, nome });
    setAprovarCondicoes([]);
    setAprovarObs("");
  }

  function selectAprovarCondicao(value: string) {
    setAprovarCondicoes([value]);
  }

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-white">Clientes</h1>
            {!loading && <p className="text-xs text-gray-500">{clientes.length} cliente{clientes.length !== 1 ? "s" : ""}</p>}
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : clientes.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <Users size={28} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhum cliente ainda. Quando um cliente solicitar acesso à sua marca, ele aparecerá aqui.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map((c) => {
              const isActing          = (action: string) => acting === `${c.cliente_id}-${action}`;
              const isSavingCondicoes = savingCondicoes === c.cliente_id;
              const isExpanded        = expanded === c.id;

              const endereco = [c.logradouro, c.numero, c.complemento, c.bairro].filter(Boolean).join(", ");
              const cidadeUF = [c.cidade, c.estado].filter(Boolean).join("/");

              return (
                <div key={c.id} className={`bg-dark-800 border rounded-2xl overflow-hidden ${c.bloqueado ? "border-orange-400/25" : "border-white/8"}`}>
                  <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-bold text-white">{c.razao_social}</p>
                        {c.nome_fantasia && c.nome_fantasia !== c.razao_social && (
                          <span className="text-xs text-gray-500">({c.nome_fantasia})</span>
                        )}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${statusColors[c.status] ?? "bg-gray-400/15 text-gray-400 border-gray-400/25"}`}>
                          {statusLabel[c.status] ?? c.status}
                        </span>
                        {c.bloqueado && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-400/15 text-orange-400 border border-orange-400/25">
                            Bloqueado
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 font-mono">{c.cnpj}</p>
                      <div className="flex flex-wrap gap-3 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-gray-400"><Mail size={10} /> {c.email}</div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400"><Phone size={10} /> {c.whatsapp}</div>
                        {c.cidade && <div className="flex items-center gap-1.5 text-xs text-gray-400"><MapPin size={10} /> {cidadeUF}</div>}
                      </div>
                      {c.observacao && <p className="text-xs text-gray-500 mt-2 italic">"{c.observacao}"</p>}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-base font-black text-white">{fmt(c.totalValor)}</p>
                      <p className="text-xs text-gray-500">{c.totalPedidos} pedido{c.totalPedidos !== 1 ? "s" : ""}</p>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-white/5">
                    {c.status !== "aprovado" && (
                      <button onClick={() => openApprove(c.cliente_id, c.razao_social)}
                        disabled={!!acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-green-400/10 border border-green-400/20 text-green-400 hover:bg-green-400/20 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isActing("aprovar") ? <Loader2 size={11} className="animate-spin" /> : <CheckSquare size={11} />}
                        Aprovar
                      </button>
                    )}
                    {c.status !== "recusado" && (
                      <button onClick={() => { setObsModal({ cliente_id: c.cliente_id, action: "recusar", nome: c.razao_social }); setObsText(""); }}
                        disabled={!!acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-red-400/10 border border-red-400/20 text-red-400 hover:bg-red-400/20 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isActing("recusar") ? <Loader2 size={11} className="animate-spin" /> : <XCircle size={11} />}
                        Recusar
                      </button>
                    )}
                    {!c.bloqueado ? (
                      <button onClick={() => { setObsModal({ cliente_id: c.cliente_id, action: "bloquear", nome: c.razao_social }); setObsText(""); }}
                        disabled={!!acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-orange-400/10 border border-orange-400/20 text-orange-400 hover:bg-orange-400/20 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isActing("bloquear") ? <Loader2 size={11} className="animate-spin" /> : <Ban size={11} />}
                        Bloquear
                      </button>
                    ) : (
                      <button onClick={() => doAction(c.cliente_id, "desbloquear")}
                        disabled={!!acting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-400/10 border border-blue-400/20 text-blue-400 hover:bg-blue-400/20 rounded-xl transition-all disabled:opacity-50"
                      >
                        {isActing("desbloquear") ? <Loader2 size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                        Desbloquear
                      </button>
                    )}
                  </div>

                  {/* Ver dados completos */}
                  <button
                    onClick={() => setExpanded(isExpanded ? null : c.id)}
                    className="mt-3 flex items-center gap-1 text-xs text-gray-600 hover:text-gray-400 transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    {isExpanded ? "Ocultar dados" : "Ver dados completos"}
                  </button>
                  </div>{/* fim p-5 */}

                  {/* Painel de dados completos */}
                  {isExpanded && (
                    <div className="border-t border-white/8 px-5 py-4 bg-white/[0.02] grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Razão social</p>
                        <p className="text-xs text-white font-semibold">{c.razao_social}</p>
                      </div>
                      {c.nome_fantasia && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Nome fantasia</p>
                          <p className="text-xs text-white font-semibold">{c.nome_fantasia}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">CNPJ</p>
                        <p className="text-xs text-white font-mono">{c.cnpj}</p>
                      </div>
                      {c.inscricao_estadual && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Inscrição Estadual</p>
                          <p className="text-xs text-white font-mono">{c.inscricao_estadual}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">Email</p>
                        <p className="text-xs text-white">{c.email}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">WhatsApp</p>
                        <p className="text-xs text-white">{c.whatsapp}</p>
                      </div>
                      {c.cep && (
                        <div>
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5">CEP</p>
                          <p className="text-xs text-white font-mono">{c.cep}</p>
                        </div>
                      )}
                      {endereco && (
                        <div className="sm:col-span-2">
                          <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Home size={9} /> Endereço</p>
                          <p className="text-xs text-white">{endereco}</p>
                          {cidadeUF && <p className="text-xs text-gray-400 mt-0.5">{cidadeUF}{c.cep ? ` · CEP ${c.cep}` : ""}</p>}
                        </div>
                      )}
                      <div>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-0.5 flex items-center gap-1"><Hash size={9} /> Cliente desde</p>
                        <p className="text-xs text-white">{new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</p>
                      </div>
                    </div>
                  )}

                  {/* Condição DROP (só para aprovados) */}
                  {c.status === "aprovado" && (
                    <div className="border-t border-white/5 px-5 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="text-xs text-gray-500">Condição DROP:</p>
                        {isSavingCondicoes && <Loader2 size={10} className="animate-spin text-gray-600" />}
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        {CONDICOES_OPTIONS.map(({ value, label }) => {
                          const active = c.condicoes_pagamento_drop[0] === value;
                          return (
                            <button key={value} type="button"
                              onClick={() => toggleCondicao(c.cliente_id, c.condicoes_pagamento_drop, value)}
                              disabled={isSavingCondicoes}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all disabled:opacity-50 ${
                                active
                                  ? "bg-brand/15 border-brand/30 text-brand"
                                  : "bg-dark-900 border-white/10 text-gray-600 hover:border-white/20 hover:text-gray-400"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal: Aprovar com condições DROP ── */}
      {aprovarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setAprovarModal(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-5" onClick={(e) => e.stopPropagation()}>
            <div>
              <p className="text-sm font-bold text-white">Aprovar cliente</p>
              <p className="text-xs text-gray-500 mt-0.5">{aprovarModal.nome}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-400">Condição de pagamento DROP *</label>
              <p className="text-xs text-gray-600">Defina como este cliente paga pedidos dropshipping.</p>
              <div className="space-y-2 mt-1">
                {CONDICOES_OPTIONS.map(({ value, label }) => {
                  const active = aprovarCondicoes[0] === value;
                  return (
                    <button key={value} type="button"
                      onClick={() => selectAprovarCondicao(value)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                        active
                          ? "bg-brand/10 border-brand/30 text-white"
                          : "bg-dark-900 border-white/8 text-gray-500 hover:border-white/20"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        active ? "border-brand bg-brand" : "border-white/20"
                      }`}>
                        {active && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <span className="text-sm font-semibold">{label}</span>
                    </button>
                  );
                })}
              </div>
              {aprovarCondicoes.length === 0 && (
                <p className="text-xs text-red-400">Selecione uma condição.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Observação (opcional)</label>
              <textarea
                value={aprovarObs}
                onChange={(e) => setAprovarObs(e.target.value)}
                placeholder="Ex: Cliente preferencial, prazo estendido..."
                rows={2}
                className="w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setAprovarModal(null)}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm"
              >Cancelar</button>
              <button
                disabled={aprovarCondicoes.length === 0 || !!acting}
                onClick={() => {
                  doAction(aprovarModal.cliente_id, "aprovar", aprovarObs || undefined, aprovarCondicoes);
                  setAprovarModal(null);
                }}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {acting ? <Loader2 size={13} className="animate-spin" /> : <CheckSquare size={13} />}
                Aprovar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Bloquear / Recusar ── */}
      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setObsModal(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">
              {obsModal.action === "bloquear" ? "Bloquear" : "Recusar"} — {obsModal.nome}
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1.5">Motivo (opcional)</label>
              <textarea
                value={obsText}
                onChange={(e) => setObsText(e.target.value)}
                placeholder={obsModal.action === "bloquear" ? "Ex: Pendência de pagamento..." : "Ex: Cadastro incompleto..."}
                rows={3}
                className="w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setObsModal(null)}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm"
              >Cancelar</button>
              <button
                onClick={() => { doAction(obsModal.cliente_id, obsModal.action, obsText || undefined); setObsModal(null); }}
                className={`flex-1 py-2.5 font-bold rounded-xl text-sm text-white transition-all ${
                  obsModal.action === "bloquear" ? "bg-orange-500 hover:bg-orange-600" : "bg-red-500 hover:bg-red-600"
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
