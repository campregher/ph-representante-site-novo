import Link from "next/link";
import Image from "next/image";
import { Plus, Building2, Eye, Pencil } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import {
  onlyDigits,
  formatCNPJ,
  formatPhone,
  formatPercent,
  formatBRL,
} from "@/lib/sistema/format";
import { STATUS_VENDA } from "@/lib/sistema/types";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Badge } from "@/components/sistema/ui/Badge";
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
import type { Representada } from "@/lib/sistema/types";

const PAGE_SIZE = 20;

export default async function RepresentadasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const status = sp.status ?? "";
  const modalidade = sp.modalidade ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSistemaClient();
  let query = supabase
    .from("representadas")
    .select("*", { count: "exact" })
    .order("nome_fantasia", { ascending: true, nullsFirst: false });

  if (busca) {
    const d = onlyDigits(busca);
    const parts = [
      `razao_social.ilike.%${busca}%`,
      `nome_fantasia.ilike.%${busca}%`,
    ];
    if (d) parts.push(`cnpj.ilike.%${d}%`);
    query = query.or(parts.join(","));
  }
  if (status === "ativa") query = query.eq("ativa", true);
  if (status === "inativa") query = query.eq("ativa", false);
  if (modalidade === "atacado" || modalidade === "dropshipping")
    query = query.contains("modalidades", [modalidade]);

  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = (data as Representada[]) ?? [];
  const total = count ?? 0;

  // Vendido no mês (por representada)
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);
  const ids = rows.map((r) => r.id);
  const vendaMes = new Map<string, number>();
  const pedidosMes = new Map<string, number>();
  if (ids.length) {
    const { data: peds } = await supabase
      .from("pedidos")
      .select("representada_id, valor_total, status")
      .in("representada_id", ids)
      .gte("data_pedido", inicioMes.toISOString())
      .in("status", [...STATUS_VENDA]);
    for (const p of peds ?? []) {
      const k = p.representada_id as string;
      vendaMes.set(k, (vendaMes.get(k) ?? 0) + Number(p.valor_total ?? 0));
      pedidosMes.set(k, (pedidosMes.get(k) ?? 0) + 1);
    }
  }

  return (
    <div>
      <PageHeader
        title="Representadas"
        description="Fornecedores representados, condições e comissão."
        action={
          canManage(profile.role) && (
            <Link href="/sistema/representadas/nova" className={buttonClass({ size: "sm" })}>
              <Plus size={15} /> Nova representada
            </Link>
          )
        }
      />

      <Filters
        searchPlaceholder="Buscar por nome, razão social ou CNPJ…"
        selects={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "ativa", label: "Ativas" },
              { value: "inativa", label: "Inativas" },
            ],
          },
          {
            key: "modalidade",
            label: "Modalidade",
            options: [
              { value: "atacado", label: "Atacado" },
              { value: "dropshipping", label: "Dropshipping" },
            ],
          },
        ]}
      />

      {total === 0 && !busca && !status && !modalidade ? (
        <EmptyState
          icon={<Building2 size={32} />}
          title="Nenhuma representada cadastrada"
          description="Cadastre a primeira representada para começar a lançar produtos e pedidos."
          action={
            canManage(profile.role) && (
              <Link href="/sistema/representadas/nova" className={buttonClass({ size: "sm" })}>
                <Plus size={15} /> Nova representada
              </Link>
            )
          }
        />
      ) : (
        <>
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Representada</Th>
                  <Th>CNPJ</Th>
                  <Th>Telefone</Th>
                  <Th className="text-right">Comissão</Th>
                  <Th className="text-right">Vendido no mês</Th>
                  <Th>Status</Th>
                  <Th className="sticky right-0 bg-neutral-50 text-right">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={7}>Nenhum resultado para os filtros aplicados.</TableEmpty>
                ) : (
                  rows.map((r) => (
                    <Tr key={r.id}>
                      <Td>
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
                            {r.logo_url ? (
                              <Image
                                src={r.logo_url}
                                alt=""
                                width={40}
                                height={40}
                                className="h-full w-full object-contain p-0.5"
                                unoptimized
                              />
                            ) : (
                              <Building2 size={16} className="text-neutral-300" />
                            )}
                          </div>
                          <div>
                            <Link
                              href={`/sistema/representadas/${r.id}`}
                              className="font-medium text-neutral-900 hover:text-brand"
                            >
                              {r.nome_fantasia || r.razao_social}
                            </Link>
                            {r.nome_fantasia && (
                              <div className="text-xs text-neutral-400">{r.razao_social}</div>
                            )}
                            <div className="mt-1 flex gap-1">
                              {r.modalidades?.includes("atacado") && (
                                <Badge tone="blue">Atacado</Badge>
                              )}
                              {r.modalidades?.includes("dropshipping") && (
                                <Badge tone="purple">Dropshipping</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </Td>
                      <Td>{r.cnpj ? formatCNPJ(r.cnpj) : "—"}</Td>
                      <Td>{r.telefone ? formatPhone(r.telefone) : "—"}</Td>
                      <Td className="text-right">
                        {r.percentual_comissao_padrao
                          ? formatPercent(r.percentual_comissao_padrao)
                          : "—"}
                      </Td>
                      <Td className="text-right">
                        {vendaMes.get(r.id) ? (
                          <>
                            <span className="font-medium text-neutral-900">
                              {formatBRL(vendaMes.get(r.id)!)}
                            </span>
                            <div className="text-xs text-neutral-400">
                              {pedidosMes.get(r.id) ?? 0} pedido
                              {(pedidosMes.get(r.id) ?? 0) === 1 ? "" : "s"}
                            </div>
                          </>
                        ) : (
                          <span className="text-neutral-400">—</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={r.ativa ? "green" : "neutral"}>
                          {r.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                      </Td>
                      <Td className="sticky right-0 bg-white text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/sistema/representadas/${r.id}`}
                            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            title="Ver"
                          >
                            <Eye size={15} />
                          </Link>
                          {canManage(profile.role) && (
                            <Link
                              href={`/sistema/representadas/${r.id}/editar`}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </Link>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))
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
