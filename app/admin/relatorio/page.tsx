"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, CheckCircle, Clock, AlertCircle, DollarSign } from "lucide-react";

interface StatusEntry { count: number; valor: number }

interface MarcaRelatorio {
  slug: string;
  name: string;
  total_count: number;
  total_valor: number;
  por_status: Record<string, StatusEntry>;
  pago: StatusEntry;
  em_aberto: StatusEntry;
  atrasado: StatusEntry;
}

interface Totais {
  pago: number;
  em_aberto: number;
  atrasado: number;
  total: number;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const statusCfg: Record<string, { label: string; color: string; dot: string }> = {
  rascunho:  { label: "Rascunho",   color: "text-gray-400",   dot: "bg-gray-500"   },
  enviado:   { label: "Aguardando", color: "text-yellow-400", dot: "bg-yellow-400" },
  aprovado:  { label: "Aprovado",   color: "text-green-400",  dot: "bg-green-500"  },
  finalizado:{ label: "Finalizado", color: "text-indigo-400", dot: "bg-indigo-500" },
  recusado:  { label: "Recusado",   color: "text-red-400",    dot: "bg-red-500"    },
};

export default function AdminRelatorioPage() {
  const [marcas,  setMarcas]  = useState<MarcaRelatorio[]>([]);
  const [totais,  setTotais]  = useState<Totais | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/relatorio");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMarcas(data.marcas ?? []);
      setTotais(data.totais ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar relatório");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Relatório por Marca</h1>
          <p className="text-xs text-gray-500 mt-0.5">Valores pagos e pendentes por fornecedor</p>
        </div>
        <button onClick={load} disabled={loading}
          className="ml-auto p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* KPIs gerais */}
      {totais && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-dark-800 border border-white/8 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp size={13} className="text-gray-500" />
              <p className="text-[11px] text-gray-500 uppercase tracking-wide">Total geral</p>
            </div>
            <p className="text-lg font-black text-white">{fmt(totais.total)}</p>
          </div>
          <div className="bg-dark-800 border border-green-400/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle size={13} className="text-green-400" />
              <p className="text-[11px] text-green-400/70 uppercase tracking-wide">Pago</p>
            </div>
            <p className="text-lg font-black text-green-400">{fmt(totais.pago)}</p>
          </div>
          <div className="bg-dark-800 border border-yellow-400/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={13} className="text-yellow-400" />
              <p className="text-[11px] text-yellow-400/70 uppercase tracking-wide">Em aberto</p>
            </div>
            <p className="text-lg font-black text-yellow-400">{fmt(totais.em_aberto)}</p>
          </div>
          <div className="bg-dark-800 border border-red-400/20 rounded-2xl px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle size={13} className="text-red-400" />
              <p className="text-[11px] text-red-400/70 uppercase tracking-wide">Atrasado</p>
            </div>
            <p className="text-lg font-black text-red-400">{fmt(totais.atrasado)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">Carregando...</div>
      ) : marcas.length === 0 ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">
          Nenhum dado encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {marcas.map((m) => {
            const totalPendente = m.em_aberto.valor + m.atrasado.valor;
            const pctPago = m.total_valor > 0 ? Math.round((m.pago.valor / m.total_valor) * 100) : 0;

            return (
              <div key={m.slug} className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">

                {/* Header da marca */}
                <div className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <p className="text-sm font-black text-white">{m.name}</p>
                    <p className="text-[11px] text-gray-600 mt-0.5 uppercase tracking-wide">{m.slug}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-500">{m.total_count} pedido{m.total_count !== 1 ? "s" : ""}</p>
                    <p className="text-sm font-black text-white">{fmt(m.total_valor)}</p>
                  </div>
                </div>

                {/* Barra de progresso pago vs pendente */}
                {m.total_valor > 0 && (
                  <div className="px-5 pb-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className="flex-1 h-1.5 bg-dark-700 rounded-full overflow-hidden flex">
                        <div className="bg-green-500 h-full transition-all" style={{ width: `${pctPago}%` }} />
                        {m.atrasado.valor > 0 && (
                          <div className="bg-red-500 h-full transition-all"
                            style={{ width: `${Math.round((m.atrasado.valor / m.total_valor) * 100)}%` }}
                          />
                        )}
                        {m.em_aberto.valor > 0 && (
                          <div className="bg-yellow-400 h-full transition-all"
                            style={{ width: `${Math.round((m.em_aberto.valor / m.total_valor) * 100)}%` }}
                          />
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">{pctPago}% pago</span>
                    </div>
                  </div>
                )}

                {/* Pagamentos (só aprovados/finalizados) */}
                {(m.pago.count + m.em_aberto.count + m.atrasado.count) > 0 && (
                  <div className="px-5 pb-4 grid grid-cols-3 gap-2">
                    {m.pago.count > 0 && (
                      <div className="bg-green-400/8 border border-green-400/20 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <CheckCircle size={10} className="text-green-400" />
                          <p className="text-[10px] text-green-400/70">Pago</p>
                        </div>
                        <p className="text-xs font-black text-green-400">{fmt(m.pago.valor)}</p>
                        <p className="text-[10px] text-green-400/50 mt-0.5">{m.pago.count} pedido{m.pago.count !== 1 ? "s" : ""}</p>
                      </div>
                    )}
                    {m.em_aberto.count > 0 && (
                      <div className="bg-yellow-400/8 border border-yellow-400/20 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <Clock size={10} className="text-yellow-400" />
                          <p className="text-[10px] text-yellow-400/70">Em aberto</p>
                        </div>
                        <p className="text-xs font-black text-yellow-400">{fmt(m.em_aberto.valor)}</p>
                        <p className="text-[10px] text-yellow-400/50 mt-0.5">{m.em_aberto.count} pedido{m.em_aberto.count !== 1 ? "s" : ""}</p>
                      </div>
                    )}
                    {m.atrasado.count > 0 && (
                      <div className="bg-red-400/8 border border-red-400/20 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-1 mb-1">
                          <AlertCircle size={10} className="text-red-400" />
                          <p className="text-[10px] text-red-400/70">Atrasado</p>
                        </div>
                        <p className="text-xs font-black text-red-400">{fmt(m.atrasado.valor)}</p>
                        <p className="text-[10px] text-red-400/50 mt-0.5">{m.atrasado.count} pedido{m.atrasado.count !== 1 ? "s" : ""}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Status dos pedidos */}
                <div className="border-t border-white/5 px-5 py-3 flex items-center gap-4 flex-wrap">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wide mr-1">Status</p>
                  {Object.entries(statusCfg).map(([key, cfg]) => {
                    const st = m.por_status[key];
                    if (!st?.count) return null;
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfg.dot}`} />
                        <span className={`text-[11px] font-semibold ${cfg.color}`}>
                          {st.count} {cfg.label.toLowerCase()}
                        </span>
                        {st.valor > 0 && (
                          <span className="text-[10px] text-gray-600">({fmt(st.valor)})</span>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}

          {/* Rodapé com total geral */}
          {totais && (
            <div className="bg-dark-800 border border-white/8 rounded-2xl px-5 py-4 flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <DollarSign size={15} className="text-gray-500" />
                <p className="text-sm font-bold text-gray-400">Total consolidado — {marcas.length} marca{marcas.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                {totais.pago > 0 && (
                  <span className="text-sm font-black text-green-400">{fmt(totais.pago)} <span className="text-xs font-normal text-green-400/60">pago</span></span>
                )}
                {totais.em_aberto > 0 && (
                  <span className="text-sm font-black text-yellow-400">{fmt(totais.em_aberto)} <span className="text-xs font-normal text-yellow-400/60">em aberto</span></span>
                )}
                {totais.atrasado > 0 && (
                  <span className="text-sm font-black text-red-400">{fmt(totais.atrasado)} <span className="text-xs font-normal text-red-400/60">atrasado</span></span>
                )}
                <span className="text-sm font-black text-white">{fmt(totais.total)} <span className="text-xs font-normal text-gray-500">total</span></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
