"use client";

import { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Printer, ChevronRight, Package, BadgeCheck, Loader2, AlertCircle, AlertTriangle, Clock, Truck, FileText, ExternalLink, CheckSquare, Square, ShoppingBag } from "lucide-react";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";

interface Pedido {
  id: string; numero: number; status: string; tipo_pedido: string | null;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  horario_postagem: string | null; impresso_at: string | null;
  total: number; created_at: string;
  orcamento_itens: { quantidade: number; valor_total: number }[];
  clientes: { razao_social: string; cnpj: string; cidade: string | null; estado: string | null } | null;
}

interface LoteItem     { id: string; produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number; }
interface LoteEtiqueta { id: string; nome: string; url: string; }
interface LotePedido {
  id: string; numero: number; total: number; created_at: string;
  ml_order_id: string | null; horario_postagem: string | null; observacoes: string | null;
  clientes: { razao_social: string; email: string; cidade: string | null; estado: string | null } | null;
  orcamento_itens: LoteItem[];
  orcamento_etiquetas: LoteEtiqueta[];
}
interface LoteResumo { produto_sku: string; produto_nome: string; total_qtd: number; }

const statusCfg: Record<string, { label: string; dot: string; color: string }> = {
  enviado:      { label: "Novo",        dot: "bg-yellow-400", color: "text-yellow-400"  },
  em_separacao: { label: "Em separação",dot: "bg-blue-500",   color: "text-blue-400"   },
  a_pagar:      { label: "A pagar",     dot: "bg-orange-500", color: "text-orange-400" },
  pago:         { label: "Pago",        dot: "bg-emerald-500",color: "text-emerald-400"},
  recusado:     { label: "Recusado",    dot: "bg-red-500",    color: "text-red-400"    },
};

type Tab = "todos" | "enviado" | "em_separacao" | "a_pagar" | "pago" | "recusado" | "dropshipping";

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
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const [confirming,   setConfirming]   = useState(false);
  const [lote,             setLote]             = useState<{ pedidos: LotePedido[]; resumo: LoteResumo[] } | null>(null);
  const [loadingLote,      setLoadingLote]      = useState(false);
  const [loteSelected,     setLoteSelected]     = useState<Set<string>>(new Set());
  const [downloadedLabels, setDownloadedLabels] = useState<Set<string>>(new Set());

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

  const loadLote = useCallback(async () => {
    setLoadingLote(true);
    setLoteSelected(new Set());
    setDownloadedLabels(new Set());
    try {
      const res  = await fetch("/api/marca/dropshipping/lote");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setLote(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar lote"); }
    finally { setLoadingLote(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "dropshipping") loadLote(); }, [tab, loadLote]);

  // Reset selection when tab changes
  useEffect(() => { setSelected(new Set()); setLoteSelected(new Set()); }, [tab]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length };
    for (const p of pedidos) c[p.status] = (c[p.status] ?? 0) + 1;
    return c;
  }, [pedidos]);

  const filtered = useMemo(() => {
    if (tab === "todos") return pedidos;
    return pedidos.filter((p) => p.status === tab);
  }, [pedidos, tab]);

  const dropCount = pedidos.filter(p => p.tipo_pedido === "dropshipping" && p.status === "em_separacao").length;

  const tabs: { key: Tab; label: string; highlight?: boolean }[] = [
    { key: "todos",        label: `Todos (${counts.todos ?? 0})`               },
    { key: "enviado",      label: `Novos (${counts.enviado ?? 0})`             },
    { key: "em_separacao", label: `Em separação (${counts.em_separacao ?? 0})` },
    { key: "a_pagar",      label: `A pagar (${counts.a_pagar ?? 0})`           },
    { key: "pago",         label: `Pagos (${counts.pago ?? 0})`                },
    { key: "recusado",     label: `Recusados (${counts.recusado ?? 0})`        },
    { key: "dropshipping", label: `Lote Drop${dropCount > 0 ? ` (${dropCount})` : ""}`, highlight: dropCount > 0 },
  ];

  const isSelectionMode = tab === "a_pagar" || tab === "enviado" || tab === "em_separacao";

  async function enviarLoteSelecionado() {
    if (loteSelected.size === 0) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/marca/pedidos/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marcar_enviado", ids: [...loteSelected] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`${data.updated} pedido${data.updated !== 1 ? "s" : ""} marcado${data.updated !== 1 ? "s" : ""} como enviado!`);
      await loadLote();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setConfirming(false); }
  }

  async function enviarPedidoUnico(id: string) {
    setConfirming(true);
    try {
      const res = await fetch("/api/marca/pedidos/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "marcar_enviado", ids: [id] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Pedido marcado como enviado!");
      await loadLote();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setConfirming(false); }
  }

  function markLabelDownloaded(pedidoId: string) {
    setDownloadedLabels(prev => new Set([...prev, pedidoId]));
  }

  function canConfirmPedido(p: LotePedido): boolean {
    if (p.orcamento_etiquetas.length === 0) return true;
    return downloadedLabels.has(p.id);
  }

  function baixarEtiquetasSelecionadas() {
    const pedidosSelecionados = lote?.pedidos.filter(p => loteSelected.has(p.id)) ?? [];
    for (const p of pedidosSelecionados) {
      for (const etq of p.orcamento_etiquetas) {
        window.open(etq.url, "_blank");
      }
    }
    setDownloadedLabels(prev => new Set([...prev, ...pedidosSelecionados.map(p => p.id)]));
  }

  const canConfirmLote = loteSelected.size > 0 && [...loteSelected].every(id => {
    const p = lote?.pedidos.find(x => x.id === id);
    return !p || canConfirmPedido(p);
  });

  const needsLabelDownload = loteSelected.size > 0 && [...loteSelected].some(id => {
    const p = lote?.pedidos.find(x => x.id === id);
    return p && p.orcamento_etiquetas.length > 0 && !downloadedLabels.has(p.id);
  });

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

  async function executarLote(action: "confirmar_pagamento" | "confirmar_recebimento" | "marcar_enviado") {
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
      const label = action === "confirmar_pagamento" ? "como pago" : action === "marcar_enviado" ? "como enviado" : "como em separação";
      toast.success(`${data.updated} pedido${data.updated !== 1 ? "s" : ""} marcado${data.updated !== 1 ? "s" : ""} ${label}!`);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao processar pedidos"); }
    finally { setConfirming(false); }
  }

  return (
    <div className="min-h-screen pb-28">
      <MarcaContentHeader
        title="Pedidos"
        actions={
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        }
      />

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                tab === t.key
                  ? t.key === "dropshipping"
                    ? "bg-yellow-400 border-yellow-400 text-black"
                    : "bg-brand border-brand text-white"
                  : t.highlight
                    ? "bg-yellow-400/10 border-yellow-400/30 text-yellow-400 hover:bg-yellow-400/20"
                    : "bg-dark-800 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
              }`}
            >
              {t.key === "dropshipping" && <ShoppingBag size={10} className="inline mr-1 -mt-0.5" />}
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

        {/* ── Lote Dropshipping ── */}
        {tab === "dropshipping" && (
          <>
            {loadingLote ? (
              <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando lote...
              </div>
            ) : !lote || lote.pedidos.length === 0 ? (
              <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center space-y-2">
                <ShoppingBag size={28} className="text-gray-700 mx-auto" />
                <p className="text-gray-500 text-sm">Nenhum pedido dropshipping em separação.</p>
                <p className="text-gray-600 text-xs">Os pedidos ML aparecem aqui assim que uma venda for confirmada.</p>
              </div>
            ) : (
              <>
                {/* Resumo de produtos */}
                <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
                  <div className="px-5 py-3 border-b border-white/8 flex items-center gap-2">
                    <Package size={14} className="text-yellow-400" />
                    <p className="text-sm font-bold text-white">Produtos para separar</p>
                    <span className="text-xs text-gray-500 ml-auto">{lote.pedidos.length} pedido{lote.pedidos.length !== 1 ? "s" : ""}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8 bg-dark-900/50">
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Produto</th>
                        <th className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">SKU</th>
                        <th className="px-4 py-2.5 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {lote.resumo.map(r => (
                        <tr key={r.produto_sku} className="hover:bg-white/2">
                          <td className="px-4 py-2.5 text-sm text-white font-medium">{r.produto_nome}</td>
                          <td className="px-4 py-2.5 text-xs font-mono text-gray-500 hidden sm:table-cell">{r.produto_sku}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="text-sm font-bold text-yellow-400">{r.total_qtd} un</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Seleção em lote */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-dark-800 border border-white/8 rounded-xl">
                  <button
                    onClick={() => setLoteSelected(
                      loteSelected.size === lote.pedidos.length
                        ? new Set()
                        : new Set(lote.pedidos.map(p => p.id))
                    )}
                    className="text-gray-500 hover:text-white transition-colors"
                  >
                    {loteSelected.size === lote.pedidos.length && lote.pedidos.length > 0
                      ? <CheckSquare size={15} className="text-yellow-400" />
                      : <Square size={15} />}
                  </button>
                  <span className="text-xs text-gray-400">
                    {loteSelected.size === 0 ? "Selecionar todos para envio em lote" : `${loteSelected.size} selecionado${loteSelected.size !== 1 ? "s" : ""}`}
                  </span>
                </div>

                {/* Pedidos individuais */}
                <div className="space-y-2">
                  {lote.pedidos.map(p => {
                    const cli       = p.clientes;
                    const isSelected = loteSelected.has(p.id);
                    const nowMs     = Date.now();
                    const pSt       = prazoStatus(p.horario_postagem, nowMs);

                    return (
                      <div key={p.id} className={`bg-dark-800 border rounded-2xl overflow-hidden transition-all ${
                        isSelected ? "border-yellow-400/40" : pSt === "overdue" ? "border-red-500/30" : pSt === "soon" ? "border-yellow-400/20" : "border-white/8"
                      }`}>
                        {/* Header do pedido */}
                        <div className="flex items-center gap-3 px-4 py-3">
                          <button
                            onClick={() => setLoteSelected(prev => {
                              const next = new Set(prev);
                              if (next.has(p.id)) next.delete(p.id); else next.add(p.id);
                              return next;
                            })}
                            className="text-gray-500 hover:text-yellow-400 transition-colors flex-shrink-0"
                          >
                            {isSelected ? <CheckSquare size={15} className="text-yellow-400" /> : <Square size={15} />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-bold text-white">#{p.numero}</span>
                              {cli && <span className="text-xs text-gray-300 truncate max-w-[180px]">{cli.razao_social}</span>}
                              {p.ml_order_id && (
                                <span className="text-[10px] font-mono text-gray-600 hidden sm:inline">{p.ml_order_id}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {new Date(p.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                              {cli?.cidade && ` · ${cli.cidade}/${cli.estado}`}
                              {` · `}<span className="font-bold text-white">{fmt(Number(p.total))}</span>
                            </p>
                          </div>

                          <div className="flex items-center gap-2 flex-shrink-0">
                            <Link href={`/marca/pedidos/${p.id}`}
                              className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                              title="Ver pedido"
                            >
                              <ExternalLink size={13} />
                            </Link>
                            <button
                              onClick={() => enviarPedidoUnico(p.id)}
                              disabled={confirming || !canConfirmPedido(p)}
                              title={!canConfirmPedido(p) ? "Baixe a etiqueta antes de confirmar o envio" : "Confirmar envio"}
                              className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-xl transition-all disabled:opacity-40 ${
                                canConfirmPedido(p)
                                  ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400"
                                  : "bg-dark-700 border-white/8 text-gray-600 cursor-not-allowed"
                              }`}
                            >
                              {confirming ? <Loader2 size={11} className="animate-spin" /> : <Truck size={11} />}
                              <span className="hidden sm:inline">{canConfirmPedido(p) ? "Confirmar envio" : "Baixar etiqueta"}</span>
                            </button>
                          </div>
                        </div>

                        {/* Alerta de prazo */}
                        {pSt !== "none" && p.horario_postagem && (
                          <div className={`mx-4 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold ${
                            pSt === "overdue" ? "bg-red-500/15 text-red-400" : "bg-yellow-400/10 text-yellow-400"
                          }`}>
                            {pSt === "overdue" ? <AlertCircle size={11} /> : <AlertTriangle size={11} />}
                            Postagem: {formatPrazoBR(p.horario_postagem)}
                            {pSt === "overdue" && <span className="ml-auto font-bold">ATRASADO</span>}
                          </div>
                        )}

                        {/* Itens + Etiquetas */}
                        <div className="border-t border-white/6 bg-dark-900/30 px-4 py-3 space-y-2">
                          {/* Itens */}
                          <div className="space-y-1">
                            {p.orcamento_itens.map(item => (
                              <div key={item.id} className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-gray-600 flex-shrink-0">{item.produto_sku}</span>
                                <span className="text-gray-300 flex-1 truncate">{item.produto_nome}</span>
                                <span className="text-gray-500 flex-shrink-0">×{item.quantidade}</span>
                                <span className="text-white font-semibold flex-shrink-0">{fmt(item.valor_unitario * item.quantidade)}</span>
                              </div>
                            ))}
                          </div>

                          {/* Etiquetas */}
                          {p.orcamento_etiquetas.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              {p.orcamento_etiquetas.map(etq => {
                                const baixada = downloadedLabels.has(p.id);
                                return (
                                  <a
                                    key={etq.id}
                                    href={etq.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => markLabelDownloaded(p.id)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 border text-xs font-semibold rounded-xl transition-all ${
                                      baixada
                                        ? "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-400"
                                        : "bg-yellow-400/10 hover:bg-yellow-400/20 border-yellow-400/25 text-yellow-400"
                                    }`}
                                  >
                                    <FileText size={11} />
                                    {baixada ? "✓ " : ""}{etq.nome}
                                  </a>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {/* List */}
        {tab !== "dropshipping" && (loading ? (
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
        ))}
      </div>

      {/* ── Barra de ação em lote dropshipping ── */}
      {tab === "dropshipping" && loteSelected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-4 bg-dark-900/95 backdrop-blur-md border-t border-white/10">
          <div className="max-w-5xl mx-auto flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-bold text-white">{loteSelected.size} pedido{loteSelected.size !== 1 ? "s" : ""} selecionado{loteSelected.size !== 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-500">
                Total: {fmt((lote?.pedidos ?? []).filter(p => loteSelected.has(p.id)).reduce((s, p) => s + Number(p.total), 0))}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {needsLabelDownload && (
                <button
                  onClick={baixarEtiquetasSelecionadas}
                  className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/40 text-yellow-400 text-sm font-bold rounded-xl transition-all"
                >
                  <FileText size={14} />
                  Baixar etiquetas ({loteSelected.size})
                </button>
              )}
              <button
                onClick={enviarLoteSelecionado}
                disabled={confirming || !canConfirmLote}
                title={!canConfirmLote ? "Baixe todas as etiquetas antes de confirmar" : undefined}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {confirming ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
                Confirmar envio {loteSelected.size > 1 ? `(${loteSelected.size})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}

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
            ) : tab === "em_separacao" ? (
              <button
                onClick={() => executarLote("marcar_enviado")}
                disabled={confirming}
                className="flex items-center gap-2 px-5 py-3 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
              >
                {confirming ? <Loader2 size={14} className="animate-spin" /> : <BadgeCheck size={14} />}
                Marcar como enviado
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
