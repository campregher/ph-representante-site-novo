import { Download, FileText, Tag } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { pedidosDropSeller } from "@/lib/sistema/seller-pedidos";
import { formatDateTime } from "@/lib/sistema/format";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import { buttonClass } from "@/components/sistema/ui/buttonClass";

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
          Baixe a planilha, a etiqueta e a nota fiscal de cada venda pra mandar no grupo de WhatsApp do seu fornecedor.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Vendas no Mercado Livre"
          description="A etiqueta e a NF só ficam prontas depois que você declara a nota fiscal do consumidor final no Mercado Livre."
        />
        <CardBody>
          {pedidos.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhuma venda registrada ainda.</p>
          ) : (
            <div className="divide-y divide-neutral-100">
              {pedidos.map((p) => {
                const status = STATUS_LABEL[p.status];
                return (
                  <div key={p.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-neutral-900">
                        #{p.numero} — {p.itens.map((it) => `${it.quantidade}x ${it.nome}`).join(", ")}
                      </p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {formatDateTime(p.createdAt)}
                      {p.entregaCidade ? ` · entrega em ${p.entregaCidade}/${p.entregaUf ?? ""}` : ""}
                    </p>
                    {p.status === "pronto" && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <a href={`/api/drop/pedidos/${p.id}/planilha`} className={buttonClass({ variant: "outline", size: "sm" })}>
                          <Download size={13} /> Planilha
                        </a>
                        <a href={`/api/drop/pedidos/${p.id}/etiqueta`} className={buttonClass({ variant: "outline", size: "sm" })}>
                          <Tag size={13} /> Etiqueta
                        </a>
                        <a href={`/api/drop/pedidos/${p.id}/danfe`} className={buttonClass({ variant: "outline", size: "sm" })}>
                          <FileText size={13} /> NF (DANFE)
                        </a>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
