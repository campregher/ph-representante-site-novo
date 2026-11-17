import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Store,
  Megaphone,
  ShoppingCart,
  Wallet,
  ExternalLink,
  Mail,
  Phone,
  Calendar,
  Tag,
} from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { getDropClienteDetalhe } from "@/lib/sistema/dropshipping";
import { PageHeader } from "@/components/sistema/ui/State";
import { Card, CardHeader, CardBody, StatCard } from "@/components/sistema/ui/Card";
import { Badge, CLIENTE_STATUS } from "@/components/sistema/ui/Badge";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td, TableEmpty } from "@/components/sistema/ui/Table";
import { formatBRL, formatDate, formatDateTime } from "@/lib/sistema/format";

const ML_STATUS_LABEL: Record<string, { label: string; tone: "green" | "yellow" | "neutral" | "blue" }> = {
  active: { label: "Ativo", tone: "green" },
  paused: { label: "Pausado", tone: "yellow" },
  closed: { label: "Encerrado", tone: "neutral" },
  under_review: { label: "Em revisão", tone: "blue" },
};

const PEDIDO_STATUS_LABEL: Record<string, { label: string; tone: "yellow" | "blue" | "green" | "neutral" }> = {
  aguardando_nf: { label: "Aguardando NF", tone: "yellow" },
  pronto: { label: "Etiqueta liberada", tone: "blue" },
  enviado: { label: "Enviado", tone: "green" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

export default async function DropClienteDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSistemaProfile();
  const { id } = await params;
  const cliente = await getDropClienteDetalhe(id);
  if (!cliente) notFound();

  const statusInfo = CLIENTE_STATUS[cliente.status] ?? { label: cliente.status, tone: "neutral" as const };
  const anunciosAtivos = cliente.anuncios.filter((a) => a.mlStatus === "active").length;

  return (
    <div className="max-w-5xl">
      <Link
        href="/sistema/dropshipping/clientes"
        className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-900"
      >
        <ArrowLeft size={14} /> Clientes do Drop
      </Link>

      <PageHeader
        title={cliente.nomeFantasia || cliente.email || "Sem nome"}
        description={cliente.razaoSocial ?? undefined}
        action={<Badge tone={statusInfo.tone}>{statusInfo.label}</Badge>}
      />

      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-neutral-500">
        {cliente.email && (
          <span className="inline-flex items-center gap-1.5">
            <Mail size={14} className="text-neutral-400" /> {cliente.email}
          </span>
        )}
        {cliente.whatsapp && (
          <span className="inline-flex items-center gap-1.5">
            <Phone size={14} className="text-neutral-400" /> {cliente.whatsapp}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Calendar size={14} className="text-neutral-400" /> Cliente desde {formatDate(cliente.createdAt)}
        </span>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Contas ML conectadas" value={String(cliente.contas.length)} icon={<Store size={16} />} />
        <StatCard
          label="Anúncios publicados"
          value={String(cliente.anuncios.length)}
          hint={`${anunciosAtivos} ativo(s)`}
          icon={<Megaphone size={16} />}
        />
        <StatCard label="Vendas no total" value={String(cliente.totalVendas)} icon={<ShoppingCart size={16} />} />
        <StatCard label="Valor vendido" value={formatBRL(cliente.valorTotalVendido)} icon={<Wallet size={16} />} />
      </div>

      {cliente.contas.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {cliente.contas.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1 text-xs font-medium text-neutral-600"
            >
              <Store size={13} className="text-neutral-400" /> {c.nickname ?? "Conta ML"}
            </span>
          ))}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader
          title="Anúncios no Mercado Livre"
          description="Produtos que esse seller já exportou/publicou."
        />
        <CardBody className="p-0">
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Produto</Th>
                  <Th>Conta</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Preço de revenda</Th>
                  <Th />
                </Tr>
              </Thead>
              <Tbody>
                {cliente.anuncios.length === 0 ? (
                  <TableEmpty colSpan={5}>Nenhum anúncio publicado ainda.</TableEmpty>
                ) : (
                  cliente.anuncios.map((a) => {
                    const mlInfo = ML_STATUS_LABEL[a.mlStatus] ?? { label: a.mlStatus, tone: "neutral" as const };
                    return (
                      <Tr key={a.id}>
                        <Td className="font-medium text-neutral-900">
                          {a.produtoNome}
                          <div className="flex items-center gap-1 text-xs font-normal text-neutral-400">
                            <Tag size={11} /> {a.produtoSku}
                          </div>
                        </Td>
                        <Td className="text-neutral-500">{a.contaNickname ?? "—"}</Td>
                        <Td>
                          <Badge tone={mlInfo.tone}>{mlInfo.label}</Badge>
                        </Td>
                        <Td className="text-right font-medium text-neutral-900">{formatBRL(a.precoRevenda)}</Td>
                        <Td className="text-right">
                          {a.permalink && (
                            <a
                              href={a.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
                            >
                              Ver no ML <ExternalLink size={12} />
                            </a>
                          )}
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </TableScroll>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Vendas recentes" description={`${cliente.totalVendas} no total — últimas 20 abaixo.`} />
        <CardBody className="p-0">
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Pedido</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Valor</Th>
                  <Th>Data</Th>
                </Tr>
              </Thead>
              <Tbody>
                {cliente.pedidosRecentes.length === 0 ? (
                  <TableEmpty colSpan={4}>Nenhuma venda ainda.</TableEmpty>
                ) : (
                  cliente.pedidosRecentes.map((p) => {
                    const statusPedido = PEDIDO_STATUS_LABEL[p.status] ?? { label: p.status, tone: "neutral" as const };
                    return (
                      <Tr key={p.id}>
                        <Td className="font-medium text-neutral-900">#{p.numero}</Td>
                        <Td>
                          <Badge tone={statusPedido.tone}>{statusPedido.label}</Badge>
                        </Td>
                        <Td className="text-right font-medium text-neutral-900">{formatBRL(p.valorTotal)}</Td>
                        <Td className="text-neutral-400">{formatDateTime(p.createdAt)}</Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </TableScroll>
        </CardBody>
      </Card>
    </div>
  );
}
