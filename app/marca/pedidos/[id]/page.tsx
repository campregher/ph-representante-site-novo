"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft, Printer, Loader2, Package, MapPin, Mail, Phone, CreditCard,
  Download, Clock, CheckCircle, XCircle, Truck, BadgeCheck, AlertTriangle,
  Bell, MessageSquare, Send,
} from "lucide-react";

interface Item { id: string; produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number; valor_total: number }
interface Etiqueta { id: string; nome: string; url: string }
interface Pedido {
  id: string; numero: number; status: string;
  tipo_pedido: string | null;
  condicao_pagamento: string | null; prazo_boleto: string | null;
  transportadora: string | null; observacoes: string | null; observacao_admin: string | null;
  horario_postagem: string | null;
  total: number; created_at: string;
  orcamento_itens: Item[];
  orcamento_etiquetas: Etiqueta[];
  clientes: {
    razao_social: string; nome_fantasia: string | null; cnpj: string;
    email: string; whatsapp: string;
    logradouro: string | null; numero: string | null; bairro: string | null; cidade: string | null; estado: string | null;
  } | null;
}

const statusCfg: Record<string, { label: string; color: string }> = {
  enviado:      { label: "Aguardando confirmação", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20"   },
  em_separacao: { label: "Em separação",           color: "text-blue-400   bg-blue-400/10   border-blue-400/20"     },
  a_pagar:      { label: "A pagar",                color: "text-orange-400 bg-orange-400/10 border-orange-400/20"   },
  pago:         { label: "Pago",                   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"},
  recusado:     { label: "Recusado",               color: "text-red-400   bg-red-400/10    border-red-400/20"       },
};

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function MarcaPedidoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [pedido,          setPedido]          = useState<Pedido | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [acting,          setActing]          = useState(false);
  const [motivo,          setMotivo]          = useState("");
  const [showRecusar,     setShowRecusar]     = useState(false);
  const [downloaded,      setDownloaded]      = useState<Set<string>>(new Set());
  const [showAlerta,      setShowAlerta]      = useState(false);
  const [mensagemAlerta,  setMensagemAlerta]  = useState("");
  const [enviandoAlerta,  setEnviandoAlerta]  = useState(false);
  const [novoStatus,      setNovoStatus]      = useState("");
  const confirmedRef = useRef(false);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/marca/pedidos/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPedido(data);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar pedido"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  const STATUS_OPTIONS = [
    { value: "enviado",      label: "Aguardando confirmação" },
    { value: "em_separacao", label: "Em separação"           },
    { value: "a_pagar",      label: "A pagar"                },
    { value: "pago",         label: "Pago"                   },
    { value: "recusado",     label: "Recusado"               },
  ];

  function markDownloaded(etqId: string) {
    setDownloaded((prev) => new Set([...prev, etqId]));
    if (!confirmedRef.current && pedido?.status === "enviado") {
      confirmedRef.current = true;
      doAction("confirmar_recebimento", { etiquetas_confirmadas: true });
    }
  }

  async function doAction(action: string, extra?: Record<string, unknown>) {
    setActing(true);
    try {
      const res = await fetch(`/api/marca/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Atualizado com sucesso!");
      setShowRecusar(false);
      setNovoStatus("");
      router.refresh(); // invalida cache da lista
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setActing(false); }
  }

  const QUICK_MSGS = [
    "Seu pedido não será enviado hoje. Em breve enviaremos uma atualização.",
    "Produto com estoque reduzido — pode haver ajuste na quantidade.",
    "Aguardando confirmação de pagamento para liberar o envio.",
    "Pedido em separação — previsão de envio em 1 dia útil.",
  ];

  async function enviarAlerta() {
    if (!mensagemAlerta.trim()) return;
    setEnviandoAlerta(true);
    try {
      const res = await fetch(`/api/marca/pedidos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "alertar_cliente", mensagem: mensagemAlerta.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Alerta enviado ao cliente!");
      setMensagemAlerta("");
      setShowAlerta(false);
      await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro"); }
    finally { setEnviandoAlerta(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="text-gray-500 animate-spin" />
    </div>
  );

  if (!pedido) return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">Pedido não encontrado.</p>
    </div>
  );

  const sc       = statusCfg[pedido.status] ?? statusCfg.enviado;
  const total    = Number(pedido.total) || pedido.orcamento_itens.reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
  const isDrop   = pedido.tipo_pedido === "dropshipping";
  const cli      = pedido.clientes;
  const etiquetas = pedido.orcamento_etiquetas ?? [];
  const hasEtq   = etiquetas.length > 0;
  // For DROP: all etiquetas must be downloaded before confirming
  const allEtqDownloaded = !isDrop || !hasEtq || downloaded.size >= etiquetas.length;
  const missingDownloads = etiquetas.filter(e => !downloaded.has(e.id)).length;

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/marca/pedidos"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white transition-all"
          >
            <ArrowLeft size={15} />
          </Link>
          <div className="flex-1">
            <h1 className="text-sm font-bold text-white">Pedido #{pedido.numero}</h1>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sc.color}`}>{sc.label}</span>
          </div>
          <button
            onClick={() => window.open(`/api/marca/imprimir?ids=${pedido.id}`, "_blank")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all"
          >
            <Printer size={12} /> Imprimir
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-4">

        {/* ── Ação: Confirmar recebimento (status = enviado) ── */}
        {pedido.status === "enviado" && (
          <div className="space-y-3">
            {/* Etiquetas para download (DROP) — aparecem ANTES do botão de confirmação */}
            {isDrop && hasEtq && (
              <div className="bg-dark-800 border border-blue-400/25 rounded-2xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
                  <Download size={13} className="text-blue-400" />
                  <h2 className="text-sm font-bold text-white">Etiquetas de envio</h2>
                  <span className="ml-auto text-xs font-semibold">
                    {downloaded.size >= etiquetas.length
                      ? <span className="text-emerald-400">Todas baixadas ✓</span>
                      : <span className="text-yellow-400">{missingDownloads} pendente{missingDownloads !== 1 ? "s" : ""}</span>
                    }
                  </span>
                </div>
                <div className="divide-y divide-white/5">
                  {etiquetas.map((etq) => {
                    const done = downloaded.has(etq.id);
                    return (
                      <div key={etq.id} className={`px-5 py-3 flex items-center gap-3 transition-colors ${done ? "bg-emerald-500/5" : ""}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border ${done ? "bg-emerald-500/15 border-emerald-500/25" : "bg-blue-500/10 border-blue-500/20"}`}>
                          {done
                            ? <CheckCircle size={14} className="text-emerald-400" />
                            : <Download size={13} className="text-blue-400" />
                          }
                        </div>
                        <span className={`text-sm flex-1 truncate ${done ? "text-gray-500 line-through" : "text-gray-300"}`}>{etq.nome}</span>
                        <a
                          href={etq.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download={etq.nome}
                          onClick={() => markDownloaded(etq.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex-shrink-0 ${
                            done
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/25"
                              : "bg-blue-500 hover:bg-blue-600 text-white"
                          }`}
                        >
                          <Download size={11} /> {done ? "Baixado" : "Baixar"}
                        </a>
                      </div>
                    );
                  })}
                </div>
                {!allEtqDownloaded && (
                  <div className="px-5 py-3 border-t border-white/8 bg-yellow-400/5">
                    <p className="text-xs text-yellow-400">
                      Baixe todas as etiquetas antes de confirmar o recebimento.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Painel de ações */}
            <div className="bg-dark-800 border border-yellow-400/20 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0" />
                <p className="text-sm font-bold text-yellow-400">Novo pedido — confirme o recebimento</p>
                {isDrop && (
                  <span className="ml-auto text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">DROP</span>
                )}
              </div>
              {!showRecusar ? (
                <div className="flex gap-3 flex-wrap">
                  <button
                    onClick={() => doAction("confirmar_recebimento", { etiquetas_confirmadas: allEtqDownloaded })}
                    disabled={acting || !allEtqDownloaded}
                    title={!allEtqDownloaded ? "Baixe todas as etiquetas primeiro" : undefined}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-green-500 hover:bg-green-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {acting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle size={13} />}
                    Confirmar recebimento
                  </button>
                  <button
                    onClick={() => setShowRecusar(true)}
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 text-sm font-bold rounded-xl transition-all"
                  >
                    <XCircle size={13} /> Recusar
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    placeholder="Motivo da recusa (opcional)"
                    rows={2}
                    className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand/50 resize-none"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => doAction("recusar", { motivo })}
                      disabled={acting}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
                    >
                      {acting ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />}
                      Confirmar recusa
                    </button>
                    <button onClick={() => setShowRecusar(false)} className="px-4 py-2.5 bg-dark-700 border border-white/10 text-gray-400 text-sm rounded-xl">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Ação: Marcar como enviado (status = em_separacao) ── */}
        {pedido.status === "em_separacao" && (
          <div className="bg-dark-800 border border-blue-400/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Package size={15} className="text-blue-400 flex-shrink-0" />
              <p className="text-sm font-bold text-blue-400">Em separação — pronto para envio?</p>
            </div>
            <p className="text-xs text-gray-500">Quando o pedido for despachado, clique abaixo para notificar o cliente.</p>
            <button
              onClick={() => doAction("marcar_enviado")}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {acting ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />}
              Marcar como enviado
            </button>
          </div>
        )}

        {/* ── Ação: Confirmar pagamento (status = a_pagar) ── */}
        {pedido.status === "a_pagar" && (
          <div className="bg-dark-800 border border-orange-400/20 rounded-2xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CreditCard size={15} className="text-orange-400 flex-shrink-0" />
              <p className="text-sm font-bold text-orange-400">Pedido enviado — aguardando pagamento</p>
            </div>
            <p className="text-xs text-gray-500">Confirme o pagamento quando o cliente quitar o valor deste pedido.</p>
            <button
              onClick={() => doAction("confirmar_pagamento")}
              disabled={acting}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50"
            >
              {acting ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
              Confirmar pagamento
            </button>
          </div>
        )}

        {/* ── Pago ── */}
        {pedido.status === "pago" && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-4 flex items-center gap-3">
            <BadgeCheck size={18} className="text-emerald-400 flex-shrink-0" />
            <p className="text-sm font-bold text-emerald-400">Pedido pago e finalizado</p>
          </div>
        )}

        {/* ── Horário de postagem (dropshipping) ── */}
        {isDrop && pedido.horario_postagem && (
          <div className="bg-blue-500/10 border border-blue-500/25 rounded-2xl p-5 flex items-center gap-3">
            <Clock size={16} className="text-blue-400 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-blue-400 uppercase tracking-wide">Horário limite de postagem</p>
              <p className="text-sm font-bold text-white mt-0.5">
                {new Date(pedido.horario_postagem).toLocaleString("pt-BR", {
                  day: "2-digit", month: "2-digit", year: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        )}

        {/* ── Etiquetas (dropshipping) ── */}
        {(pedido.orcamento_etiquetas ?? []).length > 0 && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
              <Download size={13} className="text-gray-500" />
              <h2 className="text-sm font-bold text-white">Etiquetas de envio</h2>
              <span className="ml-auto text-xs text-gray-600">{pedido.orcamento_etiquetas.length} arquivo{pedido.orcamento_etiquetas.length !== 1 ? "s" : ""}</span>
            </div>
            <div className="divide-y divide-white/5">
              {pedido.orcamento_etiquetas.map((etq) => (
                <div key={etq.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Download size={13} className="text-blue-400" />
                  </div>
                  <span className="text-sm text-gray-300 flex-1 truncate">{etq.nome}</span>
                  <a
                    href={etq.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={etq.nome}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all flex-shrink-0"
                  >
                    <Download size={11} /> Baixar
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Cliente ── */}
        {cli && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Cliente</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-bold text-white">{cli.razao_social}</p>
                {cli.nome_fantasia && <p className="text-xs text-gray-500">{cli.nome_fantasia}</p>}
                <p className="text-xs text-gray-600 mt-0.5">{cli.cnpj}</p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-400"><Mail size={11} /> {cli.email}</div>
                <div className="flex items-center gap-2 text-xs text-gray-400"><Phone size={11} /> {cli.whatsapp}</div>
                {cli.cidade && (
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <MapPin size={11} /> {cli.cidade}/{cli.estado}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Itens ── */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
            <Package size={13} className="text-gray-500" />
            <h2 className="text-sm font-bold text-white">Itens do pedido</h2>
          </div>
          <div className="divide-y divide-white/5">
            {pedido.orcamento_itens.map((item) => (
              <div key={item.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.produto_nome}</p>
                  <p className="text-[10px] text-gray-600 font-mono">{item.produto_sku}</p>
                </div>
                <span className="text-sm text-gray-400 flex-shrink-0">{item.quantidade}×</span>
                <span className="text-xs text-gray-500 flex-shrink-0">{fmt(Number(item.valor_unitario ?? 0))}</span>
                <span className="text-sm font-bold text-white flex-shrink-0">{fmt(Number(item.valor_total ?? 0))}</span>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div className="px-5 py-3 border-t border-white/8 bg-white/2 flex items-center justify-between">
              <span className="text-xs text-gray-500">{pedido.orcamento_itens.length} produto{pedido.orcamento_itens.length !== 1 ? "s" : ""}</span>
              <span className="text-base font-black text-white">{fmt(total)}</span>
            </div>
          )}
        </div>

        {/* ── Condições ── */}
        {(pedido.condicao_pagamento || pedido.transportadora || pedido.observacoes || pedido.observacao_admin) && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-3">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Condições</h2>
            <div className="grid grid-cols-2 gap-3">
              {pedido.condicao_pagamento && (
                <div className="flex items-start gap-2">
                  <CreditCard size={12} className="text-gray-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-gray-500">Pagamento</p>
                    <p className="text-xs text-white font-medium">
                      {pedido.condicao_pagamento === "pix" ? "PIX" : pedido.condicao_pagamento === "semanal" ? "Semanal" : `Boleto${pedido.prazo_boleto ? ` ${pedido.prazo_boleto}d` : ""}`}
                    </p>
                  </div>
                </div>
              )}
              {pedido.transportadora && (
                <div>
                  <p className="text-[10px] text-gray-500">Transportadora</p>
                  <p className="text-xs text-white font-medium">{pedido.transportadora}</p>
                </div>
              )}
            </div>
            {pedido.observacoes && (
              <div className="bg-dark-900/60 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-500 mb-0.5">Observações</p>
                <p className="text-xs text-gray-300 italic">{pedido.observacoes}</p>
              </div>
            )}
            {pedido.observacao_admin && (
              <div className="bg-dark-900/60 rounded-xl px-3 py-2">
                <p className="text-[10px] text-gray-500 mb-0.5">
                  {pedido.status === "recusado" ? "Motivo da recusa" : "Mensagem enviada ao cliente"}
                </p>
                <p className="text-xs text-gray-300 italic">{pedido.observacao_admin}</p>
              </div>
            )}
          </div>
        )}
        {/* ── Ferramentas ── */}
        {pedido.status !== "recusado" && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
              <Bell size={13} className="text-gray-500" />
              <h2 className="text-sm font-bold text-white">Ferramentas</h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Imprimir */}
              <button
                onClick={() => window.open(`/api/marca/imprimir?ids=${pedido.id}`, "_blank")}
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
              >
                <Printer size={13} /> Imprimir pedido
              </button>

              {/* Alterar status */}
              <div className="border-t border-white/6 pt-4 space-y-3">
                <div>
                  <p className="text-xs font-bold text-white">Alterar status</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Alteração manual — não envia notificações automáticas</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={novoStatus || pedido.status}
                    onChange={(e) => setNovoStatus(e.target.value)}
                    className="flex-1 px-3 py-2 bg-dark-900 border border-white/10 rounded-xl text-white text-xs focus:outline-none focus:border-brand/50 transition-all"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => doAction("mudar_status", { novoStatus: novoStatus || pedido.status })}
                    disabled={acting || (novoStatus === "" || novoStatus === pedido.status)}
                    className="px-4 py-2 bg-dark-700 border border-white/10 hover:border-white/25 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40"
                  >
                    {acting ? <Loader2 size={12} className="animate-spin" /> : "Salvar"}
                  </button>
                </div>
              </div>

              {/* Alertar cliente */}
              <div className="border-t border-white/6 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white">Alertar cliente</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">Envia email, WhatsApp e notificação in-app</p>
                  </div>
                  <button
                    onClick={() => { setShowAlerta(!showAlerta); setMensagemAlerta(""); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                      showAlerta
                        ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
                        : "bg-dark-700 border-white/10 text-gray-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    <MessageSquare size={11} />
                    {showAlerta ? "Cancelar" : "Nova mensagem"}
                  </button>
                </div>

                {showAlerta && (
                  <div className="space-y-3">
                    {/* Atalhos rápidos */}
                    <div className="flex flex-wrap gap-2">
                      {QUICK_MSGS.map((m) => (
                        <button
                          key={m}
                          onClick={() => setMensagemAlerta(m)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg border transition-all ${
                            mensagemAlerta === m
                              ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
                              : "bg-dark-700 border-white/8 text-gray-500 hover:text-gray-300 hover:border-white/15"
                          }`}
                        >
                          {m.length > 42 ? `${m.slice(0, 42)}…` : m}
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={mensagemAlerta}
                      onChange={(e) => setMensagemAlerta(e.target.value)}
                      placeholder="Escreva a mensagem para o cliente…"
                      rows={3}
                      className="w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-orange-500/50 resize-none"
                    />

                    <div className="flex items-center gap-3">
                      <button
                        onClick={enviarAlerta}
                        disabled={enviandoAlerta || !mensagemAlerta.trim()}
                        className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-40"
                      >
                        {enviandoAlerta ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                        Enviar alerta
                      </button>
                      <p className="text-[11px] text-gray-600">{mensagemAlerta.length}/500 caracteres</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
