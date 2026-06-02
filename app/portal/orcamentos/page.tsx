import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { Plus, FileText, ChevronRight, ArrowLeft, AlertCircle, AlertTriangle, Clock } from "lucide-react";
import PrintOrderButton from "./PrintOrderButton";

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  rascunho:     { label: "Rascunho",          color: "text-gray-400   bg-gray-400/10   border-gray-400/20",   dot: "bg-gray-500"    },
  enviado:      { label: "Aguardando",         color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", dot: "bg-yellow-400"  },
  em_separacao: { label: "Em separação",       color: "text-blue-400   bg-blue-400/10   border-blue-400/20",   dot: "bg-blue-500"    },
  a_pagar:      { label: "Enviado — A pagar",  color: "text-orange-400 bg-orange-400/10 border-orange-400/20", dot: "bg-orange-500"  },
  pago:         { label: "Pago",               color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",dot: "bg-emerald-500"},
  recusado:     { label: "Recusado",           color: "text-red-400    bg-red-400/10    border-red-400/20",    dot: "bg-red-500"     },
};

const statusTabs = [
  { key: "todos",        label: "Todos"          },
  { key: "enviado",      label: "Aguardando"     },
  { key: "em_separacao", label: "Em separação"   },
  { key: "a_pagar",      label: "A pagar"        },
  { key: "pago",         label: "Pagos"          },
  { key: "recusado",     label: "Recusados"      },
  { key: "rascunho",     label: "Rascunhos"      },
] as const;

type StatusFiltro = (typeof statusTabs)[number]["key"];

function clienteStatusLabel(status: string) {
  return statusConfig[status]?.label ?? status;
}

function getStatusFiltro(status?: string): StatusFiltro {
  return statusTabs.some((tab) => tab.key === status) ? status as StatusFiltro : "todos";
}

export default async function OrcamentosPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const filtroAtivo = getStatusFiltro(params?.status);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: cliente } = await supabase
    .from("clientes").select("id, status").eq("user_id", user.id).single();

  if (!cliente || cliente.status !== "aprovado") redirect("/portal/dashboard");

  const { data: orcamentos } = await supabase
    .from("orcamentos")
    .select("id, numero, status, status_pagamento, tipo_pedido, marca, condicao_pagamento, prazo_boleto, total, created_at, horario_postagem, orcamento_itens(quantidade, valor_unitario)")
    .eq("cliente_id", cliente.id)
    .order("created_at", { ascending: false });

  const allOrcamentos = orcamentos ?? [];
  const filteredOrcamentos = filtroAtivo === "todos"
    ? allOrcamentos
    : allOrcamentos.filter((o) => o.status === filtroAtivo);

  const counts = Object.fromEntries(
    statusTabs.map((tab) => [
      tab.key,
      tab.key === "todos"
        ? allOrcamentos.length
        : allOrcamentos.filter((o) => o.status === tab.key).length,
    ])
  ) as Record<StatusFiltro, number>;

  // Busca logos das marcas usadas
  const slugs = [...new Set(allOrcamentos.map(o => o.marca).filter(Boolean))] as string[];
  const { data: marcas } = slugs.length
    ? await supabase.from("marcas").select("slug, name, logo_url").in("slug", slugs)
    : { data: [] };
  const brandMap = Object.fromEntries((marcas ?? []).map(m => [m.slug, m]));
  const nowMs = new Date().getTime();

  function prazoStatus(horario: string | null | undefined): "overdue" | "soon" | "ok" | "none" {
    if (!horario) return "none";
    const diff = new Date(horario).getTime() - nowMs;
    if (diff < 0) return "overdue";
    if (diff < 48 * 60 * 60 * 1000) return "soon";
    return "ok";
  }

  function formatPrazoBR(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/dashboard"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all flex-shrink-0"
            >
              <ArrowLeft size={15} />
            </Link>
            <h1 className="text-sm font-bold text-white">Meus Pedidos</h1>
          </div>
          <Link href="/portal/orcamentos/novo"
            className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded-xl transition-all"
          >
            <Plus size={13} /> Novo pedido
          </Link>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        {!allOrcamentos.length ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <FileText size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Nenhum pedido criado ainda.</p>
            <Link href="/portal/orcamentos/novo"
              className="inline-block mt-4 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
            >
              Criar primeiro pedido
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {statusTabs.map((tab) => {
                const active = filtroAtivo === tab.key;
                const href = tab.key === "todos" ? "/portal/orcamentos" : `/portal/orcamentos?status=${tab.key}`;

                return (
                  <Link
                    key={tab.key}
                    href={href}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                      active
                        ? "bg-brand border-brand text-white"
                        : "bg-dark-800 border-white/8 text-gray-400 hover:text-white hover:border-white/20"
                    }`}
                  >
                    {tab.label} ({counts[tab.key]})
                  </Link>
                );
              })}
            </div>

            {filteredOrcamentos.length === 0 ? (
              <div className="bg-dark-800 border border-white/8 rounded-2xl p-10 text-center">
                <FileText size={30} className="text-gray-700 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Nenhum pedido nesta aba.</p>
              </div>
            ) : (
              <div className="bg-dark-800 border border-white/8 rounded-2xl divide-y divide-white/5">
                {filteredOrcamentos.map((o) => {
              const s      = statusConfig[o.status] ?? statusConfig.enviado;
              const brand  = o.marca ? brandMap[o.marca] : null;
              const itens  = (o.orcamento_itens ?? []) as { quantidade: number; valor_unitario: number }[];
              const qtdTotal = itens.reduce((acc, i) => acc + (i.quantidade ?? 0), 0);
              const total    = Number(o.total) || itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0);
              const isDrop   = o.tipo_pedido === "dropshipping";
              const pStatus  = isDrop && o.status === "em_separacao" ? prazoStatus((o as { horario_postagem?: string | null }).horario_postagem) : "none";
              const hp       = (o as { horario_postagem?: string | null }).horario_postagem;

              return (
                <div key={o.id} className={`flex flex-col gap-2 ${pStatus === "overdue" ? "bg-red-500/5" : pStatus === "soon" ? "bg-yellow-400/5" : ""}`}>
                  {/* Row principal */}
                  <div className="flex items-center">
                    <Link href={`/portal/orcamentos/${o.id}`}
                      className="flex-1 flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4 hover:bg-white/3 transition-colors"
                    >
                      {/* Logo da marca */}
                      <div className="w-12 sm:w-14 h-9 flex-shrink-0 flex items-center justify-center bg-dark-900 border border-white/8 rounded-lg px-1.5">
                        {brand?.logo_url ? (
                          <Image src={brand.logo_url} alt={brand.name} width={44} height={24} className="object-contain h-5 w-auto opacity-80" />
                        ) : (
                          <FileText size={13} className="text-gray-600" />
                        )}
                      </div>

                      {/* Infos principais */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">Pedido #{o.numero}</p>
                          {brand && <span className="text-[10px] text-gray-600 uppercase tracking-wide hidden sm:inline">{brand.name}</span>}
                          {o.tipo_pedido && (
                            <span className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${
                              isDrop
                                ? "bg-blue-500/15 text-blue-400 border-blue-500/20"
                                : "bg-gray-500/15 text-gray-400 border-gray-500/20"
                            }`}>
                              {isDrop ? "DROP" : "ATACADO"}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(o.created_at).toLocaleDateString("pt-BR")}
                          {o.condicao_pagamento && ` · ${o.condicao_pagamento === "pix" ? "PIX" : o.condicao_pagamento === "semanal" ? "Semanal" : `Boleto${o.prazo_boleto ? ` ${o.prazo_boleto}d` : ""}`}`}
                        </p>
                        {/* Mobile: quantidade + total */}
                        <div className="flex items-center gap-3 mt-1.5 sm:hidden">
                          {qtdTotal > 0 && (
                            <span className="text-[11px] text-gray-500">
                              {qtdTotal} {qtdTotal === 1 ? "item" : "itens"}
                            </span>
                          )}
                          {total > 0 && (
                            <span className="text-[11px] font-bold text-white">
                              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status + total (desktop) */}
                      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
                        <span className={`text-[10px] sm:text-xs font-semibold px-2 sm:px-2.5 py-1 rounded-full border ${s.color}`}>
                          {clienteStatusLabel(o.status)}
                        </span>
                        {total > 0 && (
                          <span className="text-sm font-bold text-white hidden sm:block">
                            {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        )}
                        <ChevronRight size={14} className="text-gray-600" />
                      </div>
                    </Link>
                    <div className="pr-3 flex-shrink-0">
                      <PrintOrderButton orderId={o.id} />
                    </div>
                  </div>

                  {/* Alerta de prazo limite de postagem */}
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
        )}
      </div>
    </div>
  );
}
