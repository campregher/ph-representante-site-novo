import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { pedidosDropSeller, type PedidoDrop } from "@/lib/sistema/seller-pedidos";
import { formatDateTime } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import PedidosFornecedorGroup, { type PedidoCombinavel } from "@/components/drop/PedidosFornecedorGroup";

const STATUS_LABEL = {
  aguardando_nf: { label: "Aguardando você emitir a NF no Mercado Livre", tone: "yellow" as const },
  pronto: { label: "Pronto pra enviar ao fornecedor", tone: "green" as const },
  enviado: { label: "Enviado", tone: "blue" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
};

export default async function DropDashboardPedidosPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const pedidos = await pedidosDropSeller(seller.id);

  const gruposProntos = agruparProntosPorFornecedor(pedidos);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
        <p className="text-sm text-neutral-500">
          Toque numa venda pra ver os detalhes e baixar a planilha, a etiqueta e a nota fiscal pra mandar no grupo de WhatsApp do seu fornecedor.
        </p>
      </div>

      {gruposProntos.length > 0 && (
        <Card>
          <CardHeader
            title="Pronto pra enviar ao fornecedor"
            description="Selecione os pedidos de um fornecedor e baixe um único pacote (etiquetas, notas fiscais e planilha) pra mandar de uma vez no grupo de WhatsApp dele."
          />
          <CardBody className="space-y-3">
            {gruposProntos.map((g) => (
              <PedidosFornecedorGroup key={g.fornecedorNome} fornecedorNome={g.fornecedorNome} pedidos={g.pedidos} />
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Vendas no Mercado Livre"
          description="A etiqueta e a NF só ficam prontas depois que você declara a nota fiscal do consumidor final no Mercado Livre."
        />
        <CardBody className="p-0">
          {pedidos.length === 0 ? (
            <p className="p-5 text-sm text-neutral-600">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {pedidos.map((p) => {
                const status = STATUS_LABEL[p.status];
                const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
                return (
                  <Link
                    key={p.id}
                    href={`/drop/dashboard/pedidos/${p.id}`}
                    className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-neutral-900">
                        #{p.numero} — {p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-400">
                        {formatDateTime(p.createdAt)}
                        {p.entregaCidade ? ` · entrega em ${p.entregaCidade}/${p.entregaUf ?? ""}` : ""}
                        {totalCaixas !== p.itens.reduce((s, it) => s + it.quantidade, 0) ? ` · enviar ${totalCaixas} caixa(s)` : ""}
                      </p>
                      <div className="mt-1.5">
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </div>
                    </div>
                    <ChevronRight size={16} className="shrink-0 text-neutral-300" />
                  </Link>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function agruparProntosPorFornecedor(pedidos: PedidoDrop[]): { fornecedorNome: string; pedidos: PedidoCombinavel[] }[] {
  const grupos = new Map<string, PedidoCombinavel[]>();
  for (const p of pedidos) {
    if (p.status !== "pronto" || !p.fornecedorNome) continue;
    const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
    const item: PedidoCombinavel = {
      id: p.id,
      numero: p.numero,
      resumo: p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", "),
      totalCaixas,
    };
    const lista = grupos.get(p.fornecedorNome) ?? [];
    lista.push(item);
    grupos.set(p.fornecedorNome, lista);
  }
  return [...grupos.entries()]
    .map(([fornecedorNome, lista]) => ({ fornecedorNome, pedidos: lista.sort((a, b) => a.numero - b.numero) }))
    .sort((a, b) => a.fornecedorNome.localeCompare(b.fornecedorNome));
}
