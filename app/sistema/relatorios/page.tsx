import Link from "next/link";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { listRepresentadaOptions, listVendedorOptions } from "@/lib/sistema/queries";
import { getCurvaABC, getClientesSemComprar } from "@/lib/sistema/relatorios";
import { formatBRL, formatPercent, formatDate } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { Card, CardBody, StatCard } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import SelectFilters from "@/components/sistema/SelectFilters";
import ExcelExportButton from "@/components/sistema/ExcelExportButton";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@/components/sistema/ui/Table";

const TABS = [
  { key: "abc-clientes", label: "Curva ABC — Clientes" },
  { key: "abc-produtos", label: "Curva ABC — Produtos" },
  { key: "inatividade", label: "Clientes sem comprar" },
] as const;

const MESES_OPTS = [
  { value: "3", label: "Últimos 3 meses" },
  { value: "6", label: "Últimos 6 meses" },
  { value: "12", label: "Últimos 12 meses" },
  { value: "24", label: "Últimos 24 meses" },
];

const CLASSE_TONE = { A: "green", B: "yellow", C: "neutral" } as const;

export default async function RelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const gestor = canManage(profile.role);
  const sp = await searchParams;

  const tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as string) : "abc-clientes";
  const meses = ["3", "6", "12", "24"].includes(sp.meses ?? "") ? Number(sp.meses) : 12;
  const representadaId = sp.representada || undefined;
  const vendedorId = gestor ? sp.vendedor || undefined : undefined;

  const [representadas, vendedores] = await Promise.all([
    listRepresentadaOptions(),
    gestor ? listVendedorOptions() : Promise.resolve([]),
  ]);

  const filtros = [
    ...(tab !== "inatividade"
      ? [{ key: "meses", options: MESES_OPTS }]
      : []),
    ...(tab !== "inatividade"
      ? [
          {
            key: "representada",
            allLabel: "Todas as representadas",
            options: representadas.map((r) => ({ value: r.id, label: r.label })),
          },
        ]
      : []),
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

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Curva ABC e clientes sem comprar — com exportação."
      />

      <div className="mb-5 flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => {
          const qs = new URLSearchParams();
          qs.set("tab", t.key);
          if (sp.meses) qs.set("meses", sp.meses);
          if (sp.representada) qs.set("representada", sp.representada);
          if (sp.vendedor) qs.set("vendedor", sp.vendedor);
          const ativo = t.key === tab;
          return (
            <Link
              key={t.key}
              href={`/sistema/relatorios?${qs.toString()}`}
              className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
                ativo
                  ? "border-brand text-brand"
                  : "border-transparent text-neutral-500 hover:text-neutral-800"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>

      <SelectFilters filters={filtros} />

      {tab === "abc-clientes" && (
        <AbcSecao
          tipo="clientes"
          data={await getCurvaABC({ meses, representadaId, vendedorId })}
          meses={meses}
        />
      )}
      {tab === "abc-produtos" && (
        <AbcSecao
          tipo="produtos"
          data={await getCurvaABC({ meses, representadaId, vendedorId })}
          meses={meses}
        />
      )}
      {tab === "inatividade" && (
        <InatividadeSecao data={await getClientesSemComprar({ vendedorId })} />
      )}
    </div>
  );
}

/* ─────────────────────────────── Curva ABC ─────────────────────────────── */

function AbcSecao({
  tipo,
  data,
  meses,
}: {
  tipo: "clientes" | "produtos";
  data: Awaited<ReturnType<typeof getCurvaABC>>;
  meses: number;
}) {
  const rows = tipo === "clientes" ? data.clientes : data.produtos;
  const resumo = tipo === "clientes" ? data.resumoClientes : data.resumoProdutos;
  const total = tipo === "clientes" ? data.totalClientes : data.totalProdutos;

  if (!rows.length) {
    return <EmptyState title="Sem vendas no período" description="Ajuste o período ou os filtros." />;
  }

  const csvCols = [
    tipo === "clientes" ? "Cliente" : "Produto",
    "Faturamento", "Pedidos", "Participação %", "Acumulado %", "Classe",
  ];
  const csvRows = rows.map((r) => [
    r.nome, r.valor, r.pedidos,
    Number(r.pct.toFixed(2)), Number(r.pctAcum.toFixed(2)), r.classe,
  ]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="grid flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Faturamento total" value={formatBRL(total)} />
          {(["A", "B", "C"] as const).map((c) => (
            <StatCard
              key={c}
              label={`Classe ${c}`}
              value={String(resumo[c].qtd)}
              hint={`${formatBRL(resumo[c].valor)} · ${formatPercent(
                total ? (resumo[c].valor / total) * 100 : 0,
                0
              )}`}
            />
          ))}
        </div>
      </div>

      <div className="mb-3 flex justify-end">
        <ExcelExportButton
          filename={`curva_abc_${tipo}_${meses}m`}
          sheetName={`ABC ${tipo}`}
          columns={csvCols}
          rows={csvRows}
        />
      </div>

      <TableScroll>
        <Table>
          <Thead>
            <tr>
              <Th className="w-10 text-right">#</Th>
              <Th>{tipo === "clientes" ? "Cliente" : "Produto"}</Th>
              <Th className="text-right">Faturamento</Th>
              <Th className="text-right">Pedidos</Th>
              <Th className="text-right">Part. %</Th>
              <Th className="text-right">Acum. %</Th>
              <Th className="text-center">Classe</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.map((r, i) => (
              <Tr key={r.id}>
                <Td className="text-right text-neutral-400">{i + 1}</Td>
                <Td className="max-w-[280px] truncate" title={r.nome}>
                  {tipo === "clientes" ? (
                    <Link href={`/sistema/clientes/${r.id}`} className="text-brand hover:underline">
                      {r.nome}
                    </Link>
                  ) : (
                    r.nome
                  )}
                </Td>
                <Td className="text-right font-medium">{formatBRL(r.valor)}</Td>
                <Td className="text-right">{r.pedidos}</Td>
                <Td className="text-right">{formatPercent(r.pct, 1)}</Td>
                <Td className="text-right text-neutral-500">{formatPercent(r.pctAcum, 1)}</Td>
                <Td className="text-center">
                  <Badge tone={CLASSE_TONE[r.classe]}>{r.classe}</Badge>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableScroll>
    </div>
  );
}

/* ───────────────────────── Clientes sem comprar ───────────────────────── */

function InatividadeSecao({
  data,
}: {
  data: Awaited<ReturnType<typeof getClientesSemComprar>>;
}) {
  const grupos = [...data.faixas, data.nunca];
  const csvCols = ["Faixa", "Cliente", "Dias sem comprar", "Última compra", "Vendedor"];
  const csvRows = grupos.flatMap((g) =>
    g.clientes.map((c) => [
      g.label,
      c.nome,
      c.dias ?? "",
      c.ultimaCompra ? formatDate(c.ultimaCompra) : "Nunca",
      c.vendedor ?? "",
    ])
  );

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {grupos.map((g) => (
          <StatCard key={g.label} label={g.label} value={String(g.count)} />
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-neutral-400">
          {data.totalMonitorados} clientes ativos monitorados.
        </p>
        {csvRows.length > 0 && (
          <ExcelExportButton
            filename="clientes_sem_comprar"
            sheetName="Inatividade"
            columns={csvCols}
            rows={csvRows}
          />
        )}
      </div>

      <div className="space-y-4">
        {grupos
          .filter((g) => g.count > 0)
          .map((g) => (
            <Card key={g.label}>
              <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
                <h3 className="text-sm font-bold text-neutral-900">{g.label}</h3>
                <Badge tone={g.label.startsWith("180") || g.label.startsWith("Nunca") ? "red" : "yellow"}>
                  {g.count}
                </Badge>
              </div>
              <CardBody className="p-0">
                <TableScroll>
                  <Table>
                    <Thead>
                      <tr>
                        <Th>Cliente</Th>
                        <Th className="text-right">Dias</Th>
                        <Th>Última compra</Th>
                        <Th>Vendedor</Th>
                      </tr>
                    </Thead>
                    <Tbody>
                      {g.clientes.map((c) => (
                        <Tr key={c.id}>
                          <Td className="max-w-[280px] truncate" title={c.nome}>
                            <Link href={`/sistema/clientes/${c.id}`} className="text-brand hover:underline">
                              {c.nome}
                            </Link>
                          </Td>
                          <Td className="text-right">{c.dias ?? "—"}</Td>
                          <Td>{c.ultimaCompra ? formatDate(c.ultimaCompra) : "Nunca"}</Td>
                          <Td>{c.vendedor ?? "—"}</Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableScroll>
              </CardBody>
            </Card>
          ))}
        {grupos.every((g) => g.count === 0) && (
          <EmptyState title="Nenhum cliente inativo" description="Todos os clientes ativos compraram nos últimos 15 dias." />
        )}
      </div>
    </div>
  );
}
