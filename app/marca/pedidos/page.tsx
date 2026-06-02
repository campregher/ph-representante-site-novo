"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Printer, ChevronRight, Package, BadgeCheck, Loader2, AlertCircle, AlertTriangle, Clock } from "lucide-react";

interface Pedido {
  id: string; numero: number; status: string; tipo_pedido: string | null;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  horario_postagem: string | null; impresso_at: string | null;
  total: number; created_at: string;
  orcamento_itens: { quantidade: number; valor_total: number }[];
  clientes: { razao_social: string; cnpj: string; cidade: string | null; estado: string | null } | null;
}

const statusCfg: Record<string, { label: string; dot: string; color: string }> = {
  enviado:      { label: "Novo",        dot: "bg-yellow-400", color: "text-yellow-400"  },
  em_separacao: { label: "Em separação",dot: "bg-blue-500",   color: "text-blue-400"   },
  a_pagar:      { label: "A pagar",     dot: "bg-orange-500", color: "text-orange-400" },
  pago:         { label: "Pago",        dot: "bg-emerald-500",color: "text-emerald-400"},
  recusado:     { label: "Recusado",    dot: "bg-red-500",    color: "text-red-400"    },
};

type Tab = "todos" | "enviado" | "em_separacao" | "a_pagar" | "pago" | "recusado";

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function orderTotal(p: Pedido) {
  return Number(p.total) || (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
}

function prazoStatus(horario: string | null | undefined, now: number): "overdue" | "soon" | "ok" | "none" {
  if (!horario) return "none";
  const diff = new Date(horario).getTime() - now;
  if (diff < 0) return "overdue";
  if (diff < 48 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function formatPrazoBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function MarcaPedidosPage() {
  const searchParams = useSearchParams();
  const [pedidos,    setPedidos]    = useState<Pedido[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [tab,        setTab]        = useState<Tab>(() => {
    const s = searchParams.get("status");
    return (["todos","enviado","em_separacao","a_pagar","pago","recusado"].includes(s ?? "") ? s : "todos") as Tab;
  });
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelected(new Set());
    try {
      const res  = await fetch("/api/marca/pedidos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPedidos(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar pedidos"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reset selection when tab changes
  useEffect(() => { setSelected(new Set()); }, [tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length };
    for (const p of pedidos) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [pedidos]);

  const filtered = useMemo(() => {
    if (tab === "todos") return pedidos;
    return pedidos.filter((p) => p.status === tab);
  }, [pedidos, tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "todos",        label: `Todos (${counts.todos ?? 0})`               },
    { key: "enviado",      label: `Novos (${counts.enviado ?? 0})`             },
    { key: "em_separacao", label: `Em separação (${counts.em_separacao ?? 0})` },
    { key: "a_pagar",      label: `A pagar (${counts.a_pagar ?? 0})`           },
    { key: "pago",         label: `Pagos (${counts.pago ?? 0})`                },
    { key: "recusado",     label: `Recusados (${counts.recusado ?? 0})`        },
  ];

  const isSelectionMode = tab === "a_pagar" || tab === "enviado";

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  async function executarLote(action: "confirmar_pagamento" | "confirmar_recebimento") {
    if (selected.size === 0) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/marca/pedidos/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids: [...selected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const label = action === "confirmar_pagamento" ? "como pago" : "como em separação";
      toast.success(`${data.updated} pedido${data.updated !== 1 ? "s" : ""} marcado${data.updated !== 1 ? "s" : ""} ${label}!`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao processar pedidos"); }
    finally { setConfirming(false); }
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <h1 className="text-sm font-bold text-white">Pedidos</h1>
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

        {/* Seleção em lote (tab A pagar) */}
        {isSelectionMode && filtered.length > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-800 border border-white/8 rounded-xl">
            <input
              type="checkbox"
              checked={selected.size === filtered.length && filtered.length > 0}
              onChange={toggleAll}
              className="accent-brand w-4 h-4"
            />
            <span className="text-xs text-gray-400">
              {selected.size === 0 ? "Selecionar todos" : `${selected.size} selecionado${selected.size !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <Package size={28} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">Nenhum pedido nesta categoria.</p>
          </div>
        ) : (
          <div className="bg-dark-800 border border-white/8 rounded-2xl divide-y divide-white/5">
            {filtered.map((p) => {
              const sc   = statusCfg[p.status] ?? statusCfg.enviado;
              const tot  = orderTotal(p);
              const qtd  = (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.quantidade ?? 0), 0);
              const cli  = p.clientes;
              const isSelected = selected.has(p.id);
              const isDrop     = p.tipo_pedido === "dropshipping";
              const impresso   = !!p.impresso_at;
              const nowMs      = Date.now();
              const pStatus = isDrop && p.status === "em_separacao" ? prazoStatus(p.horario_postagem, nowMs) : "none";
              const hp      = p.horario_postagem;

              return (
                <div key={p.id} className={`flex flex-col transition-colors ${pStatus === "overdue" ? "bg-red-500/5" : pStatus === "soon" ? "bg-yellow-400/5" : isSelected ? "bg-brand/5" : ""}`}>
                  {/* Row principal */}
                  <div className="flex items-center">
                    {/* Checkbox (só na tab a_pagar) */}
                    {isSelectionMode && (
                      <div className="pl-4" onClick={() => toggleSelect(p.id)}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(p.id)}
                          className="accent-brand w-4 h-4 cursor-pointer"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}

                    <Link href={`/marca/pedidos/${p.id}`}
                      className="flex-1 flex items-center gap-3 px-4 sm:px-5 py-4 hover:bg-white/3 transition-colors"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">#{p.numero}</span>
                          {cli && <span className="text-xs text-gray-400 truncate max-w-[200px]">{cli.razao_social}</span>}
                          {isDrop && (
                            <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">DROP</span>
                          )}
                          {impresso && (
                            <span className="flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-emerald-500/12 text-emerald-400 border border-emerald-500/20">
                              <Printer size={8} />Impresso
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(p.created_at).toLocaleDateString("pt-BR")}
                          {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                          {p.condicao_pagamento && ` · ${p.condicao_pagamento === "pix" ? "PIX" : p.condicao_pagamento === "semanal" ? "Semanal" : `Boleto${p.prazo_boleto ? ` ${p.prazo_boleto}d` : ""}`}`}
                          {cli?.cidade && ` · ${cli.cidade}/${cli.estado}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <p className={`text-xs font-semibold ${sc.color}`}>{sc.label}</p>
                          {tot > 0 && <p className="text-xs font-bold text-white mt-0.5">{fmt(tot)}</p>}
                        </div>
                        <ChevronRight size={13} className="text-gray-600" />
                      </div>
                    </Link>

                    <button
                      onClick={() => {
                        window.open(`/api/marca/imprimir?ids=${p.id}`, "_blank");
                        setPedidos(prev => prev.map(x =>
                          x.id === p.id ? { ...x, impresso_at: new Date().toISOString() } : x
                        ));
                      }}
                      className="mr-3 p-2 text-gray-500 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all flex-shrink-0"
                      title="Imprimir"
                    >
                      <Printer size={13} />
                    </button>
                  </div>

                  {/* Alerta de prazo de postagem (DROP em separação) */}
                  {pStatus !== "none" && hp && (
                    <div className={`mx-4 sm:mx-5 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
                      pStatus === "overdue"
                        ? "bg-red-500/15 border-red-500/30 text-red-400"
                        : pStatus === "soon"
                          ? "bg-yellow-400/15 border-yellow-400/30 text-yellow-400"
                          : "bg-green-400/10 border-green-400/20 text-green-400"
                    }`}>
                      {pStatus === "overdue" ? <AlertCircle size={12} className="flex-shrink-0" />
                        : pStatus === "soon" ? <AlertTriangle size={12} className="flex-shrink-0" />
                        : <Clock size={12} className="flex-shrink-0" />}
                      <span>Limite de postagem:</span>
                      <span className="font-bold">{formatPrazoBR(hp)}</span>
                      {pStatus === "overdue" && <span className="ml-auto">⚠ PRAZO ENCERRADO</span>}
                      {pStatus === "soon"    && <span className="ml-auto">Vence em breve!</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Barra de ação em lote (fixa na base) ── */}
      {isSelectionMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4 bg-dark-900/95 backdrop-blur-md border-t border-white/10">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-white">{selected.size} pedido{selected.size !== 1 ? "s" : ""} selecionado{selected.size !== 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-500">
                Total: {fmt(filtered.filter(p => selected.has(p.id)).reduce((s, p) => s + orderTotal(p), 0))}
              </p>
            </div>
            {tab === "a_pagar" ? (
              <button
                onClick={() => executarLote("confirmar_pagamento")}
                disabled={confirming}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {confirming ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                Confirmar pagamento
              </button>
            ) : (
              <button
                onClick={() => executarLote("confirmar_recebimento")}
                disabled={confirming}
                className="flex items-center gap-2 px-5 py-3 bg-blue-500 hover:bg-blue-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {confirming ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                Aprovar selecionados
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function MarcaPedidosPageWrapper() {
  return (
    <Suspense>
      <MarcaPedidosPage />
    </Suspense>
  );
}
