import Link from "next/link";
import { Plus, ShoppingCart, Eye, Pencil } from "lucide-react";
import RowLink from "@/components/sistema/RowLink";
import EnviarLinkPedido from "@/components/sistema/pedidos/EnviarLinkPedido";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import {
  listRepresentadaOptions,
  listVendedorOptions,
  representadaLabelMap,
  profileLabelMap,
} from "@/lib/sistema/queries";
import { onlyDigits, formatBRL, formatDate } from "@/lib/sistema/format";
import { PEDIDO_STATUS_OPTIONS } from "@/lib/sistema/types";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Badge, PEDIDO_STATUS } from "@/components/sistema/ui/Badge";
import Filters from "@/components/sistema/Filters";
import Pagination from "@/components/sistema/Pagination";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
} from "@/components/sistema/ui/Table";

const PAGE_SIZE = 25;

function periodoInicio(p: string): string | null {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (p === "mes") {
    d.setDate(1);
    return d.toISOString();
  }
  if (p === "90") {
    d.setDate(d.getDate() - 90);
    return d.toISOString();
  }
  if (p === "ano") {
    return new Date(d.getFullYear(), 0, 1).toISOString();
  }
  return null;
}

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSistemaProfile();
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const representada = sp.representada ?? "";
  const vendedor = sp.vendedor ?? "";
  const status = sp.status ?? "";
  const periodo = sp.periodo ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSistemaClient();
  const [repOptions, vendedorOptions, repMap, profileMap] = await Promise.all([
    listRepresentadaOptions(),
    listVendedorOptions(),
    representadaLabelMap(),
    profileLabelMap(),
  ]);

  let query = supabase
    .from("pedidos")
    .select("id, numero, data_pedido, status, valor_total, cliente_id, representada_id, vendedor_id, share_token", {
      count: "exact",
    })
    .order("data_pedido", { ascending: false });

  if (representada) query = query.eq("representada_id", representada);
  if (vendedor) query = query.eq("vendedor_id", vendedor);
  if (status) query = query.eq("status", status);
  const ini = periodoInicio(periodo);
  if (ini) query = query.gte("data_pedido", ini);

  if (busca) {
    const num = Number(onlyDigits(busca));
    if (num) {
      query = query.eq("numero", num);
    } else {
      const d = onlyDigits(busca);
      const parts = [`razao_social.ilike.%${busca}%`, `nome_fantasia.ilike.%${busca}%`];
      if (d) parts.push(`cnpj.ilike.%${d}%`);
      const { data: cids } = await supabase.from("clientes").select("id").or(parts.join(","));
      const ids = (cids ?? []).map((c) => c.id as string);
      query = query.in("cliente_id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = data ?? [];
  const total = count ?? 0;

  // nomes de clientes da página
  const clienteIds = [...new Set(rows.map((r) => r.cliente_id as string))];
  const clienteMap = new Map<string, string>();
  if (clienteIds.length) {
    const { data: cs } = await supabase
      .from("clientes")
      .select("id, nome_fantasia, razao_social")
      .in("id", clienteIds);
    for (const c of cs ?? [])
      clienteMap.set(c.id as string, (c.nome_fantasia as string) || (c.razao_social as string) || "—");
  }

  const isEmpty = total === 0 && !busca && !representada && !vendedor && !status && !periodo;

  return (
    <div>
      <PageHeader
        title="Pedidos"
        description="Lançamento e acompanhamento por representada."
        action={
          <Link href="/sistema/pedidos/novo" className={buttonClass({ size: "sm" })}>
            <Plus size={15} /> Novo pedido
          </Link>
        }
      />

      <Filters
        searchPlaceholder="Buscar por número, cliente ou CNPJ…"
        selects={[
          {
            key: "periodo",
            label: "Período",
            options: [
              { value: "mes", label: "Este mês" },
              { value: "90", label: "Últimos 90 dias" },
              { value: "ano", label: "Este ano" },
            ],
          },
          {
            key: "representada",
            label: "Representada",
            options: repOptions.map((o) => ({ value: o.id, label: o.label })),
          },
          {
            key: "vendedor",
            label: "Vendedor",
            options: vendedorOptions.map((o) => ({ value: o.id, label: o.label })),
          },
          {
            key: "status",
            label: "Status",
            options: PEDIDO_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
          },
        ]}
      />

      {isEmpty ? (
        <EmptyState
          icon={<ShoppingCart size={32} />}
          title="Nenhum pedido lançado"
          description="Lance o primeiro pedido escolhendo cliente, representada e produtos."
          action={
            <Link href="/sistema/pedidos/novo" className={buttonClass({ size: "sm" })}>
              <Plus size={15} /> Novo pedido
            </Link>
          }
        />
      ) : (
        <>
          <TableScroll>
            <Table fixed>
              <colgroup>
                <col style={{ width: "7%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: 104 }} />
              </colgroup>
              <Thead>
                <Tr>
                  <Th>Pedido</Th>
                  <Th>Data</Th>
                  <Th>Cliente</Th>
                  <Th>Representada</Th>
                  <Th>Vendedor</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Valor</Th>
                  <Th className="sticky right-0 bg-neutral-50 text-right">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={8}>Nenhum resultado para os filtros aplicados.</TableEmpty>
                ) : (
                  rows.map((p) => {
                    const st = PEDIDO_STATUS[p.status as string] ?? {
                      label: p.status as string,
                      tone: "neutral" as const,
                    };
                    const editavel = !["cancelado", "rejeitado"].includes(p.status as string);
                    return (
                      <RowLink key={p.id as string} href={`/sistema/pedidos/${p.id}`}>
                        <Td className="font-medium text-neutral-900">#{p.numero as number}</Td>
                        <Td className="whitespace-nowrap text-xs">
                          {formatDate(p.data_pedido as string)}
                        </Td>
                        <Td className="truncate" title={clienteMap.get(p.cliente_id as string) ?? ""}>
                          {clienteMap.get(p.cliente_id as string) ?? "—"}
                        </Td>
                        <Td className="truncate" title={repMap.get(p.representada_id as string) ?? ""}>
                          {repMap.get(p.representada_id as string) ?? "—"}
                        </Td>
                        <Td
                          className="truncate"
                          title={p.vendedor_id ? profileMap.get(p.vendedor_id as string) ?? "" : ""}
                        >
                          {p.vendedor_id ? profileMap.get(p.vendedor_id as string) ?? "—" : "—"}
                        </Td>
                        <Td className="whitespace-nowrap">
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Td>
                        <Td className="whitespace-nowrap text-right font-medium">
                          {formatBRL(Number(p.valor_total))}
                        </Td>
                        <Td className="sticky right-0 bg-white text-right">
                          <div className="flex justify-end gap-0.5">
                            <EnviarLinkPedido
                              token={p.share_token as string}
                              numero={p.numero as number}
                              variant="icon"
                            />
                            <Link
                              href={`/sistema/pedidos/${p.id}`}
                              className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                              title="Ver"
                            >
                              <Eye size={15} />
                            </Link>
                            {editavel && (
                              <Link
                                href={`/sistema/pedidos/${p.id}/editar`}
                                className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                                title="Editar"
                              >
                                <Pencil size={15} />
                              </Link>
                            )}
                          </div>
                        </Td>
                      </RowLink>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </TableScroll>
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
