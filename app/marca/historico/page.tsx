"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  RefreshCw, Printer, ChevronRight, CreditCard, CheckCircle,
  XCircle, Clock, Loader2, FileText,
} from "lucide-react";

interface Pedido {
  id: string; numero: number; status: string; tipo_pedido: string | null;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  total: number; created_at: string;
  orcamento_itens: { quantidade: number; valor_total: number }[];
  clientes: { razao_social: string; cnpj: string; cidade: string | null; estado: string | null } | null;
}

const statusCfg: Record<string, { label: string; dot: string; color: string; icon: typeof Clock }> = {
  a_pagar:  { label: "A pagar",  dot: "bg-orange-500", color: "text-orange-400 bg-orange-400/10 border-orange-400/20", icon: CreditCard  },
  pago:     { label: "Pago",     dot: "bg-emerald-500",color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: CheckCircle },
  recusado: { label: "Recusado", dot: "bg-red-500",     color: "text-red-400 bg-red-400/10 border-red-400/20",         icon: XCircle    },
};

type Tab = "todos" | "a_pagar" | "pago" | "recusado";

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function orderTotal(p: Pedido) {
  return Number(p.total) || (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

export default function MarcaHistoricoPage() {
  const [pedidos,  setPedidos]  = useState<Pedido[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [tab,      setTab]      = useState<Tab>("todos");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    setSelected(new Set());
    try {
      const res  = await fetch("/api/marca/historico");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPedidos(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar histórico"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { setSelected(new Set()); }, [tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length };
    for (const p of pedidos) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [pedidos]);

  const filtered = useMemo(() =>
    tab === "todos" ? pedidos : pedidos.filter((p) => p.status === tab),
  [pedidos, tab]);

  const totalFiltered = useMemo(
    () => filtered.reduce((s, p) => s + orderTotal(p), 0),
    [filtered],
  );

  const totalSelected = useMemo(
    () => filtered.filter((p) => selected.has(p.id)).reduce((s, p) => s + orderTotal(p), 0),
    [filtered, selected],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  }

  function printSelected() {
    if (selected.size === 0) return;
    const ids = [...selected].join(",");
    window.open(`/api/marca/imprimir?ids=${ids}`, "_blank");
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "todos",    label: `Todos (${counts.todos ?? 0})`              },
    { key: "a_pagar",  label: `A pagar (${counts.a_pagar ?? 0})`          },
    { key: "pago",     label: `Pagos (${counts.pago ?? 0})`               },
    { key: "recusado", label: `Recusados (${counts.recusado ?? 0})`       },
  ];

  return (
    <div className="min-h-screen pb-28">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-bold text-white">Histórico de Cobranças</h1>
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                tab === t.key
                  ? "bg-brand border-brand text-white"
                  : "bg-dark-800 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Seleção em massa */}
        {filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-800 border border-white/8 rounded-xl">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              className="accent-brand w-4 h-4 flex-shrink-0"
            />
            <span className="text-xs text-gray-400 flex-1">
              {selected.size === 0
                ? "Selecionar todos"
                : `${selected.size} selecionado${selected.size !== 1 ? "s" : ""} — ${fmt(totalSelected)}`}
            </span>
            {selected.size > 0 && (
              <button
                onClick={printSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-300 bg-dark-700 border border-white/10 hover:border-white/20 hover:text-white rounded-lg transition-all"
              >
                <Printer size={12} /> Imprimir selecionados
              </button>
            )}
          </div>
        )}

        {/* Lista */}
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <Loader2 size={20} className="text-gray-600 animate-spin mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <FileText size={28} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhum pedido nesta categoria.</p>
          </div>
        ) : (
          <>
            <div className="bg-dark-800 border border-white/8 rounded-2xl divide-y divide-white/5">
              {filtered.map((p) => {
                const sc  = statusCfg[p.status] ?? statusCfg.a_pagar;
                const tot = orderTotal(p);
                const qtd = (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.quantidade ?? 0), 0);
                const cli = p.clientes;
                const isDrop = p.tipo_pedido === "dropshipping";
                const isSelected = selected.has(p.id);

                return (
                  <div key={p.id} className={`flex items-center transition-colors ${isSelected ? "bg-brand/5" : ""}`}>
                    {/* Checkbox */}
                    <div className="pl-4 flex-shrink-0" onClick={() => toggleSelect(p.id)}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(p.id)}
                        className="accent-brand w-4 h-4 cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>

                    {/* Link para detalhes */}
                    <Link href={`/marca/pedidos/${p.id}`}
                      className="flex-1 flex items-center gap-3 px-4 py-4 hover:bg-white/3 transition-colors min-w-0"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">#{p.numero}</span>
                          {cli && <span className="text-xs text-gray-400 truncate max-w-[180px]">{cli.razao_social}</span>}
                          {isDrop && (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">DROP</span>
                          )}
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                          {p.condicao_pagamento && ` · ${p.condicao_pagamento === "pix" ? "PIX" : p.condicao_pagamento === "semanal" ? "Semanal" : `Boleto${p.prazo_boleto ? ` ${p.prazo_boleto}d` : ""}`}`}
                          {cli?.cidade && ` · ${cli.cidade}/${cli.estado}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {tot > 0 && <span className="text-sm font-bold text-white">{fmt(tot)}</span>}
                        <ChevronRight size={13} className="text-gray-600" />
                      </div>
                    </Link>

                    {/* Impressão individual */}
                    <button
                      onClick={() => window.open(`/api/marca/imprimir?ids=${p.id}`, "_blank")}
                      className="mr-3 p-2 text-gray-500 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all flex-shrink-0"
                      title="Imprimir"
                    >
                      <Printer size={13} />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Rodapé com totais */}
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-gray-500">{filtered.length} pedido{filtered.length !== 1 ? "s" : ""}</span>
              <span className="text-sm font-black text-white">{fmt(totalFiltered)}</span>
            </div>
          </>
        )}
      </div>

      {/* Barra de ação em massa (fixa na base) */}
      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4 bg-dark-900/95 backdrop-blur-md border-t border-white/10">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">
                {selected.size} pedido{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-500">Total: {fmt(totalSelected)}</p>
            </div>
            <button
              onClick={printSelected}
              className="flex items-center gap-2 px-5 py-3 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
            >
              <Printer size={14} /> Imprimir {selected.size} pedido{selected.size !== 1 ? "s" : ""}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
