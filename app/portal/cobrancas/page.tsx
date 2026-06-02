"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw, ChevronDown, ChevronUp, DollarSign, CheckCircle, CalendarDays } from "lucide-react";
import Link from "next/link";

interface Pedido {
  id: string; numero: number; total: number; created_at: string;
  orcamento_itens?: { valor_total: number }[];
}
interface Semana {
  semana: string; label: string; pedidos: Pedido[]; total: number;
}
interface MarcaCobranca {
  slug: string; nome: string; semanas: Semana[]; totalPendente: number;
}

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function orderTotal(o: Pedido) {
  return Number(o.total) || (o.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export default function PortalCobrancasPage() {
  const [marcas,   setMarcas]   = useState<MarcaCobranca[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal/cobrancas");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMarcas(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar cobranças"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const totalGeral = marcas.reduce((s, m) => s + m.totalPendente, 0);

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-sm font-bold text-white">Faturamento Semanal</h1>
            {!loading && (
              <p className="text-xs text-gray-500">
                Pedidos dropshipping aguardando pagamento
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {totalGeral > 0 && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border bg-yellow-400/10 text-yellow-400 border-yellow-400/25">
                <DollarSign size={11} /> {fmt(totalGeral)} a pagar
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
        ) : marcas.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center space-y-2">
            <CheckCircle size={28} className="text-green-500 mx-auto" />
            <p className="text-white font-semibold text-sm">Nenhuma cobrança pendente!</p>
            <p className="text-xs text-gray-500">Todos os seus pedidos semanais estão em dia.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-dark-800 border border-yellow-400/20 rounded-2xl px-5 py-3.5">
              <p className="text-xs text-yellow-400 font-semibold">Como funciona o pagamento semanal?</p>
              <p className="text-xs text-gray-500 mt-1">
                Todos os pedidos dropshipping com pagamento semanal são agrupados por semana (segunda a sexta).
                O pagamento de cada semana é realizado às sextas-feiras via PIX para a marca.
              </p>
            </div>

            {marcas.map((m) => {
              const isOpen = expanded === m.slug;
              const totalPedidos = m.semanas.reduce((s, sem) => s + sem.pedidos.length, 0);
              return (
                <div key={m.slug} className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
                  <button
                    onClick={() => setExpanded(isOpen ? null : m.slug)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-bold text-white">{m.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{totalPedidos} pedido{totalPedidos !== 1 ? "s" : ""} pendente{totalPedidos !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-4 flex-shrink-0">
                      <p className="text-sm font-black text-yellow-400">{fmt(m.totalPendente)}</p>
                      {isOpen ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                    </div>
                  </button>

                  {isOpen && (
                    <div className="border-t border-white/8 divide-y divide-white/5">
                      {m.semanas.map((sem) => (
                        <div key={sem.semana} className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CalendarDays size={13} className="text-brand" />
                              <span className="text-xs font-bold text-white">{sem.label}</span>
                              <span className="text-xs text-gray-500">· {sem.pedidos.length} pedido{sem.pedidos.length !== 1 ? "s" : ""}</span>
                            </div>
                            <span className="text-sm font-black text-white">{fmt(sem.total)}</span>
                          </div>

                          <div className="space-y-1.5 pl-5">
                            {sem.pedidos.map((p) => {
                              const tot = orderTotal(p);
                              return (
                                <Link key={p.id} href={`/portal/orcamentos/${p.id}`}
                                  className="flex items-center gap-3 px-3 py-2 bg-dark-900 rounded-xl border border-white/6 hover:border-white/15 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm font-bold text-white">#{p.numero}</span>
                                    <span className="text-xs text-gray-500 ml-2">
                                      {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                    </span>
                                  </div>
                                  {tot > 0 && <span className="text-sm font-bold text-white flex-shrink-0">{fmt(tot)}</span>}
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}

                      <div className="px-5 py-3 bg-white/2 flex items-center justify-between">
                        <span className="text-xs text-gray-500">Total a pagar para {m.nome}</span>
                        <span className="text-sm font-black text-yellow-400">{fmt(m.totalPendente)}</span>
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
