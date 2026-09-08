import { notFound } from "next/navigation";
import Image from "next/image";
import { FileText } from "lucide-react";
import { getPedidoDocByToken } from "@/lib/sistema/pedido-doc";
import { formatBRL, formatPercent } from "@/lib/sistema/format";

export const dynamic = "force-dynamic";

export default async function PedidoPublicoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const d = await getPedidoDocByToken(token);
  if (!d) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/* Cabeçalho — logos horizontais */}
        <div className="border-b-4 border-brand p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Image
                src="/images/ph.png"
                alt="PH Representante"
                width={160}
                height={44}
                className="h-11 w-auto object-contain"
                priority
              />
              <div className="mt-1.5 text-[11px] text-neutral-500">{d.empresa.contato}</div>
            </div>
            <div className="flex items-center">
              {d.representada.logo ? (
                <Image
                  src={d.representada.logo}
                  alt={d.representada.nome}
                  width={180}
                  height={48}
                  className="h-11 w-auto object-contain"
                  unoptimized
                />
              ) : (
                <div className="text-base font-bold text-neutral-800">{d.representada.nome}</div>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-200 pt-3">
            <div className="text-lg font-bold text-brand">PEDIDO #{d.numero}</div>
            <div className="text-xs text-neutral-500">
              {d.representada.nome} · {d.data} · {d.statusLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand">
              Cliente
            </div>
            <div className="font-semibold text-neutral-900">{d.cliente.nome}</div>
            {d.cliente.razao && <div className="text-xs text-neutral-500">{d.cliente.razao}</div>}
            <div className="mt-1 space-y-0.5 text-xs text-neutral-600">
              {d.cliente.documento && <div>CNPJ/CPF: {d.cliente.documento}</div>}
              {d.cliente.inscricaoEstadual && <div>IE: {d.cliente.inscricaoEstadual}</div>}
              {d.cliente.endereco && <div>{d.cliente.endereco}</div>}
              {(d.cliente.bairro || d.cliente.cidadeUf || d.cliente.cep) && (
                <div>
                  {[d.cliente.bairro, d.cliente.cidadeUf, d.cliente.cep && `CEP ${d.cliente.cep}`]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              )}
              {d.cliente.telefone && <div>Tel: {d.cliente.telefone}</div>}
              {d.cliente.email && <div>{d.cliente.email}</div>}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200 p-3 text-sm">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide text-brand">
              Condições
            </div>
            <div className="space-y-0.5 text-xs text-neutral-600">
              {d.tabela && <div>Tabela: {d.tabela}</div>}
              {d.vendedor && <div>Vendedor: {d.vendedor}</div>}
              {d.condicao_pagamento && <div>Pagamento: {d.condicao_pagamento}</div>}
              {d.forma_pagamento && <div>Forma: {d.forma_pagamento}</div>}
              {d.previsao_entrega && <div>Previsão de entrega: {d.previsao_entrega}</div>}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto px-5">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-neutral-300 text-left text-xs uppercase text-neutral-500">
                <th className="py-2 pr-2">Código</th>
                <th className="py-2 pr-2">Produto</th>
                <th className="py-2 pr-2 text-right">Qtd</th>
                <th className="py-2 pr-2 text-right">Preço</th>
                <th className="py-2 pr-2 text-right">Desc.</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {d.itens.map((it, i) => (
                <tr key={i} className="border-b border-neutral-100">
                  <td className="py-1.5 pr-2 font-mono text-xs">{it.sku}</td>
                  <td className="py-1.5 pr-2">{it.descricao}</td>
                  <td className="py-1.5 pr-2 text-right">{it.qtd}</td>
                  <td className="py-1.5 pr-2 text-right">{formatBRL(it.preco)}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {it.descPct > 0 ? formatPercent(it.descPct) : "—"}
                  </td>
                  <td className="py-1.5 text-right font-medium">{formatBRL(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end p-5">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Subtotal</span>
              <span>{formatBRL(d.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">
                Desconto adicional ({formatPercent(d.descontoPct)})
              </span>
              <span className="text-red-600">− {formatBRL(d.descontoValor)}</span>
            </div>
            <div className="flex justify-between border-t border-neutral-300 pt-1 text-base font-bold">
              <span>TOTAL</span>
              <span className="text-brand">{formatBRL(d.total)}</span>
            </div>
          </div>
        </div>

        {d.observacaoCliente && (
          <div className="border-t border-neutral-200 p-5 text-sm">
            <div className="text-[11px] font-bold uppercase tracking-wide text-neutral-400">
              Observações
            </div>
            <p className="mt-1 whitespace-pre-wrap text-neutral-700">{d.observacaoCliente}</p>
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-center">
        <a
          href={`/p/${token}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          <FileText size={16} /> Baixar PDF
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-neutral-400">
        Documento gerado pelo Sistema Comercial · {d.empresa.nome}
      </p>
    </div>
  );
}
