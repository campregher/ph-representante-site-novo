import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, MessageCircle, Tag } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { getDropPedidoDetalhe } from "@/lib/sistema/dropshipping";
import { formatBRL, formatDateTime } from "@/lib/sistema/format";
import { formatPhone } from "@/utils/cnpj";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { TableScroll, Table, Thead, Th, Tbody, Tr, Td } from "@/components/sistema/ui/Table";

const STATUS_LABEL = {
  aguardando_nf: { label: "Aguardando NF", tone: "yellow" as const },
  pronto: { label: "Pronto", tone: "green" as const },
  enviado: { label: "Enviado", tone: "blue" as const },
  cancelado: { label: "Cancelado", tone: "neutral" as const },
};

export default async function DropPedidoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSistemaProfile();
  const { id } = await params;
  const p = await getDropPedidoDetalhe(id);
  if (!p) notFound();

  const status = STATUS_LABEL[p.status];
  const totalCaixas = p.itens.reduce((s, it) => s + it.caixas, 0);
  const valorLiquidoEstimado = p.valorTotal - p.comissaoTotal - (p.frete ?? 0);
  const endereco = [p.entrega.logradouro, p.entrega.numero, p.entrega.complemento].filter(Boolean).join(", ");

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/sistema/dropshipping/pedidos" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800">
        <ArrowLeft size={14} /> Pedidos
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-neutral-900">Pedido #{p.numero}</h1>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="text-sm text-neutral-500">
            {p.sellerNome} · {p.canal}
            {p.pedidoExterno ? ` #${p.pedidoExterno}` : ""} · {formatDateTime(p.createdAt)}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader title="Itens vendidos" description={`${totalCaixas} caixa(s) a enviar no total`} />
        <CardBody className="p-0">
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>SKU</Th>
                  <Th>Produto</Th>
                  <Th>Qtd.</Th>
                  <Th>Caixas</Th>
                  <Th>Preço venda</Th>
                  <Th>Comissão ML</Th>
                  <Th>Custo fornecedor</Th>
                </Tr>
              </Thead>
              <Tbody>
                {p.itens.map((it, i) => (
                  <Tr key={i}>
                    <Td>{it.sku}</Td>
                    <Td>{it.nome}</Td>
                    <Td>{it.quantidade}</Td>
                    <Td className="font-semibold text-neutral-900">{it.caixas}</Td>
                    <Td>{formatBRL(it.precoVenda)}</Td>
                    <Td>{formatBRL(it.comissaoMl)}</Td>
                    <Td>{formatBRL(it.custoUnitario * it.quantidade)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableScroll>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Recebimento" description="Estimado — a liquidação exata é feita pelo Mercado Livre." />
        <CardBody className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div><p className="text-xs text-neutral-400">Valor bruto</p><p className="font-semibold text-neutral-900">{formatBRL(p.valorTotal)}</p></div>
          <div><p className="text-xs text-neutral-400">Comissão ML</p><p className="font-semibold text-neutral-900">−{formatBRL(p.comissaoTotal)}</p></div>
          <div><p className="text-xs text-neutral-400">Frete</p><p className="font-semibold text-neutral-900">{p.frete != null ? `−${formatBRL(p.frete)}` : "—"}</p></div>
          <div><p className="text-xs text-neutral-400">Líquido estimado</p><p className="font-semibold text-neutral-900">{formatBRL(valorLiquidoEstimado)}</p></div>
          <div className="col-span-2 sm:col-span-4 border-t border-neutral-100 pt-3">
            <p className="text-xs text-neutral-400">Custo total a pagar ao fornecedor (fora do sistema)</p>
            <p className="font-semibold text-neutral-900">{formatBRL(p.custoTotal)}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Entrega" />
        <CardBody className="space-y-1 text-sm text-neutral-700">
          <p className="font-medium text-neutral-900">{p.entrega.nome ?? "—"}</p>
          {p.entrega.telefone && <p>{formatPhone(p.entrega.telefone)}</p>}
          <p>{endereco || "—"}</p>
          <p>
            {p.entrega.bairro ? `${p.entrega.bairro} · ` : ""}
            {p.entrega.cidade ? `${p.entrega.cidade}/${p.entrega.uf ?? ""}` : "—"}
            {p.entrega.cep ? ` · CEP ${p.entrega.cep}` : ""}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Nota fiscal e etiqueta" description="Gerados automaticamente quando o seller declara a NF no Mercado Livre." />
        <CardBody>
          {p.status === "pronto" || p.status === "enviado" ? (
            <div className="flex flex-wrap gap-2">
              <a href={`/api/sistema/dropshipping/pedidos/${p.id}/planilha`} className={buttonClass({ variant: "outline", size: "sm" })}>
                <Download size={13} /> Planilha
              </a>
              <a href={`/api/sistema/dropshipping/pedidos/${p.id}/etiqueta`} className={buttonClass({ variant: "outline", size: "sm" })}>
                <Tag size={13} /> Etiqueta
              </a>
              <a href={`/api/sistema/dropshipping/pedidos/${p.id}/danfe`} className={buttonClass({ variant: "outline", size: "sm" })}>
                <FileText size={13} /> NF (DANFE)
              </a>
            </div>
          ) : (
            <p className="text-sm text-neutral-500">Aguardando o seller declarar a nota fiscal do consumidor final no Mercado Livre.</p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Mensagens do comprador" description="Chat pós-venda do Mercado Livre." />
        <CardBody>
          {p.mensagens.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-neutral-500"><MessageCircle size={14} /> Nenhuma mensagem trocada com o comprador.</p>
          ) : (
            <div className="space-y-2">
              {p.mensagens.map((m) => (
                <div key={m.id} className={`rounded-lg p-2.5 text-sm ${m.autor === "voce" ? "ml-8 bg-brand/10" : "mr-8 bg-neutral-100"}`}>
                  <p className="text-xs font-semibold text-neutral-500">{m.autor === "voce" ? "Seller" : "Comprador"}</p>
                  <p className="text-neutral-800">{m.texto}</p>
                  {m.data && <p className="mt-0.5 text-[11px] text-neutral-400">{formatDateTime(m.data)}</p>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
