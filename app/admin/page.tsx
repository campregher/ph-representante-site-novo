"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  RefreshCw, TrendingUp, DollarSign, AlertCircle, Users,
  Package, Clock, BarChart3,
} from "lucide-react";

interface DashData {
  totalVendido: number;
  aReceber: number;
  atrasado: number;
  totalClientes: number;
  pendentes: number;
  pedidosAprovados: number;
  porMarca: { marca: string; total: number; pedidos: number }[];
  topProdutos: { sku: string; nome: string; quantidade: number; total: number }[];
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function AdminDashboard() {
  const [data,    setData]    = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/admin/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar dashboard");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const maxMarca = data?.porMarca[0]?.total ?? 1;
  const maxProd  = data?.topProdutos[0]?.quantidade ?? 1;

  return (
    <div className="p-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Dashboard</h1>
          <p className="text-xs text-gray-500 mt-0.5">Visão geral de vendas e performance</p>
        </div>
        <button onClick={load} disabled={loading}
          className="ml-auto p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">
          <BarChart3 size={28} className="mx-auto mb-3 text-gray-700" />
          Carregando métricas...
        </div>
      ) : data && (
        <div className="space-y-5">

          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {([
              {
                label: "Total Vendido",
                value: fmt(data.totalVendido),
                sub:   `${data.pedidosAprovados} pedido${data.pedidosAprovados !== 1 ? "s" : ""} aprovado${data.pedidosAprovados !== 1 ? "s" : ""}`,
                icon:  TrendingUp,
                color: "text-green-400",
                bg:    "bg-green-400/8",
              },
              {
                label: "A Receber",
                value: fmt(data.aReceber),
                sub:   "em aberto ou atrasado",
                icon:  DollarSign,
                color: "text-yellow-400",
                bg:    "bg-yellow-400/8",
              },
              {
                label: "Atrasado",
                value: fmt(data.atrasado),
                sub:   "pagamentos vencidos",
                icon:  AlertCircle,
                color: data.atrasado > 0 ? "text-red-400" : "text-gray-600",
                bg:    data.atrasado > 0 ? "bg-red-400/8"  : "bg-white/4",
              },
              {
                label: "Clientes Ativos",
                value: String(data.totalClientes),
                sub:   `${data.pendentes} pedido${data.pendentes !== 1 ? "s" : ""} pendente${data.pendentes !== 1 ? "s" : ""}`,
                icon:  data.pendentes > 0 ? Clock : Users,
                color: data.pendentes > 0 ? "text-yellow-400" : "text-blue-400",
                bg:    data.pendentes > 0 ? "bg-yellow-400/8" : "bg-blue-400/8",
              },
            ] as const).map(({ label, value, sub, icon: Icon, color, bg }) => (
              <div key={label} className="bg-dark-800 border border-white/8 rounded-2xl p-4">
                <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
                  <Icon size={14} className={color} />
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">{label}</p>
                <p className={`text-lg font-black leading-tight ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-600 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          {/* Vendas por Marca + Top Produtos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Por Marca */}
            <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8">
                <h2 className="text-sm font-bold text-white">Vendas por Marca</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data.porMarca.length} marca{data.porMarca.length !== 1 ? "s" : ""} · pedidos aprovados
                </p>
              </div>
              {data.porMarca.length === 0 ? (
                <div className="p-10 text-center text-gray-600 text-xs">Sem dados ainda</div>
              ) : (
                <div className="p-4 space-y-4">
                  {data.porMarca.slice(0, 8).map(({ marca, total, pedidos }) => (
                    <div key={marca}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-white truncate max-w-[160px]">{marca}</span>
                        <div className="text-right flex-shrink-0 ml-2">
                          <span className="text-xs font-black text-white">{fmt(total)}</span>
                          <span className="text-[10px] text-gray-600 ml-1.5">
                            {pedidos} ped.
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-dark-900 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand rounded-full"
                          style={{ width: `${Math.max(4, (total / maxMarca) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top Produtos */}
            <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-white/8">
                <h2 className="text-sm font-bold text-white">Produtos Mais Vendidos</h2>
                <p className="text-xs text-gray-500 mt-0.5">por quantidade · pedidos aprovados</p>
              </div>
              {data.topProdutos.length === 0 ? (
                <div className="p-10 text-center text-gray-600 text-xs">Sem dados ainda</div>
              ) : (
                <div className="p-4 space-y-4">
                  {data.topProdutos.slice(0, 8).map(({ sku, nome, quantidade, total }, idx) => (
                    <div key={sku}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-gray-600 w-4 text-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-semibold text-white flex-1 truncate">{nome}</span>
                        <span className="text-xs font-black text-white flex-shrink-0">{quantidade}×</span>
                      </div>
                      <div className="ml-6 flex items-center gap-2">
                        <div className="flex-1 h-2 bg-dark-900 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${Math.max(4, (quantidade / maxProd) * 100)}%` }}
                          />
                        </div>
                        {total > 0 && (
                          <span className="text-[10px] text-gray-600 flex-shrink-0">{fmt(total)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Pendentes alert */}
          {data.pendentes > 0 && (
            <div className="flex items-center gap-3 px-4 py-3 bg-yellow-400/8 border border-yellow-400/20 rounded-2xl">
              <Package size={14} className="text-yellow-400 flex-shrink-0" />
              <p className="text-xs text-yellow-300">
                <span className="font-bold">{data.pendentes} pedido{data.pendentes !== 1 ? "s" : ""}</span>
                {" "}aguardando análise em{" "}
                <a href="/admin/orcamentos" className="underline hover:text-yellow-200 transition-colors">Orçamentos</a>.
              </p>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
