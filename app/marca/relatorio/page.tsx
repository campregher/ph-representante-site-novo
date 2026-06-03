"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { RefreshCw, TrendingUp, DollarSign, CheckCircle, AlertCircle, Package, Clock } from "lucide-react";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";

interface RelatData {
  totalPedidos: number; enviados: number; aprovados: number; finalizados: number; recusados: number;
  totalFaturado: number; pago: number; emAberto: number; atrasado: number;
  porMes: { mes: string; total: number; pedidos: number }[];
}

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function mesBR(ym: string) {
  const [y, m] = ym.split("-");
  const names = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${names[parseInt(m) - 1]}/${y.slice(2)}`;
}

export default function MarcaRelatorioPage() {
  const [data,    setData]    = useState<RelatData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/marca/relatorio");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar relatório"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const maxMes = Math.max(...(data?.porMes.map((m) => m.total) ?? [1]), 1);

  return (
    <div className="min-h-screen">
      <MarcaContentHeader
        title="Relatório Financeiro"
        actions={
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPIs financeiros */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Faturado", value: fmt(data?.totalFaturado ?? 0), icon: TrendingUp,  color: "text-white",      bg: "bg-white/5"      },
            { label: "Recebido",       value: fmt(data?.pago      ?? 0),     icon: CheckCircle, color: "text-green-400",  bg: "bg-green-400/8"  },
            { label: "A Receber",      value: fmt(data?.emAberto  ?? 0),     icon: DollarSign,  color: "text-yellow-400", bg: "bg-yellow-400/8" },
            { label: "Atrasado",       value: fmt(data?.atrasado  ?? 0),     icon: AlertCircle, color: "text-red-400",    bg: "bg-red-400/8"    },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="bg-dark-800 border border-white/8 rounded-2xl p-4">
              <div className={`inline-flex p-2 rounded-xl ${bg} mb-2`}>
                <Icon size={13} className={color} />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
              <p className={`text-base font-black ${color}`}>{loading ? "—" : value}</p>
            </div>
          ))}
        </div>

        {/* KPIs de pedidos */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "Total",       value: data?.totalPedidos, color: "text-white"      },
            { label: "Aguardando",  value: data?.enviados,     color: "text-yellow-400" },
            { label: "Aprovados",   value: data?.aprovados,    color: "text-green-400"  },
            { label: "Finalizados", value: data?.finalizados,  color: "text-indigo-400" },
            { label: "Recusados",   value: data?.recusados,    color: "text-red-400"    },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-dark-800 border border-white/8 rounded-2xl p-4 text-center">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
              <p className={`text-2xl font-black ${color}`}>{loading ? "—" : (value ?? 0)}</p>
            </div>
          ))}
        </div>

        {/* Barra de composição financeira */}
        {data && data.totalFaturado > 0 && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4">Composição do faturamento</h2>
            <div className="h-4 bg-dark-900 rounded-full overflow-hidden flex">
              {data.pago      > 0 && <div className="h-full bg-green-500"  style={{ width: `${(data.pago      / data.totalFaturado) * 100}%` }} title="Pago" />}
              {data.emAberto  > 0 && <div className="h-full bg-yellow-400" style={{ width: `${(data.emAberto  / data.totalFaturado) * 100}%` }} title="Em aberto" />}
              {data.atrasado  > 0 && <div className="h-full bg-red-500"    style={{ width: `${(data.atrasado  / data.totalFaturado) * 100}%` }} title="Atrasado" />}
            </div>
            <div className="flex gap-4 mt-3 flex-wrap text-xs">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 flex-shrink-0" /><span className="text-gray-400">Recebido</span><span className="text-white font-bold ml-1">{fmt(data.pago)}</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400 flex-shrink-0" /><span className="text-gray-400">A receber</span><span className="text-white font-bold ml-1">{fmt(data.emAberto)}</span></div>
              {data.atrasado > 0 && <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0" /><span className="text-gray-400">Atrasado</span><span className="text-white font-bold ml-1">{fmt(data.atrasado)}</span></div>}
            </div>
          </div>
        )}

        {/* Faturamento mensal */}
        {data && data.porMes.length > 0 && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <Package size={11} /> Faturamento mensal (finalizados)
            </h2>
            <div className="space-y-2">
              {data.porMes.slice().reverse().map(({ mes, total, pedidos }) => (
                <div key={mes}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-400">{mesBR(mes)}</span>
                    <div className="text-right">
                      <span className="text-xs font-black text-white">{fmt(total)}</span>
                      <span className="text-[10px] text-gray-600 ml-1.5">{pedidos}p</span>
                    </div>
                  </div>
                  <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
                    <div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(4, (total / maxMes) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <Clock size={20} className="text-gray-600 mx-auto mb-2 animate-spin" />
            <p className="text-gray-500 text-sm">Carregando relatório...</p>
          </div>
        )}
      </div>
    </div>
  );
}
