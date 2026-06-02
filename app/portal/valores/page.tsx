"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import Image from "next/image";
import Link from "next/link";
import {
  RefreshCw, ChevronDown, ChevronUp, Printer, ExternalLink,
  BarChart3, TrendingUp, Package, DollarSign,
} from "lucide-react";

interface Item  { valor_total: number; quantidade: number }
interface Pedido {
  id: string; numero: number; status: string; status_pagamento: string | null;
  marca: string | null; total: number;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  created_at: string; orcamento_itens: Item[];
}
interface Brand { slug: string; name: string; logo_url: string | null }

type Filtro = "todos" | "rascunho" | "enviado" | "aprovado" | "finalizado" | "recusado";

const statusCfg: Record<string, { label: string; color: string; dot: string }> = {
  rascunho:  { label: "Rascunho",   color: "text-gray-400",   dot: "bg-gray-500"   },
  enviado:   { label: "Aguardando", color: "text-yellow-400", dot: "bg-yellow-400" },
  aprovado:  { label: "Aprovado",   color: "text-green-400",  dot: "bg-green-500"  },
  finalizado:{ label: "Finalizado", color: "text-indigo-400", dot: "bg-indigo-500" },
  recusado:  { label: "Recusado",   color: "text-red-400",    dot: "bg-red-500"    },
};

const pagCfg: Record<string, { label: string; color: string }> = {
  em_aberto: { label: "Em aberto", color: "text-yellow-400" },
  pago:      { label: "Pago",      color: "text-green-400"  },
  atrasado:  { label: "Atrasado",  color: "text-red-400"    },
};

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function pedidoTotal(p: Pedido) {
  return Number(p.total) || (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export default function ValoresPage() {
  const [pedidos,  setPedidos]  = useState<Pedido[]>([]);
  const [brands,   setBrands]   = useState<Record<string, Brand>>({});
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState<Filtro>("todos");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal/valores");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPedidos(data.orders ?? []);
      setBrands(data.brands ?? {});
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar dados");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length };
    for (const p of pedidos) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [pedidos]);

  const filtered = useMemo(() =>
    filtro === "todos" ? pedidos : pedidos.filter((p) => p.status === filtro),
  [pedidos, filtro]);

  const byMarca = useMemo(() => {
    const map = new Map<string, Pedido[]>();
    for (const p of filtered) {
      const key = p.marca ?? "__sem__";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries())
      .map(([slug, ps]) => ({
        slug,
        brand: brands[slug],
        pedidos: ps,
        total: ps.reduce((s, p) => s + pedidoTotal(p), 0),
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, brands]);

  const totalGeral   = byMarca.reduce((s, m) => s + m.total, 0);
  const totalPedidos = filtered.length;

  const filtros: { key: Filtro; label: string }[] = [
    { key: "todos",     label: `Todos (${counts.todos ?? 0})`       },
    { key: "enviado",   label: `Aguardando (${counts.enviado ?? 0})` },
    { key: "aprovado",  label: `Aprovados (${counts.aprovado ?? 0})` },
    { key: "finalizado",label: `Finalizados (${counts.finalizado ?? 0})` },
    { key: "recusado",  label: `Recusados (${counts.recusado ?? 0})` },
    { key: "rascunho",  label: `Rascunhos (${counts.rascunho ?? 0})` },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-bold text-white">Valores por Marca</h1>
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-5">

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-4">
            <div className="inline-flex p-2 rounded-xl bg-green-400/8 mb-2">
              <TrendingUp size={13} className="text-green-400" />
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Total</p>
            <p className="text-base font-black text-green-400">{fmt(totalGeral)}</p>
          </div>
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-4">
            <div className="inline-flex p-2 rounded-xl bg-blue-400/8 mb-2">
              <Package size={13} className="text-blue-400" />
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Pedidos</p>
            <p className="text-base font-black text-blue-400">{totalPedidos}</p>
          </div>
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-4">
            <div className="inline-flex p-2 rounded-xl bg-white/5 mb-2">
              <BarChart3 size={13} className="text-gray-400" />
            </div>
            <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">Marcas</p>
            <p className="text-base font-black text-white">{byMarca.length}</p>
          </div>
        </div>

        {/* Tabs de status */}
        <div className="flex gap-2 flex-wrap">
          {filtros.map((f) => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                filtro === f.key
                  ? "bg-brand border-brand text-white"
                  : "bg-dark-800 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Lista por marca */}
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">Carregando...</div>
        ) : byMarca.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">
            Nenhum pedido encontrado.
          </div>
        ) : (
          <div className="space-y-3">
            {byMarca.map(({ slug, brand, pedidos: ps, total }) => {
              const isOpen = expanded === slug;
              const maxT   = ps[0] ? pedidoTotal(ps[0]) : 1;

              return (
                <div key={slug} className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">

                  {/* Cabeçalho da marca */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : slug)}
                    className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-white/3 transition-colors"
                  >
                    <div className="w-12 h-9 flex-shrink-0 flex items-center justify-center bg-dark-900 border border-white/8 rounded-lg px-1.5">
                      {brand?.logo_url ? (
                        <Image src={brand.logo_url} alt={brand.name} width={44} height={24} className="object-contain h-5 w-auto opacity-80" />
                      ) : (
                        <BarChart3 size={13} className="text-gray-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white">{brand?.name ?? slug}</p>
                      <p className="text-xs text-gray-500">{ps.length} pedido{ps.length !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-black text-white">{fmt(total)}</p>
                      {isOpen ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                    </div>
                  </button>

                  {/* Barra proporcional */}
                  {!isOpen && total > 0 && (
                    <div className="px-5 pb-3">
                      <div className="h-1 bg-dark-900 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: "100%" }} />
                      </div>
                    </div>
                  )}

                  {/* Pedidos expandidos */}
                  {isOpen && (
                    <div className="border-t border-white/8 divide-y divide-white/5">

                      {/* Ação imprimir todos */}
                      <div className="px-5 py-3 bg-white/2 flex items-center gap-2">
                        <button
                          onClick={() => window.open(`/api/portal/imprimir?ids=${ps.map((p) => p.id).join(",")}`, "_blank")}
                          className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
                        >
                          <Printer size={12} /> Imprimir todos de {brand?.name ?? slug}
                        </button>
                      </div>

                      {ps.map((p) => {
                        const st  = statusCfg[p.status] ?? statusCfg.enviado;
                        const pg  = pagCfg[p.status_pagamento ?? "em_aberto"] ?? pagCfg.em_aberto;
                        const tot = pedidoTotal(p);
                        const qtd = (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.quantidade ?? 0), 0);
                        const isAprovado = p.status === "aprovado" || p.status === "finalizado";

                        return (
                          <div key={p.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">#{p.numero}</span>
                                <span className={`text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                                {isAprovado && (
                                  <span className={`text-[10px] font-semibold ${pg.color}`}>· {pg.label}</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                {p.condicao_pagamento && ` · ${p.condicao_pagamento === "pix" ? "PIX" : `Boleto${p.prazo_boleto ? ` ${p.prazo_boleto}d` : ""}`}`}
                                {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                              </p>
                            </div>
                            {tot > 0 && <p className="text-sm font-bold text-white flex-shrink-0">{fmt(tot)}</p>}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <Link href={`/portal/orcamentos/${p.id}`}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
                              >
                                <ExternalLink size={9} /> Detalhar
                              </Link>
                              <button
                                onClick={() => window.open(`/api/portal/imprimir?ids=${p.id}`, "_blank")}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
                              >
                                <Printer size={9} /> Imprimir
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {/* Subtotal */}
                      <div className="px-5 py-3 bg-white/2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <DollarSign size={11} className="text-gray-500" />
                          <span className="text-xs text-gray-500">{ps.length} pedido{ps.length !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="text-sm font-black text-white">{fmt(total)}</span>
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
