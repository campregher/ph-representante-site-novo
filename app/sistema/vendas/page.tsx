import Link from "next/link";
import { TrendingUp, ShoppingCart, Receipt, Package, Percent, Users } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listRepresentadaOptions, listVendedorOptions } from "@/lib/sistema/queries";
import { getVendas, PERIODO_OPTIONS } from "@/lib/sistema/vendas";
import { formatBRL, formatNumber, formatPercent, formatDate } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { StatCard, Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import SelectFilters from "@/components/sistema/SelectFilters";
import ExcelExportButton from "@/components/sistema/ExcelExportButton";
import LineChart from "@/components/sistema/charts/LineChart";
import BarList from "@/components/sistema/charts/BarList";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@/components/sistema/ui/Table";

export default async function VendasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const gestor = canManage(profile.role);
  const sp = await searchParams;

  const periodo = sp.periodo || "mes";
  const representadaId = sp.representada || undefined;
  const vendedorId = gestor ? sp.vendedor || undefined : undefined;

  const [dados, representadas, vendedores] = await Promise.all([
    getVendas({ periodo, representadaId, vendedorId }),
    listRepresentadaOptions(),
    gestor ? listVendedorOptions() : Promise.resolve([]),
  ]);

  const { kpis } = dados;

  const filtros = [
    { key: "periodo", options: PERIODO_OPTIONS.map((o) => ({ value: o.value, label: o.label })) },
    {
      key: "representada",
      allLabel: "Todas as representadas",
      options: representadas.map((r) => ({ value: r.id, label: r.label })),
    },
    ...(gestor && vendedores.length
      ? [
          {
            key: "vendedor",
            allLabel: "Todos os vendedores",
            options: vendedores.map((v) => ({ value: v.id, label: v.label })),
          },
        ]
      : []),
  ];

  const csvCols = [
    "Nº", "Data", "Cliente", "Representada", "Vendedor", "Status",
    "Itens", "Subtotal", "Desconto", "Total",
  ];
  const csvRows = dados.linhas.map((l) => [
    l.numero, l.data, l.cliente, l.representada, l.vendedor, l.status,
    l.itens, l.subtotal, l.desconto, l.total,
  ]);

  return (
    <div>
      <PageHeader
        title="Vendas"
        description={`${dados.periodoLabel} · vendas confirmadas em diante`}
        action={
          dados.linhas.length > 0 ? (
            <ExcelExportButton
              filename={`vendas_${periodo}`}
              sheetName="Vendas"
              columns={csvCols}
              rows={csvRows}
            />
          ) : null
        }
      />

      <SelectFilters filters={filtros} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Faturamento" value={formatBRL(kpis.faturamento)} icon={<TrendingUp size={16} />} />
        <StatCard label="Pedidos" value={String(kpis.pedidos)} icon={<ShoppingCart size={16} />} />
        <StatCard label="Ticket médio" value={formatBRL(kpis.ticket)} icon={<Receipt size={16} />} />
        <StatCard label="Itens vendidos" value={formatNumber(kpis.itens, 0)} icon={<Package size={16} />} />
        <StatCard
          label="Desconto médio"
          value={formatPercent(kpis.descontoMedioPct, 1)}
          icon={<Percent size={16} />}
        />
        <StatCard label="Clientes" value={String(kpis.clientes)} icon={<Users size={16} />} />
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader
            title="Faturamento no período"
            description={dados.serieGranularidade === "dia" ? "Por dia" : "Por mês"}
          />
          <CardBody>
            <LineChart points={dados.serie} format={formatBRL} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Por representada" />
          <CardBody>
            <BarList items={dados.porRepresentada} format={formatBRL} />
          </CardBody>
        </Card>
        {gestor ? (
          <Card>
            <CardHeader title="Por vendedor" />
            <CardBody>
              <BarList items={dados.porVendedor} format={formatBRL} />
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Por status" />
            <CardBody>
              <BarList items={dados.porStatus} format={formatBRL} />
            </CardBody>
          </Card>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top 10 produtos" />
          <CardBody>
            <BarList items={dados.topProdutos} format={formatBRL} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Top 10 clientes" />
          <CardBody>
            <BarList items={dados.topClientes} format={formatBRL} />
          </CardBody>
        </Card>
      </div>

      {gestor && (
        <div className="mt-4">
          <Card>
            <CardHeader title="Por status" />
            <CardBody>
              <BarList items={dados.porStatus} format={formatBRL} />
            </CardBody>
          </Card>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-2 text-sm font-bold text-neutral-900">
          Pedidos do período ({dados.linhas.length})
        </h2>
        {dados.linhas.length === 0 ? (
          <EmptyState title="Nenhuma venda no período" description="Ajuste os filtros acima." />
        ) : (
          <TableScroll>
            <Table>
              <Thead>
                <tr>
                  <Th>Nº</Th>
                  <Th>Data</Th>
                  <Th>Cliente</Th>
                  <Th>Representada</Th>
                  <Th>Vendedor</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Itens</Th>
                  <Th className="text-right">Desconto</Th>
                  <Th className="text-right">Total</Th>
                </tr>
              </Thead>
              <Tbody>
                {dados.linhas.slice(0, 200).map((l) => (
                  <Tr key={l.id}>
                    <Td>
                      <Link href={`/sistema/pedidos/${l.id}`} className="font-medium text-brand hover:underline">
                        {l.numero}
                      </Link>
                    </Td>
                    <Td>{formatDate(l.data)}</Td>
                    <Td className="max-w-[220px] truncate" title={l.cliente}>{l.cliente}</Td>
                    <Td className="max-w-[160px] truncate" title={l.representada}>{l.representada}</Td>
                    <Td>{l.vendedor}</Td>
                    <Td>{l.status}</Td>
                    <Td className="text-right">{l.itens}</Td>
                    <Td className="text-right">{formatBRL(l.desconto)}</Td>
                    <Td className="text-right font-medium">{formatBRL(l.total)}</Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableScroll>
        )}
        {dados.linhas.length > 200 && (
          <p className="mt-2 text-xs text-neutral-400">
            Mostrando os primeiros 200. Exporte para Excel para a lista completa.
          </p>
        )}
      </div>
    </div>
  );
}
