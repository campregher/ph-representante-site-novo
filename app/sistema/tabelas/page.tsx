import Link from "next/link";
import { Plus, Tags, Eye, Pencil, Printer } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listRepresentadaOptions } from "@/lib/sistema/queries";
import { formatDate } from "@/lib/sistema/format";
import { PageHeader, EmptyState } from "@/components/sistema/ui/State";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Badge } from "@/components/sistema/ui/Badge";
import Filters from "@/components/sistema/Filters";
import TabelaRowDelete from "@/components/sistema/tabelas/TabelaRowDelete";
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

export default async function TabelasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const sp = await searchParams;
  const representada = sp.representada ?? "";
  const status = sp.status ?? "";
  const busca = (sp.busca ?? "").trim();

  const supabase = await createSistemaClient();
  const repOptions = await listRepresentadaOptions();

  let query = supabase
    .from("tabelas_preco")
    .select("*, representada:representadas(nome_fantasia, razao_social)")
    .order("nome", { ascending: true });

  if (busca) query = query.ilike("nome", `%${busca}%`);
  if (representada) query = query.eq("representada_id", representada);
  if (status === "ativa") query = query.eq("ativa", true);
  if (status === "inativa") query = query.eq("ativa", false);

  const { data } = await query;
  const rows = data ?? [];

  // contagem de produtos por tabela
  const ids = rows.map((r) => r.id as string);
  const countByTabela = new Map<string, number>();
  if (ids.length) {
    const { data: precos } = await supabase
      .from("produtos_precos")
      .select("tabela_preco_id")
      .in("tabela_preco_id", ids);
    for (const p of precos ?? []) {
      const k = p.tabela_preco_id as string;
      countByTabela.set(k, (countByTabela.get(k) ?? 0) + 1);
    }
  }

  const isEmpty = rows.length === 0 && !busca && !representada && !status;

  return (
    <div>
      <PageHeader
        title="Tabelas de Preço"
        description="Múltiplas tabelas por representada."
        action={
          <div className="flex gap-2">
            {representada && (
              <Link
                href={`/imprimir/representada/${representada}`}
                target="_blank"
                className={buttonClass({ variant: "outline", size: "sm" })}
              >
                <Printer size={15} /> Imprimir tabelas
              </Link>
            )}
            {canManage(profile.role) && (
              <Link href="/sistema/tabelas/nova" className={buttonClass({ size: "sm" })}>
                <Plus size={15} /> Nova tabela
              </Link>
            )}
          </div>
        }
      />

      <Filters
        searchPlaceholder="Buscar por nome da tabela…"
        selects={[
          {
            key: "representada",
            label: "Representada",
            options: repOptions.map((o) => ({ value: o.id, label: o.label })),
          },
          {
            key: "status",
            label: "Status",
            options: [
              { value: "ativa", label: "Ativas" },
              { value: "inativa", label: "Inativas" },
            ],
          },
        ]}
      />

      {isEmpty ? (
        <EmptyState
          icon={<Tags size={32} />}
          title="Nenhuma tabela de preço"
          description="Crie tabelas (Loja, Distribuidor, Especial…) para cada representada."
          action={
            canManage(profile.role) && (
              <Link href="/sistema/tabelas/nova" className={buttonClass({ size: "sm" })}>
                <Plus size={15} /> Nova tabela
              </Link>
            )
          }
        />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Tabela</Th>
                <Th>Representada</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Desconto</Th>
                <Th className="text-right">Overrides</Th>
                <Th>Vigência</Th>
                <Th>Status</Th>
                <Th className="sticky right-0 bg-neutral-50 text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {rows.length === 0 ? (
                <TableEmpty colSpan={8}>Nenhum resultado para os filtros aplicados.</TableEmpty>
              ) : (
                rows.map((t) => {
                  const rep = t.representada as unknown as
                    | { nome_fantasia: string | null; razao_social: string }
                    | null;
                  return (
                    <Tr key={t.id as string}>
                      <Td>
                        <Link
                          href={`/sistema/tabelas/${t.id}`}
                          className="font-medium text-neutral-900 hover:text-brand"
                        >
                          {t.nome as string}
                        </Link>
                      </Td>
                      <Td>{rep ? rep.nome_fantasia || rep.razao_social : "—"}</Td>
                      <Td>{(t.tipo as string) || "—"}</Td>
                      <Td className="text-right font-medium">{Number(t.desconto_percentual ?? 0)}%</Td>
                      <Td className="text-right">{countByTabela.get(t.id as string) ?? 0}</Td>
                      <Td className="text-xs">
                        {t.data_inicio ? formatDate(t.data_inicio as string) : "—"}
                        {" – "}
                        {t.data_fim ? formatDate(t.data_fim as string) : "sem fim"}
                      </Td>
                      <Td>
                        <Badge tone={t.ativa ? "green" : "neutral"}>
                          {t.ativa ? "Ativa" : "Inativa"}
                        </Badge>
                      </Td>
                      <Td className="sticky right-0 bg-white text-right">
                        <div className="flex justify-end gap-1">
                          <Link
                            href={`/imprimir/tabela/${t.id}`}
                            target="_blank"
                            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            title="Imprimir"
                          >
                            <Printer size={15} />
                          </Link>
                          <Link
                            href={`/sistema/tabelas/${t.id}`}
                            className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                            title="Ver / editar preços"
                          >
                            <Eye size={15} />
                          </Link>
                          {canManage(profile.role) && (
                            <>
                              <Link
                                href={`/sistema/tabelas/${t.id}/editar`}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                title="Editar dados"
                              >
                                <Pencil size={15} />
                              </Link>
                              <TabelaRowDelete id={t.id as string} nome={t.nome as string} />
                            </>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </TableScroll>
      )}
    </div>
  );
}
