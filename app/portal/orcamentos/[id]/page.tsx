import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, MapPin, Phone, Mail, CreditCard, Truck, MessageSquare, Building2, Package, FileText, ExternalLink } from "lucide-react";
import OrcamentoActions from "./OrcamentoActions";
import PrintButton from "./PrintButton";
import PostagemField from "./PostagemField";

const statusConfig: Record<string, { label: string; color: string }> = {
  rascunho:     { label: "Rascunho",              color: "text-gray-400   bg-gray-400/10   border-gray-400/20"   },
  enviado:      { label: "Aguardando confirmação", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  em_separacao: { label: "Em separação",           color: "text-blue-400   bg-blue-400/10   border-blue-400/20"   },
  a_pagar:      { label: "Enviado — A pagar",      color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  pago:         { label: "Pago",                   color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"},
  recusado:     { label: "Recusado",               color: "text-red-400    bg-red-400/10    border-red-400/20"    },
};

function clienteStatus(status: string) {
  if (status === "enviado") {
    return {
      label: "Aguardando confirmação da marca",
      text: "Seu pedido foi enviado e está aguardando confirmação de recebimento pela marca.",
      color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    };
  }
  if (status === "em_separacao") {
    return {
      label: "Em separação",
      text: "A marca confirmou o recebimento e está separando os produtos para envio.",
      color: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    };
  }
  if (status === "a_pagar") {
    return {
      label: "Enviado — Aguardando pagamento",
      text: "Seu pedido foi despachado! O valor será cobrado conforme a condição de pagamento acordada.",
      color: "text-orange-400 bg-orange-400/10 border-orange-400/20",
    };
  }
  if (status === "pago") {
    return {
      label: "Pago — Pedido finalizado",
      text: "Pagamento confirmado. Obrigado!",
      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    };
  }
  if (status === "recusado") {
    return {
      label: "Pedido recusado pela marca",
      text: "Confira abaixo o motivo informado.",
      color: "text-red-400 bg-red-400/10 border-red-400/20",
    };
  }
  return {
    label: statusConfig[status]?.label ?? status,
    text: "",
    color: statusConfig[status]?.color ?? statusConfig.enviado.color,
  };
}

interface Item {
  id: string; produto_sku: string; produto_nome: string;
  quantidade: number; valor_unitario: number; valor_total: number;
}

interface Cliente {
  razao_social: string; nome_fantasia: string | null; cnpj: string;
  cidade: string | null; estado: string | null; logradouro: string | null;
  numero: string | null; complemento: string | null; bairro: string | null;
  email: string; whatsapp: string;
}

export default async function OrcamentoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: orcamento } = await supabase
    .from("orcamentos")
    .select("*, orcamento_itens(*), orcamento_etiquetas(*), clientes(razao_social, nome_fantasia, cnpj, cidade, estado, logradouro, numero, complemento, bairro, email, whatsapp)")
    .eq("id", id)
    .single();

  if (!orcamento) notFound();

  const status  = statusConfig[orcamento.status] ?? statusConfig.enviado;
  const statusCliente = clienteStatus(orcamento.status);
  const itens: Item[] = orcamento.orcamento_itens ?? [];
  const total   = itens.reduce((s, i) => s + Number(i.valor_total ?? 0), 0);
  const canEdit = orcamento.status === "rascunho";
  const cliente = orcamento.clientes as unknown as Cliente | null;

  const { data: brand } = orcamento.marca
    ? await supabase.from("marcas").select("slug, name, razao_social, segment, logo_url, cnpj, email, telefone, contato, logradouro, numero, bairro, cidade, estado").eq("slug", orcamento.marca).single()
    : { data: null };

  const dataBR = new Date(orcamento.created_at).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });
  const horaBR = new Date(orcamento.created_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen">

      {/* Nav — oculto na impressão */}
      <header className="print:hidden bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/portal/orcamentos"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all flex-shrink-0"
            >
              <ArrowLeft size={15} />
            </Link>
            <h1 className="text-sm font-bold text-white">Pedido #{orcamento.numero}</h1>
          </div>
          <div className="flex items-center gap-2">
            <PrintButton orderId={orcamento.id} />
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${status.color}`}>
              {status.label}
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className={`print:hidden border rounded-2xl p-4 ${statusCliente.color}`}>
          <p className="text-sm font-black">{statusCliente.label}</p>
          <p className="text-xs opacity-80 mt-1">{statusCliente.text}</p>
        </div>

        {/* ── Documento imprimível ── */}
        <div id="print-doc" className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">

          {/* Cabeçalho */}
          <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <Image
                src="/images/ph.png"
                alt="PH Representante"
                width={140} height={48}
                className="object-contain h-10 w-auto"
              />
              <p className="text-[10px] text-gray-500 mt-1.5">Intermediário Comercial</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Pedido</p>
              <p className="text-2xl font-black text-white leading-none mt-0.5">#{orcamento.numero}</p>
              <p className="text-xs text-gray-500 mt-1">{dataBR} · {horaBR}</p>
              {orcamento.tipo_pedido && (
                <span className={`inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  orcamento.tipo_pedido === "dropshipping"
                    ? "bg-blue-400/10 text-blue-400 border-blue-400/20"
                    : "bg-gray-400/10 text-gray-400 border-gray-400/20"
                }`}>
                  {orcamento.tipo_pedido === "dropshipping" ? <Truck size={9} /> : <Package size={9} />}
                  {orcamento.tipo_pedido === "dropshipping" ? "Dropshipping" : "Estoque"}
                </span>
              )}
              {/* Status visível apenas na impressão */}
              <p className={`print:inline-block hidden text-[10px] font-bold mt-1 px-2 py-0.5 rounded-full border ${status.color}`}>
                {status.label}
              </p>
            </div>
          </div>

          {/* De (Fornecedor) / Para (Cliente) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 border-b border-white/8 divide-y sm:divide-y-0 sm:divide-x divide-white/8">

            {/* De — dados do fornecedor/marca */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Fornecedor</p>
              {brand ? (
                <div className="space-y-3">
                  {brand.logo_url && (
                    <div className="h-14 flex items-center">
                      <Image
                        src={brand.logo_url}
                        alt={brand.name}
                        width={160} height={56}
                        className="object-contain h-12 w-auto"
                      />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-white">{brand.name}</p>
                    {brand.razao_social && <p className="text-xs text-gray-400 mt-0.5">{brand.razao_social}</p>}
                    {brand.segment && <p className="text-xs text-gray-500 mt-0.5">{brand.segment}</p>}
                  </div>
                  <div className="space-y-1.5 pt-1">
                    {brand.cnpj && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Building2 size={11} className="text-gray-600 flex-shrink-0" />
                        {brand.cnpj}
                      </p>
                    )}
                    {brand.contato && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <span className="text-gray-600 flex-shrink-0 w-[11px] text-center">●</span>
                        <span><span className="text-gray-600">Resp. Comercial: </span>{brand.contato}</span>
                      </p>
                    )}
                    {brand.email && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Mail size={11} className="text-gray-600 flex-shrink-0" />
                        {brand.email}
                      </p>
                    )}
                    {brand.telefone && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Phone size={11} className="text-gray-600 flex-shrink-0" />
                        {brand.telefone}
                      </p>
                    )}
                    {(brand.logradouro || brand.cidade) && (
                      <p className="text-xs text-gray-400 flex items-start gap-1.5">
                        <MapPin size={11} className="text-gray-600 flex-shrink-0 mt-0.5" />
                        <span>
                          {[
                            brand.logradouro && `${brand.logradouro}${brand.numero ? `, ${brand.numero}` : ""}`,
                            brand.bairro,
                            brand.cidade && brand.estado ? `${brand.cidade} / ${brand.estado}` : (brand.cidade || brand.estado),
                          ].filter(Boolean).join(" — ")}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-bold text-white">PH Representante</p>
                  <p className="text-xs text-gray-500 mt-0.5">Representação Comercial Automotiva</p>
                </div>
              )}
            </div>

            {/* Para — dados do cliente */}
            <div className="px-6 py-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">Para</p>
              {cliente ? (
                <>
                  <p className="text-sm font-bold text-white leading-snug">{cliente.razao_social}</p>
                  {cliente.nome_fantasia && (
                    <p className="text-xs text-gray-400 mt-0.5">{cliente.nome_fantasia}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">CNPJ: {cliente.cnpj}</p>
                  <div className="mt-3 space-y-1.5">
                    {(cliente.logradouro || cliente.cidade) && (
                      <p className="text-xs text-gray-400 flex items-start gap-1.5">
                        <MapPin size={11} className="text-gray-600 flex-shrink-0 mt-0.5" />
                        <span>
                          {[
                            cliente.logradouro && `${cliente.logradouro}${cliente.numero ? `, ${cliente.numero}` : ""}`,
                            cliente.bairro,
                            cliente.cidade && cliente.estado ? `${cliente.cidade} / ${cliente.estado}` : (cliente.cidade || cliente.estado),
                          ].filter(Boolean).join(" — ")}
                        </span>
                      </p>
                    )}
                    {cliente.email && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Mail size={11} className="text-gray-600 flex-shrink-0" />
                        {cliente.email}
                      </p>
                    )}
                    {cliente.whatsapp && (
                      <p className="text-xs text-gray-400 flex items-center gap-1.5">
                        <Phone size={11} className="text-gray-600 flex-shrink-0" />
                        {cliente.whatsapp}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-xs text-gray-600">Dados indisponíveis</p>
              )}
            </div>
          </div>

          {/* Itens */}
          <div className="px-6 py-5 border-b border-white/8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Itens do pedido
              </p>
              <span className="text-[10px] text-gray-600">{itens.length} {itens.length === 1 ? "item" : "itens"}</span>
            </div>

            {/* Cabeçalho — só desktop */}
            <div className="hidden sm:grid grid-cols-[1fr_52px_100px_96px] gap-2 pb-2 border-b border-white/8 text-[11px] text-gray-500 font-semibold">
              <span>Produto</span>
              <span className="text-center">Qtd</span>
              <span className="text-right">Valor unit.</span>
              <span className="text-right">Total</span>
            </div>

            {/* Lista de itens */}
            <div className="divide-y divide-white/5">
              {itens.map((item) => {
                const unitario = Number(item.valor_unitario);
                const vtotal   = Number(item.valor_total);
                return (
                  <div key={item.id} className="py-3">
                    {/* Desktop: grid de 4 colunas */}
                    <div className="hidden sm:grid grid-cols-[1fr_52px_100px_96px] gap-2 items-center">
                      <div>
                        <p className="text-[10px] font-bold text-brand/80 tracking-wider">{item.produto_sku}</p>
                        <p className="text-sm text-white font-medium leading-snug mt-0.5">{item.produto_nome}</p>
                      </div>
                      <p className="text-sm text-gray-300 text-center">{item.quantidade}</p>
                      <p className="text-sm text-gray-300 text-right">
                        {unitario > 0 ? unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="text-gray-600 text-xs">A definir</span>}
                      </p>
                      <p className="text-sm font-semibold text-white text-right">
                        {vtotal > 0 ? vtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="text-gray-600">—</span>}
                      </p>
                    </div>

                    {/* Mobile: layout em card */}
                    <div className="sm:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-brand/80 tracking-wider">{item.produto_sku}</p>
                          <p className="text-sm text-white font-medium leading-snug mt-0.5">{item.produto_nome}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {vtotal > 0
                            ? <p className="text-sm font-bold text-white">{vtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                            : <p className="text-xs text-gray-600">A definir</p>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-gray-500">Qtd: <span className="text-gray-300 font-medium">{item.quantidade}</span></span>
                        {unitario > 0 && (
                          <span className="text-xs text-gray-500">Unit: <span className="text-gray-300">{unitario.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Condições + Total */}
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-white/8">
            <div className="px-6 py-5 space-y-4">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Condições</p>
              <div className="flex items-start gap-3">
                <CreditCard size={13} className="text-gray-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] text-gray-500 mb-0.5">Pagamento</p>
                  <p className="text-sm font-semibold text-white">
                    {orcamento.condicao_pagamento === "pix" ? "PIX"
                      : orcamento.condicao_pagamento === "boleto"
                        ? `Boleto${orcamento.prazo_boleto ? ` — ${orcamento.prazo_boleto} dias` : ""}`
                      : orcamento.condicao_pagamento === "semanal" ? "Semanal"
                      : "—"}
                  </p>
                </div>
              </div>
              {orcamento.transportadora && (
                <div className="flex items-start gap-3">
                  <Truck size={13} className="text-gray-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-gray-500 mb-0.5">Transportadora</p>
                    <p className="text-sm font-semibold text-white">{orcamento.transportadora}</p>
                  </div>
                </div>
              )}
              {orcamento.observacoes && (
                <div className="flex items-start gap-3">
                  <MessageSquare size={13} className="text-gray-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11px] text-gray-500 mb-0.5">Observações</p>
                    <p className="text-sm text-gray-300 leading-relaxed">{orcamento.observacoes}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-5 flex flex-col justify-end">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Subtotal ({itens.length} {itens.length === 1 ? "item" : "itens"})</span>
                  <span className="text-gray-300">
                    {total > 0 ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "A definir"}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-white/8">
                  <span className="text-sm font-bold text-white">Total geral</span>
                  <span className={`text-xl font-black ${total > 0 ? "text-white" : "text-gray-500"}`}>
                    {total > 0 ? total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "A definir"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Etiquetas (dropshipping) */}
          {orcamento.tipo_pedido === "dropshipping" && (orcamento.orcamento_etiquetas ?? []).length > 0 && (
            <div className="border-t border-white/8 px-6 py-5">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Etiquetas de envio</p>
              <div className="space-y-2">
                {(orcamento.orcamento_etiquetas as { id: string; nome: string; url: string }[]).map((et) => (
                  <a key={et.id} href={et.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 bg-dark-900 rounded-xl border border-white/8 hover:border-brand/30 transition-all group"
                  >
                    <FileText size={13} className="text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-300 flex-1 truncate group-hover:text-white transition-colors">{et.nome}</span>
                    <ExternalLink size={12} className="text-gray-600 group-hover:text-brand flex-shrink-0 transition-colors" />
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
        {/* ── fim do documento imprimível ── */}

        {/* Horário Limite de Postagem — destaque fora do doc */}
        {orcamento.tipo_pedido === "dropshipping" && ["em_separacao", "a_pagar"].includes(orcamento.status) && (
          <div className="print:hidden">
            <PostagemField
              orcamentoId={id}
              initialValue={(orcamento as { horario_postagem?: string | null }).horario_postagem ?? null}
            />
          </div>
        )}

        {/* Recusa */}
        {orcamento.status === "recusado" && orcamento.observacao_admin && (
          <div className="print:hidden bg-red-400/5 border border-red-400/20 rounded-2xl p-5">
            <p className="text-xs font-semibold text-red-400 mb-1">Motivo da recusa</p>
            <p className="text-sm text-gray-300">{orcamento.observacao_admin}</p>
          </div>
        )}

        {canEdit && (
          <div className="print:hidden">
            <OrcamentoActions id={id} />
          </div>
        )}
      </div>
    </div>
  );
}
