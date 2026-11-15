import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { pedidosDropSeller } from "@/lib/sistema/seller-pedidos";
import { formatDateTime } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";

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

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Pedidos</h1>
        <p className="text-sm text-neutral-500">
          Toque numa venda pra ver os detalhes e baixar a planilha, a etiqueta e a nota fiscal pra mandar no grupo de WhatsApp do seu fornecedor.
        </p>
      </div>

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
