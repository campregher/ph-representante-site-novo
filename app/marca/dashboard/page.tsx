"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { RefreshCw, ShoppingBag, CheckCircle, Truck, Clock, TrendingUp, DollarSign, ChevronRight, PackageCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";

interface DashboardData {
  aguardando: number;
  atrasados: number;
  emSeparacao: number;
  emEnvio: number;
  totalPedidos: number;
  totalFaturado: number;
  aReceber: number;
  recent: { id: string; numero: number; status: string; total: number; created_at: string; cliente: string }[];
}

const statusCfg: Record<string, { label: string; color: string }> = {
  enviado:      { label: "Aguardando aprovação", color: "text-yellow-400" },
  em_separacao: { label: "Em separação",         color: "text-blue-400"   },
  a_pagar:      { label: "A pagar",              color: "text-orange-400" },
  pago:         { label: "Pago",                 color: "text-emerald-400"},
  recusado:     { label: "Recusado",             color: "text-red-400"    },
  rascunho:     { label: "Rascunho",             color: "text-gray-500"   },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MarcaDashboardPage() {
  const [data,    setData]    = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/marca/dashboard");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar dados"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const kpis = [
    {
      label: "Aguardando aprovação",
      value: data?.aguardando ?? 0,
      icon:  Clock,
      color: "text-yellow-400",
      bg:    "bg-yellow-400/8",
      href:  "/marca/pedidos?status=enviado",
    },
    {
      label: "Em separação",
      value: data?.emSeparacao ?? 0,
      icon:  PackageCheck,
      color: "text-blue-400",
      bg:    "bg-blue-400/8",
      href:  "/marca/pedidos?status=em_separacao",
    },
    {
      label: "Em envio / A pagar",
      value: data?.emEnvio ?? 0,
      icon:  Truck,
      color: "text-orange-400",
      bg:    "bg-orange-400/8",
      href:  "/marca/pedidos?status=a_pagar",
    },
    {
      label: "Total de pedidos",
      value: data?.totalPedidos ?? 0,
      icon:  ShoppingBag,
      color: "text-gray-400",
      bg:    "bg-white/5",
      href:  "/marca/pedidos",
    },
  ];

  const financial = [
    { label: "Total Faturado", value: data?.totalFaturado ?? 0, icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-400/8" },
    { label: "A Receber",      value: data?.aReceber ?? 0,      icon: DollarSign, color: "text-yellow-400",  bg: "bg-yellow-400/8"  },
    { label: "Aprovados + Env.", value: (data?.emSeparacao ?? 0) + (data?.emEnvio ?? 0), icon: CheckCircle, color: "text-blue-400", bg: "bg-blue-400/8", isCount: true },
  ];

  return (
    <div className="min-h-screen">
      <MarcaContentHeader
        title="Dashboard"
        actions={
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* Alerta: pedidos sem resposta >24h */}
        {!loading && (data?.atrasados ?? 0) > 0 && (
          <Link href="/marca/pedidos?status=enviado"
            className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl hover:bg-red-500/15 transition-all"
          >
            <AlertCircle size={16} className="text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-bold text-red-400">
                {data!.atrasados} pedido{data!.atrasados !== 1 ? "s" : ""} sem resposta há mais de 24h
              </p>
              <p className="text-xs text-red-400/70 mt-0.5">Clique para ver e responder agora</p>
            </div>
            <ChevronRight size={14} className="text-red-400 flex-shrink-0" />
          </Link>
        )}

        {/* KPIs operacionais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {kpis.map(({ label, value, icon: Icon, color, bg, href }) => (
            <Link key={label} href={href}
              className="bg-dark-800 border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all group"
            >
              <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
                <Icon size={13} className={color} />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5 leading-tight">{label}</p>
              <p className={`text-2xl font-black ${color} group-hover:opacity-90 transition-opacity`}>
                {loading ? "—" : value}
              </p>
            </Link>
          ))}
        </div>

        {/* KPIs financeiros */}
        <div className="grid grid-cols-3 gap-3">
          {financial.map(({ label, value, icon: Icon, color, bg, isCount }) => (
            <div key={label} className="bg-dark-800 border border-white/8 rounded-2xl p-4">
              <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
                <Icon size={13} className={color} />
              </div>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
              <p className={`font-black ${color} ${isCount ? "text-2xl" : "text-base"}`}>
                {loading ? "—" : isCount ? value : fmt(value)}
              </p>
            </div>
          ))}
        </div>

        {/* Pedidos recentes */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/8 flex items-center justify-between">
            <h2 className="text-sm font-bold text-white">Pedidos recentes</h2>
            <Link href="/marca/pedidos" className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1">
              Ver todos <ChevronRight size={11} />
            </Link>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Carregando...</div>
          ) : !data?.recent.length ? (
            <div className="p-8 text-center text-gray-500 text-sm">Nenhum pedido ainda.</div>
          ) : (
            <div className="divide-y divide-white/5">
              {data.recent.map((o) => {
                const sc = statusCfg[o.status] ?? { label: o.status, color: "text-gray-400" };
                return (
                  <Link key={o.id} href={`/marca/pedidos/${o.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">#{o.numero}</p>
                        <p className="text-xs text-gray-500 truncate">{o.cliente}</p>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5">
                        {new Date(o.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-semibold ${sc.color}`}>{sc.label}</p>
                      {o.total > 0 && <p className="text-xs text-white font-bold mt-0.5">{fmt(o.total)}</p>}
                    </div>
                    <ChevronRight size={13} className="text-gray-600 flex-shrink-0" />
                  </Link>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
