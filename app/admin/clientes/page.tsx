"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, Clock, RefreshCw,
  ChevronDown, ChevronUp, MapPin, Mail, Phone,
  Building2, FileText, Package, User,
} from "lucide-react";

interface Orcamento {
  id: string; numero: number; status: string;
  status_pagamento: string | null;
  tipo_pedido: string | null;
  condicao_pagamento: string | null;
  prazo_boleto: string | null;
  transportadora: string | null;
  observacoes: string | null;
  total: number | null; marca: string | null; created_at: string;
  orcamento_itens?: {
    produto_sku: string;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }[];
}

interface Cliente {
  id: string; razao_social: string; nome_fantasia?: string; cnpj: string;
  email: string; whatsapp: string;
  cep?: string; logradouro?: string; numero?: string; complemento?: string;
  bairro?: string; cidade?: string; estado?: string;
  cnae_codigo?: string; cnae_descricao?: string;
  inscricao_estadual?: string;
  status: "pendente" | "aprovado" | "reprovado";
  observacao_admin?: string; created_at: string;
  orcamentos?: Orcamento[];
}

const statusCfg = {
  pendente:  { label: "Pendente",  cls: "bg-yellow-400/15 text-yellow-400 border-yellow-400/25" },
  aprovado:  { label: "Aprovado",  cls: "bg-green-400/15  text-green-400  border-green-400/25"  },
  reprovado: { label: "Reprovado", cls: "bg-red-400/15    text-red-400    border-red-400/25"    },
};

const orderStatus: Record<string, { label: string; dot: string }> = {
  rascunho: { label: "Rascunho",   dot: "bg-gray-500"   },
  enviado:  { label: "Aguardando", dot: "bg-yellow-400" },
  aprovado: { label: "Aprovado",   dot: "bg-green-500"  },
  recusado: { label: "Recusado",   dot: "bg-red-500"    },
  finalizado: { label: "Finalizado", dot: "bg-indigo-500" },
};

function fmt(v: number | null) {
  if (!v) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function orderTotal(o: Orcamento) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);
}

function paymentLabel(value: string | null) {
  if (value === "pago") return "Pago";
  if (value === "atrasado") return "Atrasado";
  return "Em aberto";
}

function conditionLabel(o: Orcamento) {
  if (o.condicao_pagamento === "pix") return "PIX";
  if (o.condicao_pagamento === "boleto") return `Boleto${o.prazo_boleto ? ` ${o.prazo_boleto}d` : ""}`;
  return null;
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2">
      <span className="text-gray-600 flex-shrink-0 mt-0.5">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-600 leading-none mb-0.5">{label}</p>
        <p className="text-xs text-gray-300 break-words">{value}</p>
      </div>
    </div>
  );
}

type Panel = "cadastro" | "pedidos" | null;

export default function AdminClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [obsModal, setObsModal] = useState<{ id: string; obs: string } | null>(null);
  const [expanded, setExpanded] = useState<{ id: string; panel: Panel }>({ id: "", panel: null });
  const [filter, setFilter] = useState<"todos" | "pendente" | "aprovado" | "reprovado">("todos");

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/clientes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar clientes");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: "aprovado" | "reprovado", observacao_admin?: string) {
    setActionId(id);
    try {
      const res = await fetch("/api/admin/clientes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, observacao_admin: observacao_admin ?? "" }),
      });
      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Erro ao atualizar cliente");
        return;
      }
      toast.success(status === "aprovado" ? "Cliente aprovado!" : "Cliente reprovado.");
      await load();
    } finally { setActionId(null); setObsModal(null); }
  }

  function toggle(id: string, panel: Panel) {
    setExpanded(prev =>
      prev.id === id && prev.panel === panel ? { id: "", panel: null } : { id, panel }
    );
  }

  const counts = {
    todos:     clientes.length,
    pendente:  clientes.filter((c) => c.status === "pendente").length,
    aprovado:  clientes.filter((c) => c.status === "aprovado").length,
    reprovado: clientes.filter((c) => c.status === "reprovado").length,
  };

  const visible = filter === "todos" ? clientes : clientes.filter((c) => c.status === filter);

  return (
    <div className="p-4 sm:p-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h1 className="text-xl font-black text-white">Clientes</h1>
          <p className="text-xs text-gray-500 mt-0.5">{clientes.length} cadastro{clientes.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={load} disabled={loading}
          className="ml-auto p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-5">
        {(["todos", "pendente", "aprovado", "reprovado"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filter === f
                ? "bg-brand border-brand text-white"
                : "bg-dark-800 border-white/8 text-gray-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {f === "todos" ? "Todos" : f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 opacity-60">{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-gray-500 text-sm">Carregando...</div>
      ) : visible.length === 0 ? (
        <div className="p-12 text-center text-gray-500 text-sm bg-dark-800 border border-white/8 rounded-2xl">Nenhum cliente encontrado.</div>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const ords = c.orcamentos ?? [];
            const totalPedidos = ords.length;
            const totalValor = ords.reduce((s, o) => s + orderTotal(o), 0);
            const pendingOrds = ords.filter((o) => o.status === "enviado").length;
            const approvedOrds = ords.filter((o) => o.status === "aprovado").length;
            const cfg = statusCfg[c.status];
            const showCadastro = expanded.id === c.id && expanded.panel === "cadastro";
            const showPedidos  = expanded.id === c.id && expanded.panel === "pedidos";

            const addressLine = [
              c.logradouro && `${c.logradouro}${c.numero ? `, ${c.numero}` : ""}`,
              c.complemento,
              c.bairro,
              c.cidade && c.estado ? `${c.cidade}/${c.estado}` : (c.cidade ?? c.estado),
            ].filter(Boolean).join(" — ");

            return (
              <div key={c.id} className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">

                {/* ── Resumo ── */}
                <div className="px-5 py-4 space-y-3">

                  {/* Nome + status */}
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white leading-snug">{c.razao_social}</p>
                      {c.nome_fantasia && <p className="text-xs text-gray-400 mt-0.5">{c.nome_fantasia}</p>}
                      <p className="text-[11px] text-gray-600 mt-0.5 font-mono">{c.cnpj}</p>
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Linha rápida de contato */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {c.email && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Mail size={11} className="text-gray-600" /> {c.email}
                      </span>
                    )}
                    {c.whatsapp && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Phone size={11} className="text-gray-600" /> {c.whatsapp}
                      </span>
                    )}
                    {(c.cidade || c.estado) && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MapPin size={11} className="text-gray-600" />
                        {c.cidade && c.estado ? `${c.cidade}/${c.estado}` : (c.cidade ?? c.estado)}
                      </span>
                    )}
                  </div>

                  {/* Botões expandir + ações */}
                  <div className="flex items-center justify-between flex-wrap gap-2 pt-0.5">
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggle(c.id, "cadastro")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          showCadastro
                            ? "bg-white/8 border-white/20 text-white"
                            : "bg-dark-700 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        <User size={12} />
                        Cadastro
                        {showCadastro ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>

                      <button onClick={() => toggle(c.id, "pedidos")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                          showPedidos
                            ? "bg-white/8 border-white/20 text-white"
                            : "bg-dark-700 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        <FileText size={12} />
                        {totalPedidos} {totalPedidos === 1 ? "pedido" : "pedidos"}
                        {pendingOrds > 0 && <span className="text-yellow-400">· {pendingOrds} aguard.</span>}
                        {showPedidos ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {c.status !== "aprovado" && (
                        <button onClick={() => updateStatus(c.id, "aprovado")}
                          disabled={actionId === c.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-40"
                        >
                          <CheckCircle size={13} /> Aprovar
                        </button>
                      )}
                      {c.status !== "reprovado" && (
                        <button onClick={() => setObsModal({ id: c.id, obs: c.observacao_admin ?? "" })}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-xs font-semibold rounded-xl transition-all"
                        >
                          <XCircle size={13} /> Reprovar
                        </button>
                      )}
                      {c.status === "pendente" && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400">
                          <Clock size={13} /> Pendente
                        </span>
                      )}
                    </div>
                  </div>

                  {c.observacao_admin && (
                    <p className="text-xs text-red-400/80 bg-red-400/5 border border-red-400/15 rounded-lg px-3 py-2">
                      Obs: {c.observacao_admin}
                    </p>
                  )}
                </div>

                {/* ── Painel: Dados de Cadastro ── */}
                {showCadastro && (
                  <div className="border-t border-white/8 bg-dark-900/50 px-5 py-4 space-y-5">
                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Dados do cadastro</p>

                    {/* Empresa */}
                    <div>
                      <p className="text-[10px] font-bold text-brand/70 uppercase tracking-widest mb-2">Empresa</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Row icon={<Building2 size={12} />} label="Razão Social" value={c.razao_social} />
                        {c.nome_fantasia && <Row icon={<Building2 size={12} />} label="Nome Fantasia" value={c.nome_fantasia} />}
                        <Row icon={<Building2 size={12} />} label="CNPJ" value={c.cnpj} />
                        {c.inscricao_estadual && <Row icon={<Building2 size={12} />} label="Inscrição Estadual" value={c.inscricao_estadual} />}
                        {c.cnae_codigo && (
                          <Row icon={<Package size={12} />} label="CNAE"
                            value={`${c.cnae_codigo}${c.cnae_descricao ? ` — ${c.cnae_descricao}` : ""}`}
                          />
                        )}
                      </div>
                    </div>

                    {/* Endereço */}
                    {(c.logradouro || c.cidade) && (
                      <div>
                        <p className="text-[10px] font-bold text-brand/70 uppercase tracking-widest mb-2">Endereço</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {c.cep && <Row icon={<MapPin size={12} />} label="CEP" value={c.cep} />}
                          {addressLine && <Row icon={<MapPin size={12} />} label="Endereço" value={addressLine} />}
                        </div>
                      </div>
                    )}

                    {/* Contato */}
                    <div>
                      <p className="text-[10px] font-bold text-brand/70 uppercase tracking-widest mb-2">Contato</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Row icon={<Mail size={12} />} label="Email" value={c.email} />
                        <Row icon={<Phone size={12} />} label="WhatsApp" value={c.whatsapp} />
                      </div>
                    </div>

                    <p className="text-[10px] text-gray-700">
                      Cadastrado em {new Date(c.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                    </p>

                    <button onClick={() => toggle(c.id, "cadastro")}
                      className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white transition-colors"
                    >
                      <ChevronUp size={12} /> Exibir menos
                    </button>
                  </div>
                )}

                {/* ── Painel: Pedidos ── */}
                {showPedidos && (
                  <div className="border-t border-white/8 bg-dark-900/50">
                    <div className="px-5 py-3 flex items-center justify-between">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Histórico de pedidos</p>
                      {totalValor > 0 && (
                        <p className="text-xs font-bold text-white">{fmt(totalValor)} total</p>
                      )}
                    </div>

                    {ords.length === 0 ? (
                      <p className="px-5 pb-4 text-xs text-gray-600">Nenhum pedido criado.</p>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {ords
                          .slice()
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((o) => {
                            const os = orderStatus[o.status] ?? orderStatus.enviado;
                            const itens = o.orcamento_itens ?? [];
                            const total = orderTotal(o);
                            const qtd = itens.reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);
                            const condicao = conditionLabel(o);
                            return (
                              <div key={o.id} className="px-5 py-3">
                                <div className="flex items-start gap-3">
                                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${os.dot}`} />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-xs font-bold text-white">Pedido #{o.numero}</p>
                                      {o.marca && <span className="text-[10px] text-gray-600 uppercase tracking-wide">{o.marca}</span>}
                                      {o.tipo_pedido && <span className="text-[10px] text-gray-500">{o.tipo_pedido === "dropshipping" ? "Dropshipping" : "Estoque"}</span>}
                                      <span className="text-[10px] text-gray-500">{paymentLabel(o.status_pagamento)}</span>
                                    </div>
                                    <p className="text-[11px] text-gray-500 mt-0.5">
                                      {new Date(o.created_at).toLocaleDateString("pt-BR")}
                                      {condicao && ` · ${condicao}`}
                                      {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                                    </p>
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-xs font-semibold text-gray-400">{os.label}</p>
                                    {total > 0 && <p className="text-xs font-bold text-white mt-0.5">{fmt(total)}</p>}
                                  </div>
                                </div>
                                {itens.length > 0 && (
                                  <div className="mt-3 ml-5 rounded-xl border border-white/8 bg-dark-950/40 divide-y divide-white/5">
                                    {itens.slice(0, 4).map((item) => (
                                      <div key={`${o.id}-${item.produto_sku}`} className="px-3 py-2 flex items-center gap-3 text-xs">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-white font-medium truncate">{item.produto_nome}</p>
                                          <p className="text-[10px] text-gray-600">{item.produto_sku}</p>
                                        </div>
                                        <span className="text-gray-400">{item.quantidade}x</span>
                                        <span className="text-gray-300 font-semibold">{fmt(Number(item.valor_total ?? 0)) ?? "-"}</span>
                                      </div>
                                    ))}
                                    {itens.length > 4 && (
                                      <p className="px-3 py-2 text-[10px] text-gray-600">+ {itens.length - 4} item{itens.length - 4 !== 1 ? "s" : ""}</p>
                                    )}
                                  </div>
                                )}
                                {(o.transportadora || o.observacoes) && (
                                  <p className="mt-2 ml-5 text-[11px] text-gray-500">
                                    {o.transportadora && `Transportadora: ${o.transportadora}`}
                                    {o.transportadora && o.observacoes && " · "}
                                    {o.observacoes && `Obs: ${o.observacoes}`}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}

                    <div className="px-5 pb-3 pt-1 flex items-center justify-between">
                      <div className="flex gap-3">
                        {approvedOrds > 0 && <span className="text-[11px] text-green-400">{approvedOrds} aprovado{approvedOrds > 1 ? "s" : ""}</span>}
                        {pendingOrds > 0 && <span className="text-[11px] text-yellow-400">{pendingOrds} aguardando</span>}
                      </div>
                      <button onClick={() => toggle(c.id, "pedidos")}
                        className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-white transition-colors"
                      >
                        <ChevronUp size={12} /> Exibir menos
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal reprovar */}
      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setObsModal(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Reprovar cadastro</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Motivo (opcional)</label>
              <textarea value={obsModal.obs} onChange={(e) => setObsModal({ ...obsModal, obs: e.target.value })}
                rows={3} placeholder="Ex: CNAE fora do ramo automotivo..."
                className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-red-400/50 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setObsModal(null)} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm transition-all hover:bg-dark-600">Cancelar</button>
              <button onClick={() => updateStatus(obsModal.id, "reprovado", obsModal.obs)}
                disabled={actionId === obsModal.id}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50"
              >Reprovar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
