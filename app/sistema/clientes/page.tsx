import Link from "next/link";
import { Plus, Users, Eye, Pencil } from "lucide-react";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listVendedorOptions, profileLabelMap } from "@/lib/sistema/queries";
import { onlyDigits, formatPhone, formatBRL, formatDate } from "@/lib/sistema/format";
import { STATUS_VENDA, CLIENTE_STATUS_OPTIONS, UF_LIST } from "@/lib/sistema/types";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Badge, CLIENTE_STATUS } from "@/components/sistema/ui/Badge";
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

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSistemaProfile();
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const vendedor = sp.vendedor ?? "";
  const estado = sp.estado ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSistemaClient();
  const [vendedorOptions, labelMap] = await Promise.all([
    listVendedorOptions(),
    profileLabelMap(),
  ]);

  let query = supabase
    .from("clientes")
    .select("*", { count: "exact" })
    .order("nome_fantasia", { ascending: true, nullsFirst: false });

  if (busca) {
    const d = onlyDigits(busca);
    const parts = [
      `razao_social.ilike.%${busca}%`,
      `nome_fantasia.ilike.%${busca}%`,
      `cidade.ilike.%${busca}%`,
      `telefone.ilike.%${busca}%`,
      `whatsapp.ilike.%${busca}%`,
    ];
    if (d) {
      parts.push(`cnpj.ilike.%${d}%`);
      parts.push(`cpf.ilike.%${d}%`);
    }
    query = query.or(parts.join(","));
  }
  if (vendedor) query = query.eq("vendedor_id", vendedor);
  if (estado) query = query.eq("estado", estado);
  if (status) query = query.eq("status", status);

  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = data ?? [];
  const total = count ?? 0;

  // valor comprado (todas as vendas) por cliente
  const ids = rows.map((r) => r.id as string);
  const comprado = new Map<string, number>();
  if (ids.length) {
    const { data: peds } = await supabase
      .from("pedidos")
      .select("cliente_id, valor_total, status")
      .in("cliente_id", ids)
      .in("status", [...STATUS_VENDA]);
    for (const p of peds ?? []) {
      const k = p.cliente_id as string;
      comprado.set(k, (comprado.get(k) ?? 0) + Number(p.valor_total ?? 0));
    }
  }

  const isEmpty = total === 0 && !busca && !vendedor && !estado && !status;

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro, relacionamento e histórico de compras."
        action={
          <Link href="/sistema/clientes/novo" className={buttonClass({ size: "sm" })}>
            <Plus size={15} /> Novo cliente
          </Link>
        }
      />

      <Filters
        searchPlaceholder="Buscar por nome, CNPJ/CPF, telefone ou cidade…"
        selects={[
          {
            key: "vendedor",
            label: "Vendedor",
            options: vendedorOptions.map((o) => ({ value: o.id, label: o.label })),
          },
          { key: "estado", label: "UF", options: UF_LIST.map((u) => ({ value: u, label: u })) },
          {
            key: "status",
            label: "Status",
            options: CLIENTE_STATUS_OPTIONS.map((s) => ({ value: s.value, label: s.label })),
          },
        ]}
      />

      {isEmpty ? (
        <EmptyState
          icon={<Users size={32} />}
          title="Nenhum cliente cadastrado"
          description="Cadastre o primeiro cliente para começar a lançar pedidos."
          action={
            <Link href="/sistema/clientes/novo" className={buttonClass({ size: "sm" })}>
              <Plus size={15} /> Novo cliente
            </Link>
          }
        />
      ) : (
        <>
          <TableScroll>
            <Table>
              <Thead>
                <Tr>
                  <Th>Cliente</Th>
                  <Th>Cidade</Th>
                  <Th>Telefone</Th>
                  <Th>Vendedor</Th>
                  <Th>Última compra</Th>
                  <Th className="text-right">Valor comprado</Th>
                  <Th>Status</Th>
                  <Th className="sticky right-0 bg-neutral-50 text-right">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={8}>Nenhum resultado para os filtros aplicados.</TableEmpty>
                ) : (
                  rows.map((c) => {
                    const st = CLIENTE_STATUS[c.status as string] ?? {
                      label: c.status as string,
                      tone: "neutral" as const,
                    };
                    return (
                      <Tr key={c.id as string}>
                        <Td>
                          <Link
                            href={`/sistema/clientes/${c.id}`}
                            className="font-medium text-neutral-900 hover:text-brand"
                          >
                            {(c.nome_fantasia as string) || (c.razao_social as string) || "—"}
                          </Link>
                          {c.nome_fantasia && c.razao_social && (
                            <div className="text-xs text-neutral-400">{c.razao_social as string}</div>
                          )}
                        </Td>
                        <Td>
                          {[c.cidade, c.estado].filter(Boolean).join(" / ") || "—"}
                        </Td>
                        <Td>
                          {c.telefone
                            ? formatPhone(c.telefone as string)
                            : c.whatsapp
                              ? formatPhone(c.whatsapp as string)
                              : "—"}
                        </Td>
                        <Td>{c.vendedor_id ? labelMap.get(c.vendedor_id as string) ?? "—" : "—"}</Td>
                        <Td className="text-xs">
                          {c.data_ultima_compra ? formatDate(c.data_ultima_compra as string) : "—"}
                        </Td>
                        <Td className="text-right">
                          {comprado.get(c.id as string)
                            ? formatBRL(comprado.get(c.id as string)!)
                            : "—"}
                        </Td>
                        <Td>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Td>
                        <Td className="sticky right-0 bg-white text-right">
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/sistema/clientes/${c.id}`}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              title="Ver"
                            >
                              <Eye size={15} />
                            </Link>
                            <Link
                              href={`/sistema/clientes/${c.id}/editar`}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </Link>
                          </div>
                        </Td>
                      </Tr>
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
