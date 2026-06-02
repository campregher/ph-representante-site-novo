"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  RefreshCw, Loader2, ChevronDown, ChevronUp, AlertCircle,
  Clock, Send, Lock, Unlock, CheckCircle, DollarSign, Mail,
  Printer, ExternalLink,
} from "lucide-react";

interface Pedido {
  id: string; numero: number; status_pagamento: string | null;
  status: string | null; tipo_pedido: string | null;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  transportadora: string | null; observacoes: string | null;
  marca: string | null; total: number; created_at: string;
  orcamento_itens?: {
    produto_sku: string;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }[];
}

interface ClienteCobranca {
  id: string; nome: string; cnpj: string; email: string;
  bloqueado: boolean; pedidos: Pedido[];
  totalPendente: number; temAtrasado: boolean;
}

const spStyle: Record<string, { label: string; color: string }> = {
  em_aberto: { label: "Em aberto", color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/25" },
  atrasado:  { label: "Atrasado",  color: "bg-red-400/15 text-red-400 border-red-400/25" },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminCobrancaPage() {
  const [clientes,   setClientes]   = useState<ClienteCobranca[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState<{
    clienteId: string; nome: string; email: string;
    orcamentoIds?: string[];
  } | null>(null);
  const [invoiceMsg,     setInvoiceMsg]     = useState("");
  const [invoiceSending, setInvoiceSending] = useState(false);

  // Block/unblock
  const [blockingId, setBlockingId] = useState<string | null>(null);

  // Payment status inline update
  const [updatingPayId, setUpdatingPayId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/cobranca");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar cobranças");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function sendInvoice() {
    if (!invoiceModal) return;
    setInvoiceSending(true);
    try {
      const res  = await fetch("/api/admin/cobranca", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          clienteId:    invoiceModal.clienteId,
          orcamentoIds: invoiceModal.orcamentoIds,
          mensagem:     invoiceMsg || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Fatura enviada para ${invoiceModal.email} — ${data.enviados} pedido${data.enviados !== 1 ? "s" : ""}`);
      setInvoiceModal(null); setInvoiceMsg("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao enviar fatura");
    } finally { setInvoiceSending(false); }
  }

  async function updatePayStatus(orderId: string, status_pagamento: string) {
    setUpdatingPayId(orderId);
    try {
      const res = await fetch("/api/admin/historico", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: orderId, status_pagamento }),
      });
      if (!res.ok) { toast.error("Erro ao atualizar status de pagamento"); return; }
      setClientes((prev) =>
        prev.map((c) => ({
          ...c,
          pedidos: c.pedidos.map((p) => p.id === orderId ? { ...p, status_pagamento } : p),
        }))
      );
      toast.success("Status de pagamento atualizado.");
    } catch {
      toast.error("Erro de conexão");
    } finally { setUpdatingPayId(null); }
  }

  async function confirmAllPaid(clienteId: string, pedidos: Pedido[]) {
    for (const p of pedidos) {
      await fetch("/api/admin/historico", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: p.id, status_pagamento: "pago" }),
      });
    }
    await fetch("/api/admin/cobranca", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId, bloqueado: false }),
    });
    toast.success("Todos os pagamentos confirmados. Cliente desbloqueado.");
    await load();
  }

  async function toggleBlock(clienteId: string, bloqueado: boolean) {
    setBlockingId(clienteId);
    try {
      const res = await fetch("/api/admin/cobranca", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ clienteId, bloqueado }),
      });
      if (!res.ok) { toast.error("Erro ao alterar bloqueio"); return; }
      setClientes((prev) => prev.map((c) => c.id === clienteId ? { ...c, bloqueado } : c));
      toast.success(bloqueado ? "Cliente bloqueado para novos pedidos." : "Cliente desbloqueado.");
    } catch {
      toast.error("Erro de conexão");
    } finally { setBlockingId(null); }
  }

  const totalGeral = clientes.reduce((s, c) => s + c.totalPendente, 0);
  const atrasados  = clientes.filter((c) => c.temAtrasado).length;

  return (
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-white">Cobranças</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} com pendências
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {atrasados > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-400/15 text-red-400 border-red-400/25">
              <AlertCircle size={11} /> {atrasados} atrasado{atrasados !== 1 ? "s" : ""}
            </span>
          )}
          {totalGeral > 0 && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border bg-yellow-400/10 text-yellow-400 border-yellow-400/25">
              <DollarSign size={11} /> {fmt(totalGeral)} pendente
            </span>
          )}
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>


      {loading ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">Carregando...</div>
      ) : clientes.length === 0 ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center space-y-2">
          <CheckCircle size={28} className="text-green-500 mx-auto" />
          <p className="text-gray-500 text-sm">Nenhuma cobrança pendente. Tudo em dia!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clientes.map((c) => {
            const isOpen = expanded === c.id;
            return (
              <div key={c.id}
                className={`bg-dark-800 border rounded-2xl overflow-hidden ${c.temAtrasado ? "border-red-400/30" : c.bloqueado ? "border-orange-400/30" : "border-white/8"}`}
              >
                {/* Client row */}
                <button
                  onClick={() => setExpanded(isOpen ? null : c.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
                >
                  <div className="flex-1 min-w-0 mr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-bold text-white">{c.nome}</p>
                      {c.bloqueado && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-400/15 text-orange-400 border border-orange-400/25 flex items-center gap-0.5">
                          <Lock size={8} /> Bloqueado
                        </span>
                      )}
                      {c.temAtrasado && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/25 flex items-center gap-0.5">
                          <AlertCircle size={8} /> Atrasado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {c.cnpj} · {c.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">{c.pedidos.length} pedido{c.pedidos.length !== 1 ? "s" : ""}</p>
                      <p className="text-sm font-black text-white">{fmt(c.totalPendente)}</p>
                    </div>
                    {isOpen ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/8">

                    {/* Action bar */}
                    <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-white/2 border-b border-white/8">
                      <button
                        onClick={() => { setInvoiceModal({ clienteId: c.id, nome: c.nome, email: c.email }); setInvoiceMsg(""); }}
                        className="flex items-center gap-1.5 px-3 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all"
                      >
                        <Mail size={12} /> Enviar fatura geral
                      </button>
                      <button
                        onClick={() => toggleBlock(c.id, !c.bloqueado)}
                        disabled={blockingId === c.id}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-xl border transition-all disabled:opacity-50 ${
                          c.bloqueado
                            ? "bg-green-400/10 hover:bg-green-400/20 text-green-400 border-green-400/25"
                            : "bg-orange-400/10 hover:bg-orange-400/20 text-orange-400 border-orange-400/25"
                        }`}
                      >
                        {blockingId === c.id
                          ? <Loader2 size={12} className="animate-spin" />
                          : c.bloqueado ? <Unlock size={12} /> : <Lock size={12} />}
                        {c.bloqueado ? "Desbloquear cliente" : "Bloquear novos pedidos"}
                      </button>
                      <button
                        onClick={() => confirmAllPaid(c.id, c.pedidos)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-green-500/10 hover:bg-green-500/20 text-green-400 text-xs font-bold rounded-xl border border-green-500/25 transition-all"
                      >
                        <CheckCircle size={12} /> Confirmar todos pagos
                      </button>
                      <button
                        onClick={() => window.open(`/api/admin/imprimir?ids=${c.pedidos.map(p => p.id).join(",")}`, "_blank")}
                        className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-bold rounded-xl transition-all"
                      >
                        <Printer size={12} /> Imprimir
                      </button>
                      <a href={`/admin/orcamentos`} className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-bold rounded-xl transition-all">
                        <ExternalLink size={12} /> Ver pedidos
                      </a>
                    </div>

                    {/* Orders list */}
                    <div className="divide-y divide-white/5">
                      {c.pedidos.map((p) => {
                        const sp  = p.status_pagamento ?? "em_aberto";
                        const spc = spStyle[sp] ?? spStyle.em_aberto;
                        const itens = p.orcamento_itens ?? [];
                        const total = Number(p.total) || itens.reduce((sum, item) => sum + Number(item.valor_total ?? 0), 0);
                        const qtd = itens.reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);
                        return (
                          <div key={p.id} className="px-5 py-3">
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-bold text-white">#{p.numero}</span>
                                  {p.marca && <span className="text-[10px] text-gray-600 uppercase tracking-wide">{p.marca}</span>}
                                  {p.tipo_pedido && <span className="text-[10px] text-gray-500">{p.tipo_pedido === "dropshipping" ? "Dropshipping" : "Estoque"}</span>}
                                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${spc.color}`}>
                                    {sp === "atrasado" ? <AlertCircle size={9} /> : <Clock size={9} />}
                                    {spc.label}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                  {p.condicao_pagamento && ` · ${p.condicao_pagamento === "pix" ? "PIX" : `Boleto${p.prazo_boleto ? ` ${p.prazo_boleto}d` : ""}`}`}
                                  {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                                  {p.transportadora && ` · ${p.transportadora}`}
                                </p>
                              </div>
                              <p className="text-sm font-bold text-white flex-shrink-0">{fmt(total)}</p>
                              <button
                                onClick={() => { setInvoiceModal({ clienteId: c.id, nome: c.nome, email: c.email, orcamentoIds: [p.id] }); setInvoiceMsg(""); }}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-bold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all flex-shrink-0"
                              >
                                <Send size={9} /> Cobrar
                              </button>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {(["em_aberto", "pago", "atrasado"] as const).map((s) => {
                                  const sp2 = p.status_pagamento ?? "em_aberto";
                                  return (
                                    <button key={s} onClick={() => updatePayStatus(p.id, s)}
                                      disabled={updatingPayId === p.id || sp2 === s}
                                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all disabled:cursor-default ${
                                        sp2 === s
                                          ? s === "pago" ? "bg-green-400/15 text-green-400 border-green-400/25"
                                            : s === "atrasado" ? "bg-red-400/15 text-red-400 border-red-400/25"
                                            : "bg-yellow-400/15 text-yellow-400 border-yellow-400/25"
                                          : "bg-dark-900 border-white/8 text-gray-500 hover:text-white hover:border-white/20"
                                      }`}
                                    >
                                      {updatingPayId === p.id && sp2 !== s ? <Loader2 size={9} className="animate-spin inline" /> : s === "em_aberto" ? "Aberto" : s === "pago" ? "Pago" : "Atrasado"}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {itens.length > 0 && (
                              <div className="mt-3 rounded-xl border border-white/8 bg-dark-950/40 divide-y divide-white/5">
                                {itens.map((item) => (
                                  <div key={`${p.id}-${item.produto_sku}`} className="px-3 py-2 flex items-center gap-3 text-xs">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-white font-medium truncate">{item.produto_nome}</p>
                                      <p className="text-[10px] text-gray-600">{item.produto_sku}</p>
                                    </div>
                                    <span className="text-gray-400">{item.quantidade}x</span>
                                    <span className="text-gray-400">{fmt(Number(item.valor_unitario ?? 0))}</span>
                                    <span className="text-white font-semibold">{fmt(Number(item.valor_total ?? 0))}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                            {p.observacoes && <p className="mt-2 text-xs text-gray-500">Obs: {p.observacoes}</p>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Footer total */}
                    <div className="px-5 py-3 bg-white/3 border-t border-white/8 flex items-center justify-between">
                      <span className="text-xs text-gray-500">{c.pedidos.length} pedido{c.pedidos.length !== 1 ? "s" : ""} pendente{c.pedidos.length !== 1 ? "s" : ""}</span>
                      <span className="text-sm font-black text-white">{fmt(c.totalPendente)}</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Invoice Modal */}
      {invoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => { setInvoiceModal(null); setInvoiceMsg(""); }}
        >
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-sm font-bold text-white">Enviar Fatura</h3>
              <p className="text-xs text-gray-500 mt-1">
                Para: <span className="text-gray-300 font-semibold">{invoiceModal.nome}</span>
                {" "}·{" "}
                <span className="text-gray-400">{invoiceModal.email}</span>
              </p>
              {invoiceModal.orcamentoIds ? (
                <p className="text-xs text-blue-400 mt-1">Cobrança individual — 1 pedido</p>
              ) : (
                <p className="text-xs text-yellow-400 mt-1">Fatura completa — todos os pedidos em aberto</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Mensagem adicional (opcional)</label>
              <textarea
                value={invoiceMsg}
                onChange={(e) => setInvoiceMsg(e.target.value)}
                rows={3}
                placeholder="Ex: Prezado cliente, segue cobrança referente..."
                className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand/50 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setInvoiceModal(null); setInvoiceMsg(""); }}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm"
              >
                Cancelar
              </button>
              <button
                onClick={sendInvoice}
                disabled={invoiceSending}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {invoiceSending && <Loader2 size={13} className="animate-spin" />}
                <Send size={13} /> Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
