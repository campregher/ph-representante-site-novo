"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2, ChevronDown, ChevronUp, CheckCircle, Clock, AlertCircle, Printer } from "lucide-react";

interface Pedido {
  id: string; numero: number; status: string;
  status_pagamento: string | null;
  tipo_pedido: string | null;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  transportadora: string | null; observacoes: string | null;
  marca: string | null; total: number; created_at: string;
  orcamento_itens: {
    produto_sku: string;
    produto_nome: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }[];
  clientes: { id: string; razao_social: string; cnpj: string; cidade?: string; estado?: string; email: string } | null;
}

type Filtro = "todos" | "em_aberto" | "pago" | "atrasado";

const pagConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  em_aberto: { label: "Em aberto",  color: "bg-yellow-400/15 text-yellow-400 border-yellow-400/25", icon: <Clock size={11} /> },
  pago:      { label: "Pago",       color: "bg-green-400/15 text-green-400 border-green-400/25",   icon: <CheckCircle size={11} /> },
  atrasado:  { label: "Atrasado",   color: "bg-red-400/15 text-red-400 border-red-400/25",          icon: <AlertCircle size={11} /> },
};

export default function AdminHistoricoPage() {
  const [pedidos,    setPedidos]    = useState<Pedido[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filtro,     setFiltro]     = useState<Filtro>("todos");
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/historico");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPedidos(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar histórico");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function setStatusPagamento(id: string, status_pagamento: string) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/historico", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status_pagamento }),
      });
      if (!res.ok) { toast.error("Erro ao atualizar status de pagamento"); return; }
      setPedidos((prev) => prev.map((p) => p.id === id ? { ...p, status_pagamento } : p));
      toast.success("Status de pagamento atualizado.");
    } catch {
      toast.error("Erro de conexão");
    } finally { setUpdatingId(null); }
  }

  // Agrupa por cliente
  const byCliente = useMemo(() => {
    const filtered = pedidos.filter((p) => {
      if (filtro === "todos") return true;
      const sp = p.status_pagamento ?? "em_aberto";
      return sp === filtro;
    });

    const map = new Map<string, { nome: string; cnpj: string; cidade?: string; estado?: string; email: string; pedidos: Pedido[] }>();
    for (const p of filtered) {
      if (!p.clientes) continue;
      const cid = p.clientes.id;
      if (!map.has(cid)) {
        map.set(cid, {
          nome:    p.clientes.razao_social,
          cnpj:    p.clientes.cnpj,
          cidade:  p.clientes.cidade,
          estado:  p.clientes.estado,
          email:   p.clientes.email,
          pedidos: [],
        });
      }
      map.get(cid)!.pedidos.push(p);
    }
    return Array.from(map.entries()).map(([id, v]) => ({ id, ...v }));
  }, [pedidos, filtro]);

  const counts = useMemo(() => ({
    em_aberto: pedidos.filter((p) => (p.status_pagamento ?? "em_aberto") === "em_aberto").length,
    pago:      pedidos.filter((p) => p.status_pagamento === "pago").length,
    atrasado:  pedidos.filter((p) => p.status_pagamento === "atrasado").length,
  }), [pedidos]);

  function totalCliente(ps: Pedido[]) {
    return ps.reduce((s, p) => {
      const t = Number(p.total) || (p.orcamento_itens ?? []).reduce((a, i) => a + Number(i.valor_total ?? 0), 0);
      return s + t;
    }, 0);
  }

  const filtros: { key: Filtro; label: string }[] = [
    { key: "todos",     label: `Todos (${pedidos.length})` },
    { key: "em_aberto", label: `Em aberto (${counts.em_aberto})` },
    { key: "pago",      label: `Pagos (${counts.pago})` },
    { key: "atrasado",  label: `Atrasados (${counts.atrasado})` },
  ];

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Histórico de Compras</h1>
          <p className="text-xs text-gray-500 mt-0.5">{pedidos.length} pedido{pedidos.length !== 1 ? "s" : ""} aprovado{pedidos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {counts.atrasado > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-red-400/15 text-red-400 border-red-400/25">
              <AlertCircle size={11} /> {counts.atrasado} atrasado{counts.atrasado !== 1 ? "s" : ""}
            </span>
          )}
          <button onClick={load} disabled={loading} className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-5">
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


      {loading ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-8 text-center text-gray-500 text-sm">Carregando...</div>
      ) : byCliente.length === 0 ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">
          Nenhum pedido encontrado.
        </div>
      ) : (
        <div className="space-y-3">
          {byCliente.map((cliente) => {
            const isOpen      = expanded === cliente.id;
            const totalGeral  = totalCliente(cliente.pedidos);
            const temAtrasado = cliente.pedidos.some((p) => p.status_pagamento === "atrasado");
            const temAberto   = cliente.pedidos.some((p) => (p.status_pagamento ?? "em_aberto") === "em_aberto");

            return (
              <div key={cliente.id} className={`bg-dark-800 border rounded-2xl overflow-hidden ${temAtrasado ? "border-red-400/30" : "border-white/8"}`}>
                <button
                  onClick={() => setExpanded(isOpen ? null : cliente.id)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/3 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{cliente.nome}</p>
                      {temAtrasado && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-400/15 text-red-400 border border-red-400/25 flex items-center gap-0.5">
                          <AlertCircle size={9} /> Atrasado
                        </span>
                      )}
                      {!temAtrasado && temAberto && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/25">
                          Em aberto
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cliente.cnpj}
                      {cliente.cidade && ` · ${cliente.cidade}/${cliente.estado}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-500">{cliente.pedidos.length} pedido{cliente.pedidos.length !== 1 ? "s" : ""}</p>
                      {totalGeral > 0 && (
                        <p className="text-sm font-black text-white">{totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      )}
                    </div>
                    {isOpen ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-white/8 divide-y divide-white/5">
                    <div className="flex items-center gap-2 flex-wrap px-5 py-3 bg-white/2 border-b border-white/8">
                      <button
                        onClick={() => window.open(`/api/admin/imprimir?ids=${cliente.pedidos.map(p => p.id).join(",")}`, "_blank")}
                        className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
                      >
                        <Printer size={12} /> Imprimir pedidos
                      </button>
                    </div>
                    {cliente.pedidos.map((p) => {
                      const total   = Number(p.total) || (p.orcamento_itens ?? []).reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
                      const sp      = p.status_pagamento ?? "em_aberto";
                      const pc      = pagConfig[sp] ?? pagConfig.em_aberto;
                      const isUpd   = updatingId === p.id;
                      const qtd     = (p.orcamento_itens ?? []).reduce((sum, item) => sum + Number(item.quantidade ?? 0), 0);

                      return (
                        <div key={p.id} className="px-5 py-3.5">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-sm font-bold text-white">#{p.numero}</p>
                                {p.marca && <span className="text-[10px] text-gray-600 uppercase tracking-wide">{p.marca}</span>}
                                {p.tipo_pedido && <span className="text-[10px] text-gray-500">{p.tipo_pedido === "dropshipping" ? "Dropshipping" : "Estoque"}</span>}
                                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pc.color}`}>
                                  {pc.icon} {pc.label}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">
                                {new Date(p.created_at).toLocaleDateString("pt-BR")}
                                {p.condicao_pagamento && ` · ${p.condicao_pagamento === "pix" ? "PIX" : `Boleto${p.prazo_boleto ? ` ${p.prazo_boleto}d` : ""}`}`}
                                {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                                {p.transportadora && ` · ${p.transportadora}`}
                              </p>
                            </div>

                            {total > 0 && (
                              <p className="text-sm font-bold text-white">
                                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </p>
                            )}

                            {/* Selector de status de pagamento */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {(["em_aberto", "pago", "atrasado"] as const).map((s) => (
                                <button key={s} onClick={() => setStatusPagamento(p.id, s)} disabled={isUpd || sp === s}
                                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all disabled:cursor-default ${
                                    sp === s
                                      ? pagConfig[s].color + " cursor-default"
                                      : "bg-dark-900 border-white/8 text-gray-500 hover:text-white hover:border-white/20"
                                  }`}
                                >
                                  {isUpd && sp !== s ? <Loader2 size={9} className="animate-spin inline" /> : pagConfig[s].label}
                                </button>
                              ))}
                            </div>
                          </div>
                          {p.orcamento_itens?.length > 0 && (
                            <div className="mt-3 rounded-xl border border-white/8 bg-dark-950/40 divide-y divide-white/5">
                              {p.orcamento_itens.map((item) => (
                                <div key={`${p.id}-${item.produto_sku}`} className="px-3 py-2 flex items-center gap-3 text-xs">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-white font-medium truncate">{item.produto_nome}</p>
                                    <p className="text-[10px] text-gray-600">{item.produto_sku}</p>
                                  </div>
                                  <span className="text-gray-400">{item.quantidade}x</span>
                                  <span className="text-gray-400">{Number(item.valor_unitario ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                  <span className="text-white font-semibold">{Number(item.valor_total ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>
                                </div>
                              ))}
                            </div>
                          )}
                          {p.observacoes && <p className="mt-2 text-xs text-gray-500">Obs: {p.observacoes}</p>}
                        </div>
                      );
                    })}

                    {/* Totais por status */}
                    <div className="px-5 py-3 bg-white/3 flex items-center justify-between gap-3 flex-wrap text-xs text-gray-500">
                      <div className="flex items-center gap-4">
                        {Object.entries(pagConfig).map(([key, cfg]) => {
                          const count = cliente.pedidos.filter((p) => (p.status_pagamento ?? "em_aberto") === key).length;
                          if (!count) return null;
                          return (
                            <span key={key} className={`inline-flex items-center gap-1 font-semibold ${cfg.color.split(" ").find(c => c.startsWith("text-")) ?? ""}`}>
                              {cfg.icon} {count} {cfg.label.toLowerCase()}
                            </span>
                          );
                        })}
                      </div>
                      {totalGeral > 0 && (
                        <span className="font-black text-white text-sm">
                          Total: {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
