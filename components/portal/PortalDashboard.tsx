"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Clock, CheckCircle, XCircle, LogOut, FileText, Plus,
  Loader2, ChevronRight, Package,
  TrendingUp, DollarSign, BarChart3, Lock, Truck, PackageCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Metrics {
  emAprovacao: number;
  aprovados: number;
  emEnvio: number;
  totalPedidos: number;
  totalGasto: number;
  aPagar: number;
  porMarca: { marca: string; total: number; pedidos: number }[];
  topProdutos: { sku: string; nome: string; quantidade: number; total: number }[];
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

interface Order {
  id: string;
  numero: number;
  status: string;
  marca: string | null;
  total: number;
  created_at: string;
  orcamento_itens: { quantidade: number }[];
}

interface Cliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string | null;
  cnpj: string;
  inscricao_estadual?: string | null;
  bloqueado?: boolean | null;
  status: "pendente" | "aprovado" | "reprovado";
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  email: string;
  whatsapp: string;
  observacao_admin?: string | null;
}

const statusConfig = {
  pendente:  { icon: Clock,        color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20", label: "Aguardando aprovação" },
  aprovado:  { icon: CheckCircle,  color: "text-green-400",  bg: "bg-green-400/10  border-green-400/20",  label: "Cadastro aprovado" },
  reprovado: { icon: XCircle,      color: "text-red-400",    bg: "bg-red-400/10    border-red-400/20",    label: "Cadastro reprovado" },
};


const orderStatus: Record<string, { label: string; color: string; dot: string }> = {
  rascunho:     { label: "Rascunho",         color: "text-gray-400",   dot: "bg-gray-400"    },
  enviado:      { label: "Aguardando",        color: "text-yellow-400", dot: "bg-yellow-400"  },
  em_separacao: { label: "Em separação",      color: "text-blue-400",   dot: "bg-blue-500"    },
  a_pagar:      { label: "A pagar",           color: "text-orange-400", dot: "bg-orange-500"  },
  pago:         { label: "Pago",              color: "text-emerald-400",dot: "bg-emerald-500" },
  recusado:     { label: "Recusado",          color: "text-red-400",    dot: "bg-red-500"     },
};

export default function PortalDashboard({
  cliente, dbError, userEmail, orders = [],
}: {
  cliente: Cliente | null; dbError?: string; userEmail?: string; orders?: Order[];
}) {
  const router = useRouter();
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    fetch("/api/portal/dashboard")
      .then((r) => r.json())
      .then((d) => { if (!d.error) setMetrics(d); })
      .catch(() => {});
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  if (!cliente) {
    const isTableMissing = dbError?.includes("relation") || dbError?.includes("does not exist");
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-dark-800 border border-white/10 rounded-2xl p-6 text-center space-y-4">
          <p className="text-white font-bold">Cadastro não encontrado</p>
          <p className="text-gray-500 text-sm">
            {isTableMissing
              ? "As tabelas do banco ainda não foram criadas. Rode o SQL em supabase/schema.sql no Supabase SQL Editor."
              : "Seu cadastro não foi encontrado."}
          </p>
          {dbError && <p className="text-xs font-mono text-red-400 bg-red-400/10 rounded-lg px-3 py-2 text-left">{dbError}</p>}
          {userEmail && <p className="text-xs text-gray-600">Conta: {userEmail}</p>}
          <div className="flex flex-col gap-2">
            <a href="/portal/registro" className="py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all">
              Refazer cadastro
            </a>
            <button onClick={handleLogout} className="py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm transition-all">
              Sair
            </button>
          </div>
        </div>
      </div>
    );
  }

  const status      = statusConfig[cliente.status];
  const StatusIcon  = status.icon;
  const isApproved  = cliente.status === "aprovado";
  const isBloqueado = !!cliente.bloqueado;

  return (
    <div className="min-h-screen">
      {/* Header apenas no desktop — no mobile o PortalShell já renderiza o header */}
      <header className="hidden md:block bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Image src="/images/ph.png" alt="PH Representante" width={120} height={32} className="object-contain h-8 w-auto" />
          <div className="flex items-center gap-4">
            <span className="text-xs text-gray-500 truncate max-w-[220px]">{cliente.razao_social}</span>
            <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-white transition-colors">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* Status banner */}
        <div className={`flex items-start gap-4 p-5 rounded-2xl border ${status.bg}`}>
          <StatusIcon size={22} className={`${status.color} flex-shrink-0 mt-0.5`} />
          <div>
            <p className={`font-bold text-sm ${status.color}`}>{status.label}</p>
            {cliente.status === "pendente" && (
              <p className="text-xs text-gray-500 mt-1">Seu cadastro está em análise. Você receberá um e-mail quando for aprovado.</p>
            )}
            {cliente.status === "aprovado" && (
              <p className="text-xs text-gray-400 mt-1">Você tem acesso completo ao portal. Crie e gerencie seus pedidos.</p>
            )}
            {cliente.status === "reprovado" && cliente.observacao_admin && (
              <p className="text-xs text-gray-400 mt-1">Motivo: {cliente.observacao_admin}</p>
            )}
          </div>
        </div>

        {/* Banner de bloqueio */}
        {isBloqueado && (
          <div className="flex items-start gap-4 p-5 rounded-2xl border bg-red-400/10 border-red-400/25">
            <Lock size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-red-400">Conta bloqueada para novos pedidos</p>
              <p className="text-xs text-red-300/70 mt-1">
                Sua conta está temporariamente bloqueada por pendência de pagamento.
                Entre em contato com a PH Representante para regularizar e liberar novos pedidos.
              </p>
            </div>
          </div>
        )}

        {/* Métricas — só para clientes aprovados */}
        {isApproved && metrics && (
          <div className="space-y-4">

            {/* KPIs operacionais */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "Em aprovação",    value: metrics.emAprovacao,  icon: Clock,         color: "text-yellow-400", bg: "bg-yellow-400/8", href: "/portal/orcamentos" },
                { label: "Aprovados",       value: metrics.aprovados,    icon: PackageCheck,  color: "text-blue-400",   bg: "bg-blue-400/8",   href: "/portal/orcamentos" },
                { label: "Em envio",        value: metrics.emEnvio,      icon: Truck,         color: "text-orange-400", bg: "bg-orange-400/8", href: "/portal/orcamentos" },
                { label: "Total de pedidos",value: metrics.totalPedidos, icon: Package,       color: "text-gray-400",   bg: "bg-white/5",      href: "/portal/orcamentos" },
              ].map(({ label, value, icon: Icon, color, bg, href }) => (
                <Link key={label} href={href} className="bg-dark-800 border border-white/8 rounded-2xl p-4 hover:border-white/15 transition-all group">
                  <div className={`inline-flex p-2 rounded-xl ${bg} mb-3`}>
                    <Icon size={13} className={color} />
                  </div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1 leading-tight">{label}</p>
                  <p className={`text-2xl font-black leading-tight ${color}`}>{value}</p>
                </Link>
              ))}
            </div>

            {/* KPIs financeiros */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-dark-800 border border-white/8 rounded-2xl p-4">
                <div className="inline-flex p-2 rounded-xl bg-emerald-400/8 mb-3">
                  <TrendingUp size={13} className="text-emerald-400" />
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Total Comprado</p>
                <p className="text-base font-black text-emerald-400">{fmt(metrics.totalGasto)}</p>
              </div>
              <div className="bg-dark-800 border border-white/8 rounded-2xl p-4">
                <div className="inline-flex p-2 rounded-xl bg-yellow-400/8 mb-3">
                  <DollarSign size={13} className="text-yellow-400" />
                </div>
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">A Pagar</p>
                <p className="text-base font-black text-yellow-400">{fmt(metrics.aPagar)}</p>
              </div>
            </div>

            {/* Marca + Produtos — só mostrar se houver dados */}
            {(metrics.porMarca.length > 0 || metrics.topProdutos.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Por Marca */}
                {metrics.porMarca.length > 0 && (() => {
                  const maxT = metrics.porMarca[0].total;
                  return (
                    <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
                        <BarChart3 size={13} className="text-gray-500" />
                        <h3 className="text-xs font-bold text-white">Compras por Marca</h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {metrics.porMarca.slice(0, 6).map(({ marca, total, pedidos }) => (
                          <div key={marca}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-white truncate max-w-[130px]">{marca}</span>
                              <div className="flex-shrink-0 ml-2 text-right">
                                <span className="text-xs font-black text-white">{fmt(total)}</span>
                                <span className="text-[10px] text-gray-600 ml-1">{pedidos}p</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-dark-900 rounded-full overflow-hidden">
                              <div className="h-full bg-brand rounded-full" style={{ width: `${Math.max(4, (total / maxT) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Top Produtos */}
                {metrics.topProdutos.length > 0 && (() => {
                  const maxQ = metrics.topProdutos[0].quantidade;
                  return (
                    <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
                      <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
                        <Package size={13} className="text-gray-500" />
                        <h3 className="text-xs font-bold text-white">Produtos Mais Comprados</h3>
                      </div>
                      <div className="p-4 space-y-3">
                        {metrics.topProdutos.slice(0, 6).map(({ sku, nome, quantidade }, idx) => (
                          <div key={sku}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black text-gray-600 w-4 text-center flex-shrink-0">{idx + 1}</span>
                              <span className="text-xs font-semibold text-white flex-1 truncate">{nome}</span>
                              <span className="text-xs font-black text-white flex-shrink-0">{quantidade}×</span>
                            </div>
                            <div className="ml-6 h-1.5 bg-dark-900 rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.max(4, (quantidade / maxQ) * 100)}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Pedidos */}
        {isApproved ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Meus Pedidos</h2>
              {isBloqueado ? (
                <span className="flex items-center gap-1.5 px-4 py-2 bg-red-400/10 text-red-400 text-xs font-bold rounded-xl border border-red-400/25 cursor-not-allowed">
                  <Lock size={13} /> Bloqueado
                </span>
              ) : (
                <Link href="/portal/orcamentos/novo"
                  className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all"
                >
                  <Plus size={13} /> Novo pedido
                </Link>
              )}
            </div>

            {/* Contadores de status */}
            {orders.length > 0 && (() => {
              const emAndamento = orders.filter(o => o.status === "rascunho" || o.status === "enviado").length;
              const aprovados   = orders.filter(o => o.status === "aprovado").length;
              const recusados   = orders.filter(o => o.status === "recusado").length;
              return (
                <div className="grid grid-cols-3 divide-x divide-white/8 border-b border-white/8">
                  {[
                    { label: "Em andamento", value: emAndamento, color: "text-yellow-400" },
                    { label: "Aprovados",    value: aprovados,   color: "text-green-400"  },
                    { label: "Recusados",    value: recusados,   color: "text-red-400"    },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="px-4 py-3 text-center">
                      <p className={`text-xl font-black ${value > 0 ? color : "text-gray-600"}`}>{value}</p>
                      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Lista de pedidos recentes */}
            {orders.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <Package size={28} className="text-gray-700 mx-auto mb-2" />
                <p className="text-gray-600 text-xs">Nenhum pedido ainda.</p>
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {orders.slice(0, 5).map((o) => {
                  const s    = orderStatus[o.status] ?? orderStatus.enviado;
                  const qtd  = o.orcamento_itens?.reduce((acc, i) => acc + (i.quantidade ?? 0), 0) ?? 0;
                  return (
                    <Link key={o.id} href={`/portal/orcamentos/${o.id}`}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-white/3 transition-colors"
                    >
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.dot}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">#{o.numero}</p>
                          {o.marca && <span className="text-[10px] text-gray-600 uppercase tracking-wide">{o.marca}</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")}
                          {qtd > 0 && ` · ${qtd} ${qtd === 1 ? "item" : "itens"}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="text-right">
                          <span className={`text-[10px] font-semibold ${s.color}`}>{s.label}</span>
                          {Number(o.total) > 0 && (
                            <p className="text-xs font-bold text-white mt-0.5">
                              {Number(o.total).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
                          )}
                        </div>
                        <ChevronRight size={13} className="text-gray-600" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Ver todos */}
            {orders.length > 0 && (
              <Link href="/portal/orcamentos"
                className="flex items-center justify-center gap-1.5 px-5 py-3 border-t border-white/8 text-xs text-gray-500 hover:text-white transition-colors hover:bg-white/3"
              >
                Ver todos os pedidos <ChevronRight size={12} />
              </Link>
            )}
          </div>
        ) : (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-10 text-center">
            <FileText size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Pedidos disponíveis após aprovação do cadastro.</p>
          </div>
        )}
      </div>
    </div>
  );
}
