"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronUp, DollarSign, CheckCircle, CalendarDays, Loader2, Printer, Mail } from "lucide-react";

interface Pedido {
  id: string; numero: number;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  total: number; created_at: string;
  orcamento_itens?: { valor_total: number }[];
}
interface Semana {
  semana: string; label: string; pedidos: Pedido[]; total: number;
}
interface ClienteCobranca {
  id: string; nome: string; cnpj: string; email: string;
  bloqueado: boolean; semanas: Semana[]; totalPendente: number;
}

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function orderTotal(o: Pedido) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export default function MarcaCobrancaPage() {
  const [clientes,   setClientes]   = useState<ClienteCobranca[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Set<string>>(new Set());
  const [emailSending, setEmailSending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/marca/cobranca");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClientes(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar cobranças"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function confirmarPagamento(pedidos: Pedido[]) {
    const ids = pedidos.map((p) => p.id);
    setConfirming(new Set([...confirming, ...ids]));
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/marca/pedidos/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "confirmar_pagamento" }),
          }).then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error); }))
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) toast.error(`${failed} pedido(s) não puderam ser confirmados.`);
      else toast.success("Pagamentos confirmados!");
      await load();
    } finally {
      setConfirming((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
    }
  }

  async function sendBillingEmail(cliente: ClienteCobranca, sem: Semana) {
    const key = `${cliente.id}-${sem.semana}`;
    setEmailSending(key);
    try {
      const res = await fetch("/api/marca/cobranca/email", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          cliente_id: cliente.id,
          weekLabel:  sem.label,
          pedidos:    sem.pedidos.map(p => ({ numero: p.numero, created_at: p.created_at, total: orderTotal(p) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`Cobrança enviada para ${cliente.nome.split(" ")[0]}!`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao enviar email"); }
    finally { setEmailSending(null); }
  }

  const totalGeral = clientes.reduce((s, c) => s + c.totalPendente, 0);

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-sm font-bold text-white">Faturamento Semanal</h1>
            {!loading && (
              <p className="text-xs text-gray-500">
                {clientes.length} cliente{clientes.length !== 1 ? "s" : ""} com pedidos a pagar
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalGeral > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border bg-yellow-400/10 text-yellow-400 border-yellow-400/25">
                <DollarSign size={11} /> {fmt(totalGeral)} a receber
              </span>
            )}
            <button onClick={load} disabled={loading}
              className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">Carregando...</div>
        ) : clientes.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center space-y-2">
            <CheckCircle size={28} className="text-green-500 mx-auto" />
            <p className="text-white font-semibold text-sm">Nenhuma cobrança pendente!</p>
            <p className="text-xs text-gray-500">Todos os pedidos semanais estão quitados.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {clientes.map((c) => {
              const isOpen = expanded === c.id;
              const isAnyConfirming = c.semanas.some((s) => s.pedidos.some((p) => confirming.has(p.id)));
              return (
                <div key={c.id} className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : c.id)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-bold text-white">{c.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{c.cnpj} · {c.email}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-gray-500">{c.semanas.reduce((s, sem) => s + sem.pedidos.length, 0)} pedido{c.semanas.reduce((s, sem) => s + sem.pedidos.length, 0) !== 1 ? "s" : ""}</p>
                        <p className="text-sm font-black text-white">{fmt(c.totalPendente)}</p>
                      </div>
                      {isOpen ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/8 divide-y divide-white/5">
                      {c.semanas.map((sem) => {
                        const allConfirming = sem.pedidos.every((p) => confirming.has(p.id));
                        return (
                          <div key={sem.semana} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CalendarDays size={13} className="text-brand" />
                                <span className="text-xs font-bold text-white">{sem.label}</span>
                                <span className="text-xs text-gray-500">· {sem.pedidos.length} pedido{sem.pedidos.length !== 1 ? "s" : ""}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white">{fmt(sem.total)}</span>
                                <button
                                  onClick={() => sendBillingEmail(c, sem)}
                                  disabled={emailSending === `${c.id}-${sem.semana}`}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-bold text-blue-400 bg-blue-400/10 border border-blue-400/30 hover:bg-blue-400/20 hover:border-blue-400/50 rounded-lg transition-all disabled:opacity-50"
                                  title="Enviar cobrança por email"
                                >
                                  {emailSending === `${c.id}-${sem.semana}`
                                    ? <Loader2 size={11} className="animate-spin" />
                                    : <Mail size={11} />}
                                  Cobrar
                                </button>
                                <button
                                  onClick={() => window.open(`/api/marca/imprimir?ids=${sem.pedidos.map(p => p.id).join(",")}`, "_blank")}
                                  className="p-1.5 text-gray-500 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
                                  title="Imprimir semana"
                                >
                                  <Printer size={12} />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-1.5 pl-5">
                              {sem.pedidos.map((p) => {
                                const tot = orderTotal(p);
                                return (
                                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 bg-dark-900 rounded-xl border border-white/6">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm font-bold text-white">#{p.numero}</span>
                                      <span className="text-xs text-gray-500 ml-2">
                                        {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                      </span>
                                    </div>
                                    {tot > 0 && <span className="text-sm font-bold text-white flex-shrink-0">{fmt(tot)}</span>}
                                  </div>
                                );
                              })}
                            </div>

                            <button
                              onClick={() => confirmarPagamento(sem.pedidos)}
                              disabled={allConfirming || isAnyConfirming}
                              className="w-full py-2.5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                            >
                              {allConfirming
                                ? <><Loader2 size={12} className="animate-spin" /> Confirmando...</>
                                : <><CheckCircle size={12} /> Confirmar pagamento desta semana — {fmt(sem.total)}</>
                              }
                            </button>
                          </div>
                        );
                      })}

                      <div className="px-5 py-3 bg-white/2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Total a receber de {c.nome.split(" ")[0]}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-black text-white">{fmt(c.totalPendente)}</span>
                          <button
                            onClick={() => {
                              const ids = c.semanas.flatMap(s => s.pedidos.map(p => p.id)).join(",");
                              window.open(`/api/marca/imprimir?ids=${ids}`, "_blank");
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
                            title="Imprimir todos os pedidos do cliente"
                          >
                            <Printer size={11} /> Imprimir todos
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
