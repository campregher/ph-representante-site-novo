"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import {
  CheckCircle, XCircle, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Package, Truck, Download, Clock, AlertCircle, AlertTriangle,
  Bell, MessageSquare, Printer, Square, CheckSquare,
} from "lucide-react";

type Filtro = "todos" | "enviado" | "em_separacao" | "aprovado" | "rascunho" | "recusado" | "finalizado";

interface Item {
  id: string; produto_sku: string; produto_nome: string;
  quantidade: number; valor_unitario: number; valor_total: number;
}
interface Etiqueta { id: string; nome: string; url: string }
interface Orcamento {
  id: string; numero: number; status: string;
  marca: string | null;
  tipo_pedido: string | null;
  condicao_pagamento: string | null; transportadora: string | null;
  observacoes: string | null; observacao_admin: string | null;
  horario_postagem: string | null;
  alteracao_pendente: boolean | null; alteracao_descricao: string | null;
  notificacao_fornecedor: string | null;
  total: number; created_at: string;
  orcamento_itens: Item[];
  orcamento_etiquetas: Etiqueta[];
  clientes: { razao_social: string; cnpj: string; cidade?: string; estado?: string; email: string; whatsapp: string } | null;
}

const statusColors: Record<string, string> = {
  rascunho:     "bg-gray-400/15 text-gray-400 border-gray-400/25",
  enviado:      "bg-yellow-400/15 text-yellow-400 border-yellow-400/25",
  em_separacao: "bg-orange-400/15 text-orange-400 border-orange-400/25",
  a_pagar:      "bg-purple-400/15 text-purple-400 border-purple-400/25",
  pago:         "bg-teal-400/15 text-teal-400 border-teal-400/25",
  aprovado:     "bg-green-400/15 text-green-400 border-green-400/25",
  recusado:     "bg-red-400/15 text-red-400 border-red-400/25",
  finalizado:   "bg-indigo-400/15 text-indigo-400 border-indigo-400/25",
};
const statusLabels: Record<string, string> = {
  rascunho: "Rascunho", enviado: "Enviado", em_separacao: "Em Separação",
  a_pagar: "A Pagar", pago: "Pago", aprovado: "Aprovado", recusado: "Recusado", finalizado: "Finalizado",
};

function prazoInfo(hp: string | null) {
  if (!hp) return null;
  const diff = new Date(hp).getTime() - Date.now();
  const fmtBR = new Date(hp).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  if (diff < 0) return { fmtBR, cls: "bg-red-500/15 border-red-500/30 text-red-400", icon: <AlertCircle size={12} />, suffix: "⚠ PRAZO ENCERRADO" };
  if (diff < 48 * 3600 * 1000) return { fmtBR, cls: "bg-yellow-400/15 border-yellow-400/30 text-yellow-400", icon: <AlertTriangle size={12} />, suffix: "Vence em breve!" };
  return { fmtBR, cls: "bg-green-400/10 border-green-400/20 text-green-400", icon: <Clock size={12} />, suffix: null };
}

export default function AdminOrcamentosPage() {
  const [orcamentos,      setOrcamentos]      = useState<Orcamento[]>([]);
  const [loading,         setLoading]         = useState(true);
  const [expanded,        setExpanded]        = useState<string | null>(null);
  const [actionId,        setActionId]        = useState<string | null>(null);
  const [obsModal,        setObsModal]        = useState<{ id: string; obs: string } | null>(null);
  const [notifModal,      setNotifModal]      = useState<{ id: string; tipo: "nao_enviara_hoje" | "alteracao" } | null>(null);
  const [notifMsg,        setNotifMsg]        = useState("");
  const [notifSending,    setNotifSending]    = useState(false);
  const [finalizingId,    setFinalizingId]    = useState<string | null>(null);
  const [expedicaoSending,setExpedicaoSending]= useState(false);

  const [filtro,          setFiltro]          = useState<Filtro>("todos");

  // Etiquetas confirmadas (por ID de orçamento) — gate antes de aprovar
  const [confirmedLabels, setConfirmedLabels] = useState<Set<string>>(new Set());

  // Seleção para impressão
  const [selected,        setSelected]        = useState<Set<string>>(new Set());

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/orcamentos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOrcamentos(Array.isArray(data) ? data : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar pedidos");
    } finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function toggleConfirmLabel(id: string) {
    setConfirmedLabels((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function selectAll() {
    setSelected(new Set(filtered.map((o) => o.id)));
  }
  function clearSelect() { setSelected(new Set()); }

  function openPrint(ids: string[]) {
    window.open(`/api/admin/imprimir?ids=${ids.join(",")}`, "_blank");
  }

  async function updateStatus(id: string, status: "aprovado" | "recusado", observacao_admin?: string) {
    setActionId(id);
    try {
      const res = await fetch("/api/admin/orcamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status, observacao_admin: observacao_admin ?? "" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao atualizar status"); return; }
      toast.success(status === "aprovado" ? "Pedido aprovado!" : "Pedido recusado.");
      await load();
    } catch {
      toast.error("Erro de conexão");
    } finally { setActionId(null); setObsModal(null); }
  }

  async function limparAlteracao(id: string) {
    setActionId(id);
    try {
      await fetch("/api/admin/orcamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "limpar_alteracao" }),
      });
      toast.success("Alteração marcada como vista.");
      await load();
    } finally { setActionId(null); }
  }

  async function enviarNotificacao() {
    if (!notifModal) return;
    setNotifSending(true);
    try {
      const res = await fetch("/api/admin/orcamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notifModal.id, action: "notificar_cliente", tipo: notifModal.tipo, mensagem: notifMsg }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao enviar notificação"); return; }
      toast.success("Notificação enviada ao comprador.");
      setNotifModal(null); setNotifMsg(""); await load();
    } finally { setNotifSending(false); }
  }

  async function finalizar(id: string) {
    setFinalizingId(id);
    try {
      const res = await fetch("/api/admin/orcamentos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: "finalizado" }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao finalizar"); return; }
      toast.success("Pedido finalizado!");
      await load();
    } catch { toast.error("Erro de conexão"); }
    finally { setFinalizingId(null); }
  }

  async function enviarExpedicao(ids: string[]) {
    setExpedicaoSending(true);
    try {
      const res = await fetch("/api/admin/expedicao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao enviar para expedição"); return; }
      if (data.sent === 0) toast.warning("Nenhuma marca com e-mail de expedição configurado.");
      else toast.success(`${data.sent} e-mail${data.sent !== 1 ? "s" : ""} enviado${data.sent !== 1 ? "s" : ""} para expedição!`);
      if (data.errors?.length) toast.error(`Falha em ${data.errors.length} pedido(s).`);
    } catch { toast.error("Erro de conexão"); }
    finally { setExpedicaoSending(false); }
  }

  const counts = {
    todos:        orcamentos.length,
    rascunho:     orcamentos.filter((o) => o.status === "rascunho").length,
    enviado:      orcamentos.filter((o) => o.status === "enviado").length,
    em_separacao: orcamentos.filter((o) => o.status === "em_separacao").length,
    aprovado:     orcamentos.filter((o) => o.status === "aprovado").length,
    recusado:     orcamentos.filter((o) => o.status === "recusado").length,
    finalizado:   orcamentos.filter((o) => o.status === "finalizado").length,
    alteracao:    orcamentos.filter((o) => o.alteracao_pendente).length,
  };

  const selectedEmSeparacao = [...selected].filter((id) => {
    const o = orcamentos.find((x) => x.id === id);
    return o?.status === "em_separacao";
  });

  const filtered = useMemo(
    () => filtro === "todos" ? orcamentos : orcamentos.filter((o) => o.status === filtro),
    [orcamentos, filtro],
  );

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-black text-white">Pedidos</h1>
          <p className="text-xs text-gray-500 mt-0.5">{orcamentos.length} pedido{orcamentos.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {selected.size > 0 && (
            <>
              {selectedEmSeparacao.length > 0 && (
                <button
                  onClick={() => enviarExpedicao(selectedEmSeparacao)}
                  disabled={expedicaoSending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-50"
                >
                  {expedicaoSending ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
                  Enviar para expedição ({selectedEmSeparacao.length})
                </button>
              )}
              <button onClick={() => openPrint(Array.from(selected))}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all"
              >
                <Printer size={13} /> Imprimir selecionados ({selected.size})
              </button>
              <button onClick={clearSelect} className="text-xs text-gray-500 hover:text-white transition-colors px-2">Limpar</button>
            </>
          )}
          {selected.size === 0 && filtered.length > 0 && (
            <button onClick={selectAll} className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2">
              <CheckSquare size={12} /> Selecionar todos
            </button>
          )}
          {counts.alteracao > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border bg-orange-400/15 text-orange-400 border-orange-400/25">
              <AlertTriangle size={11} /> {counts.alteracao} alteraç{counts.alteracao !== 1 ? "ões" : "ão"}
            </span>
          )}
          {counts.enviado > 0 && (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border bg-yellow-400/15 text-yellow-400 border-yellow-400/25">
              {counts.enviado} pendente{counts.enviado !== 1 ? "s" : ""}
            </span>
          )}
          <button onClick={load} disabled={loading} className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(
          [
            { key: "todos",        label: "Todos",         count: counts.todos },
            { key: "enviado",      label: "Enviados",      count: counts.enviado },
            { key: "em_separacao", label: "Em Separação",  count: counts.em_separacao },
            { key: "aprovado",     label: "Aprovados",     count: counts.aprovado },
            { key: "rascunho",     label: "Rascunhos",     count: counts.rascunho },
            { key: "recusado",     label: "Cancelados",    count: counts.recusado },
            { key: "finalizado",   label: "Finalizados",   count: counts.finalizado },
          ] as { key: Filtro; label: string; count: number }[]
        ).map(({ key, label, count }) => (
          <button key={key} onClick={() => setFiltro(key)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              filtro === key
                ? "bg-brand border-brand text-white"
                : "bg-dark-800 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
            }`}
          >
            {label} ({count})
          </button>
        ))}
      </div>


      {loading ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-8 text-center text-gray-500 text-sm">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm">Nenhum orçamento encontrado.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const isOpen       = expanded === o.id;
            const itens        = o.orcamento_itens ?? [];
            const total        = itens.reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
            const hasAlteracao = !!o.alteracao_pendente;
            const isDrop       = o.tipo_pedido === "dropshipping";
            const hasEtiquetas = (o.orcamento_etiquetas ?? []).length > 0;
            const labelConfirmed = confirmedLabels.has(o.id);
            const needsLabelConfirm = o.status === "enviado" && isDrop && hasEtiquetas;
            const canApprove   = !needsLabelConfirm || labelConfirmed;
            const isSelected   = selected.has(o.id);
            const prazo        = prazoInfo(o.horario_postagem);

            return (
              <div key={o.id} className={`bg-dark-800 border rounded-2xl overflow-hidden ${hasAlteracao ? "border-orange-400/30" : "border-white/8"}`}>

                {/* Row header */}
                <div className="flex items-center">
                  {/* Checkbox seleção impressão */}
                  <button
                    onClick={() => toggleSelect(o.id)}
                    className="px-3 py-4 text-gray-600 hover:text-gray-300 transition-colors flex-shrink-0"
                  >
                    {isSelected ? <CheckSquare size={15} className="text-brand" /> : <Square size={15} />}
                  </button>

                  <button
                    onClick={() => setExpanded(isOpen ? null : o.id)}
                    className="flex-1 flex items-center justify-between pr-5 py-4 text-left hover:bg-white/3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-white">#{o.numero} — {o.clientes?.razao_social ?? "—"}</p>
                        {hasAlteracao && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-400/15 text-orange-400 border border-orange-400/25">Alterado</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(o.created_at).toLocaleDateString("pt-BR")}
                        {o.condicao_pagamento && ` · ${o.condicao_pagamento === "pix" ? "PIX" : "Boleto"}`}
                        {o.clientes?.cidade && ` · ${o.clientes.cidade}/${o.clientes.estado}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {o.tipo_pedido && (
                        <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full border ${isDrop ? "bg-blue-400/10 text-blue-400 border-blue-400/20" : "bg-gray-400/10 text-gray-400 border-gray-400/20"}`}>
                          {isDrop ? <Truck size={9} /> : <Package size={9} />}
                          {isDrop ? "Drop" : "Estoque"}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusColors[o.status] ?? ""}`}>
                        {statusLabels[o.status] ?? o.status}
                      </span>
                      {total > 0 && (
                        <span className="text-sm font-bold text-white hidden sm:block">
                          {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </span>
                      )}
                      {isOpen ? <ChevronUp size={15} className="text-gray-500" /> : <ChevronDown size={15} className="text-gray-500" />}
                    </div>
                  </button>
                </div>

                {isOpen && (
                  <div className="border-t border-white/8 px-5 pb-5 pt-4 space-y-4">

                    {/* Ações rápidas do topo */}
                    <div className="flex justify-end gap-2 flex-wrap">
                      {o.status === "em_separacao" && (
                        <button
                          onClick={() => enviarExpedicao([o.id])}
                          disabled={expedicaoSending}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-400 text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                        >
                          {expedicaoSending ? <Loader2 size={12} className="animate-spin" /> : <Truck size={12} />}
                          Enviar para expedição
                        </button>
                      )}
                      <button onClick={() => openPrint([o.id])}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
                      >
                        <Printer size={12} /> Imprimir pedido
                      </button>
                    </div>

                    {/* Alerta de alteração pendente */}
                    {hasAlteracao && (
                      <div className="flex items-start gap-3 px-4 py-3 bg-orange-400/10 border border-orange-400/25 rounded-xl">
                        <AlertTriangle size={14} className="text-orange-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-orange-400 mb-1">Comprador alterou este pedido</p>
                          {o.alteracao_descricao && <p className="text-xs text-orange-300 italic">"{o.alteracao_descricao}"</p>}
                        </div>
                        <button onClick={() => limparAlteracao(o.id)} disabled={actionId === o.id}
                          className="text-[10px] px-2 py-1 bg-orange-400/15 hover:bg-orange-400/25 text-orange-400 rounded-lg border border-orange-400/25 transition-all flex-shrink-0 disabled:opacity-40"
                        >
                          {actionId === o.id ? <Loader2 size={10} className="animate-spin" /> : "Marcar como visto"}
                        </button>
                      </div>
                    )}

                    {/* Última notificação enviada */}
                    {o.notificacao_fornecedor && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-blue-400/10 border border-blue-400/20 rounded-xl">
                        <Bell size={11} className="text-blue-400 flex-shrink-0" />
                        <p className="text-xs text-blue-300">Última notificação: <span className="font-semibold">{o.notificacao_fornecedor}</span></p>
                      </div>
                    )}

                    {/* Dados do cliente */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {([
                        ["CNPJ", o.clientes?.cnpj ?? "—"],
                        ["Email", o.clientes?.email ?? "—"],
                        ["WhatsApp", o.clientes?.whatsapp ?? "—"],
                        ["Transportadora", o.transportadora ?? "—"],
                      ] as [string, string][]).map(([k, v]) => (
                        <div key={k}>
                          <p className="text-xs text-gray-500 mb-0.5">{k}</p>
                          <p className="text-white text-xs font-medium break-all">{v}</p>
                        </div>
                      ))}
                    </div>

                    {o.observacoes && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Observações do cliente</p>
                        <p className="text-sm text-gray-300">{o.observacoes}</p>
                      </div>
                    )}

                    {/* Tabela de itens */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[400px]">
                        <thead>
                          <tr className="text-xs text-gray-500 border-b border-white/8">
                            <th className="text-left pb-2 font-semibold">Produto</th>
                            <th className="text-center pb-2 font-semibold w-16">Qtd</th>
                            <th className="text-right pb-2 font-semibold w-28">Valor unit.</th>
                            <th className="text-right pb-2 font-semibold w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {itens.map((item) => (
                            <tr key={item.id}>
                              <td className="py-2.5">
                                <p className="text-white font-medium text-xs">{item.produto_nome}</p>
                                <p className="text-xs text-gray-500">{item.produto_sku}</p>
                              </td>
                              <td className="py-2.5 text-center text-gray-300 text-xs">{item.quantidade}</td>
                              <td className="py-2.5 text-right text-gray-300 text-xs">
                                {Number(item.valor_unitario) > 0
                                  ? Number(item.valor_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                  : <span className="text-gray-600">—</span>}
                              </td>
                              <td className="py-2.5 text-right font-medium text-white text-xs">
                                {Number(item.valor_total) > 0
                                  ? Number(item.valor_total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                                  : <span className="text-gray-600">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {total > 0 && (
                          <tfoot>
                            <tr className="border-t border-white/8">
                              <td colSpan={3} className="pt-2.5 text-xs text-gray-400 font-semibold text-right pr-2">Total</td>
                              <td className="pt-2.5 text-right font-black text-white text-sm">
                                {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>

                    {/* Horário limite de postagem */}
                    {prazo && (
                      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${prazo.cls}`}>
                        {prazo.icon}
                        <span>Limite de postagem:</span>
                        <span className="font-bold">{prazo.fmtBR}</span>
                        {prazo.suffix && <span className="ml-auto">{prazo.suffix}</span>}
                      </div>
                    )}

                    {/* Etiquetas */}
                    {hasEtiquetas && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 mb-2">Etiquetas de envio ({o.orcamento_etiquetas.length})</p>
                        <div className="space-y-1.5">
                          {o.orcamento_etiquetas.map((et) => (
                            <a key={et.id} href={et.url} target="_blank" rel="noopener noreferrer" download={et.nome}
                              className="flex items-center gap-2 px-3 py-2 bg-dark-900 rounded-xl border border-white/8 hover:border-blue-400/30 transition-all group"
                            >
                              <Download size={12} className="text-gray-600 group-hover:text-blue-400 flex-shrink-0 transition-colors" />
                              <span className="text-xs text-gray-300 flex-1 truncate group-hover:text-white transition-colors">{et.nome}</span>
                            </a>
                          ))}
                        </div>

                        {/* Confirmação de download — obrigatória para aprovar pedido drop */}
                        {needsLabelConfirm && (
                          <button
                            onClick={() => toggleConfirmLabel(o.id)}
                            className={`mt-3 w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                              labelConfirmed
                                ? "bg-green-400/10 border-green-400/30 text-green-400"
                                : "bg-yellow-400/8 border-yellow-400/25 text-yellow-400 hover:bg-yellow-400/15"
                            }`}
                          >
                            {labelConfirmed
                              ? <CheckCircle size={15} className="flex-shrink-0" />
                              : <Square size={15} className="flex-shrink-0" />}
                            <span className="text-xs font-semibold text-left">
                              {labelConfirmed
                                ? "Etiquetas confirmadas — pedido pode ser aprovado"
                                : "Confirmo que as etiquetas foram baixadas e conferidas"}
                            </span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Notificações do fornecedor para o cliente */}
                    {o.status === "aprovado" && (
                      <div className="space-y-2 pt-1 border-t border-white/8">
                        <p className="text-xs font-semibold text-gray-500 flex items-center gap-1.5 pt-1">
                          <MessageSquare size={11} /> Notificar comprador
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => { setNotifModal({ id: o.id, tipo: "nao_enviara_hoje" }); setNotifMsg(""); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs font-semibold rounded-xl border border-blue-500/25 transition-all"
                          >
                            <Package size={12} /> Não enviará hoje
                          </button>
                          <button onClick={() => { setNotifModal({ id: o.id, tipo: "alteracao" }); setNotifMsg(""); }}
                            className="flex items-center gap-1.5 px-3 py-2 bg-orange-400/10 hover:bg-orange-400/20 text-orange-400 text-xs font-semibold rounded-xl border border-orange-400/25 transition-all"
                          >
                            <AlertTriangle size={12} /> Houve alteração
                          </button>
                          <button onClick={() => finalizar(o.id)} disabled={finalizingId === o.id}
                            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-xl border border-indigo-500/25 transition-all"
                          >
                            {finalizingId === o.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                            Finalizar pedido
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions: Aprovar / Recusar */}
                    {o.status === "enviado" && (
                      <div className="space-y-2 pt-1">
                        {needsLabelConfirm && !labelConfirmed && (
                          <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                            <AlertTriangle size={11} /> Confirme o download das etiquetas acima para aprovar
                          </p>
                        )}

                        <div className="flex items-center gap-2">
                          <button onClick={() => updateStatus(o.id, "aprovado")}
                            disabled={actionId === o.id || !canApprove}
                            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {actionId === o.id ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                            Aprovar
                          </button>
                          <button onClick={() => setObsModal({ id: o.id, obs: o.observacao_admin ?? "" })} disabled={actionId === o.id}
                            className="flex items-center gap-1.5 px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-400 text-xs font-bold rounded-xl transition-all border border-red-500/25 disabled:opacity-50"
                          >
                            <XCircle size={13} /> Recusar
                          </button>
                        </div>
                      </div>
                    )}

                    {o.observacao_admin && (
                      <p className="text-xs text-gray-500">Obs. admin: <span className="text-gray-400">{o.observacao_admin}</span></p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal recusar */}
      {obsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setObsModal(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">Recusar orçamento</h3>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Motivo (opcional)</label>
              <textarea value={obsModal.obs} onChange={(e) => setObsModal({ ...obsModal, obs: e.target.value })}
                rows={3} placeholder="Ex: Produto fora de linha, verificar estoque..."
                className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-red-400/50 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setObsModal(null)} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm">Cancelar</button>
              <button onClick={() => updateStatus(obsModal.id, "recusado", obsModal.obs)}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all"
              >Recusar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal notificação */}
      {notifModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => { setNotifModal(null); setNotifMsg(""); }}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-white">
              {notifModal.tipo === "nao_enviara_hoje" ? "📦 Pedido não será enviado hoje" : "⚠️ Notificar alteração"}
            </h3>
            <p className="text-xs text-gray-400">
              {notifModal.tipo === "nao_enviara_hoje"
                ? "O comprador receberá um e-mail informando que o pedido não será enviado hoje."
                : "O comprador receberá um e-mail informando que houve uma alteração."}
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Mensagem adicional (opcional)</label>
              <textarea value={notifMsg} onChange={(e) => setNotifMsg(e.target.value)}
                rows={3} placeholder="Detalhes adicionais para o comprador..."
                className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-brand/40 transition-all resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setNotifModal(null); setNotifMsg(""); }} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm">Cancelar</button>
              <button onClick={enviarNotificacao} disabled={notifSending}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {notifSending && <Loader2 size={13} className="animate-spin" />} Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
