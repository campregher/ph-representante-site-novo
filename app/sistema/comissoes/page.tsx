import Link from "next/link";
import { Wallet, CheckCircle2, AlertTriangle, Coins } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { canFinance, canManage } from "@/lib/sistema/roles";
import { listRepresentadaOptions, listVendedorOptions } from "@/lib/sistema/queries";
import {
  getComissoes,
  competenciasRecentes,
  COMISSAO_STATUS,
  COMISSAO_STATUS_LABEL,
} from "@/lib/sistema/comissoes";
import { formatBRL, formatPercent, formatDate } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { StatCard } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import SelectFilters from "@/components/sistema/SelectFilters";
import ExcelExportButton from "@/components/sistema/ExcelExportButton";
import ComissaoRowActions from "@/components/sistema/comissoes/ComissaoRowActions";
import SincronizarComissoesButton from "@/components/sistema/comissoes/SincronizarComissoesButton";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
} from "@/components/sistema/ui/Table";

const STATUS_TONE: Record<string, "neutral" | "green" | "yellow"> = {
  a_receber: "neutral",
  recebida: "green",
  divergencia: "yellow",
};

export default async function ComissoesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const gestor = canManage(profile.role);
  const finance = profile.role === "admin" || profile.role === "financeiro";
  const podeSincronizar = canFinance(profile.role);
  const sp = await searchParams;

  const competencias = competenciasRecentes();
  const competencia =
    sp.competencia && competencias.some((c) => c.value === sp.competencia)
      ? sp.competencia
      : competencias[0].value;
  const representadaId = sp.representada || undefined;
  const vendedorId = gestor ? sp.vendedor || undefined : undefined;
  const status = COMISSAO_STATUS.some((s) => s.value === sp.status) ? sp.status : undefined;

  const [dados, representadas, vendedores] = await Promise.all([
    getComissoes({ competencia, representadaId, vendedorId, status }),
    listRepresentadaOptions(),
    gestor ? listVendedorOptions() : Promise.resolve([]),
  ]);

  const filtros = [
    { key: "competencia", options: competencias.map((c) => ({ value: c.value, label: c.label })) },
    {
      key: "status",
      allLabel: "Todos os status",
      options: COMISSAO_STATUS.map((s) => ({ value: s.value, label: s.label })),
    },
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
    "Pedido", "Data", "Cliente", "Representada", "Vendedor",
    "Base", "%", "Comissão", "Competência", "Status", "Recebimento",
  ];
  const csvRows = dados.linhas.map((l) => [
    l.numero ?? "", l.data_pedido ?? "", l.cliente, l.representada, l.vendedor,
    l.valor_base, l.percentual, l.valor_comissao, l.competencia ?? "",
    COMISSAO_STATUS_LABEL.get(l.status) ?? l.status,
    l.data_recebimento ?? "",
  ]);

  return (
    <div>
      <PageHeader
        title="Comissões"
        description="Geradas automaticamente a partir dos pedidos de venda."
        action={
          <div className="flex items-center gap-2">
            {podeSincronizar && <SincronizarComissoesButton />}
            {dados.linhas.length > 0 && (
              <ExcelExportButton
                filename={`comissoes_${competencia}`}
                sheetName="Comissões"
                columns={csvCols}
                rows={csvRows}
              />
            )}
          </div>
        }
      />

      <SelectFilters filters={filtros} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="A receber" value={formatBRL(dados.totais.aReceber)} icon={<Wallet size={16} />} />
        <StatCard label="Recebida" value={formatBRL(dados.totais.recebida)} icon={<CheckCircle2 size={16} />} />
        <StatCard label="Divergência" value={formatBRL(dados.totais.divergencia)} icon={<AlertTriangle size={16} />} />
        <StatCard label="Base de cálculo" value={formatBRL(dados.totais.base)} icon={<Coins size={16} />} />
      </div>

      <div className="mt-6">
        {dados.linhas.length === 0 ? (
          <EmptyState
            title="Nenhuma comissão nesta competência"
            description={
              podeSincronizar
                ? 'Use "Sincronizar" para gerar a partir dos pedidos já existentes.'
                : "As comissões aparecem quando pedidos são confirmados/faturados."
            }
          />
        ) : (
          <TableScroll>
            <Table>
              <Thead>
                <tr>
                  <Th>Pedido</Th>
                  <Th>Data</Th>
                  <Th>Cliente</Th>
                  <Th>Representada</Th>
                  {gestor && <Th>Vendedor</Th>}
                  <Th className="text-right">Base</Th>
                  <Th className="text-right">%</Th>
                  <Th className="text-right">Comissão</Th>
                  <Th className="text-center">Status</Th>
                  {finance && <Th className="text-right">Ações</Th>}
                </tr>
              </Thead>
              <Tbody>
                {dados.linhas.map((l) => (
                  <Tr key={l.id}>
                    <Td>
                      {l.pedido_id ? (
                        <Link
                          href={`/sistema/pedidos/${l.pedido_id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          {l.numero ?? "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>{l.data_pedido ? formatDate(l.data_pedido) : "—"}</Td>
                    <Td className="max-w-[200px] truncate" title={l.cliente}>{l.cliente}</Td>
                    <Td className="max-w-[160px] truncate" title={l.representada}>{l.representada}</Td>
                    {gestor && <Td>{l.vendedor}</Td>}
                    <Td className="text-right">{formatBRL(l.valor_base)}</Td>
                    <Td className="text-right">{formatPercent(l.percentual, 2)}</Td>
                    <Td className="text-right font-medium">{formatBRL(l.valor_comissao)}</Td>
                    <Td className="text-center">
                      <Badge tone={STATUS_TONE[l.status] ?? "neutral"}>
                        {COMISSAO_STATUS_LABEL.get(l.status) ?? l.status}
                      </Badge>
                      {l.data_recebimento && (
                        <div className="mt-0.5 text-xs text-neutral-400">
                          {formatDate(l.data_recebimento)}
                        </div>
                      )}
                    </Td>
                    {finance && (
                      <Td className="text-right">
                        <ComissaoRowActions id={l.id} status={l.status} />
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </TableScroll>
        )}
      </div>
    </div>
  );
}
