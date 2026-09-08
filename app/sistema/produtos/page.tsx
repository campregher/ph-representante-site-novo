import Link from "next/link";
import { Plus, Package, Eye, Pencil, Upload } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { listRepresentadaOptions, variacaoCountMap } from "@/lib/sistema/queries";
import { formatBRL } from "@/lib/sistema/format";
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

const PAGE_SIZE = 25;

export default async function ProdutosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const profile = await requireSistemaProfile();
  const sp = await searchParams;
  const busca = (sp.busca ?? "").trim();
  const representada = sp.representada ?? "";
  const categoria = sp.categoria ?? "";
  const status = sp.status ?? "";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSistemaClient();
  const repOptions = await listRepresentadaOptions();

  const catOptions = representada
    ? (
        (
          await supabase
            .from("categorias_produtos")
            .select("id, nome")
            .eq("representada_id", representada)
            .order("nome")
        ).data ?? []
      ).map((c) => ({ value: c.id as string, label: c.nome as string }))
    : [];

  let query = supabase
    .from("produtos")
    .select(
      "id, sku, nome, aplicacao, ativo, preco_bruto, representada:representadas(nome_fantasia, razao_social), categoria:categorias_produtos(nome)",
      { count: "exact" }
    )
    .order("nome", { ascending: true });

  if (busca) {
    const term = busca.replace(/[%_]/g, "\\$&");
    query = query.or(
      [
        `sku.ilike.%${term}%`,
        `nome.ilike.%${term}%`,
        `aplicacao.ilike.%${term}%`,
        `marca.ilike.%${term}%`,
        `montadora.ilike.%${term}%`,
        `modelo.ilike.%${term}%`,
        `codigo_fabrica.ilike.%${term}%`,
      ].join(",")
    );
  }
  if (representada) query = query.eq("representada_id", representada);
  if (categoria) query = query.eq("categoria_id", categoria);
  if (status === "ativo") query = query.eq("ativo", true);
  if (status === "inativo") query = query.eq("ativo", false);

  const { data, count } = await query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const rows = data ?? [];
  const total = count ?? 0;
  const varCount = await variacaoCountMap(rows.map((p) => p.id as string));

  const isEmpty = total === 0 && !busca && !representada && !categoria && !status;

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Catálogo por representada."
        action={
          canManage(profile.role) && (
            <div className="flex gap-2">
              <Link href="/sistema/produtos/import" className={buttonClass({ variant: "outline", size: "sm" })}>
                <Upload size={15} /> Importar
              </Link>
              <Link href="/sistema/produtos/novo" className={buttonClass({ size: "sm" })}>
                <Plus size={15} /> Novo produto
              </Link>
            </div>
          )
        }
      />

      <Filters
        searchPlaceholder="Buscar por SKU, nome, aplicação, montadora…"
        selects={[
          {
            key: "representada",
            label: "Representada",
            options: repOptions.map((o) => ({ value: o.id, label: o.label })),
          },
          ...(catOptions.length
            ? [{ key: "categoria", label: "Categoria", options: catOptions }]
            : []),
          {
            key: "status",
            label: "Status",
            options: [
              { value: "ativo", label: "Ativos" },
              { value: "inativo", label: "Inativos" },
            ],
          },
        ]}
      />

      {isEmpty ? (
        <EmptyState
          icon={<Package size={32} />}
          title="Nenhum produto cadastrado"
          description="Cadastre manualmente ou importe uma planilha de uma representada."
          action={
            canManage(profile.role) && (
              <Link href="/sistema/produtos/import" className={buttonClass({ size: "sm" })}>
                <Upload size={15} /> Importar planilha
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
                  <Th>SKU</Th>
                  <Th>Produto</Th>
                  <Th>Representada</Th>
                  <Th>Categoria</Th>
                  <Th>Aplicação</Th>
                  <Th className="text-right">Preço bruto</Th>
                  <Th>Status</Th>
                  <Th className="sticky right-0 bg-neutral-50 text-right">Ações</Th>
                </Tr>
              </Thead>
              <Tbody>
                {rows.length === 0 ? (
                  <TableEmpty colSpan={8}>Nenhum resultado para os filtros aplicados.</TableEmpty>
                ) : (
                  rows.map((p) => {
                    const rep = p.representada as unknown as
                      | { nome_fantasia: string | null; razao_social: string }
                      | null;
                    const cat = p.categoria as unknown as { nome: string } | null;
                    const pm = p.preco_bruto != null ? Number(p.preco_bruto) : null;
                    return (
                      <Tr key={p.id as string}>
                        <Td className="font-mono text-xs">{p.sku as string}</Td>
                        <Td>
                          <Link
                            href={`/sistema/produtos/${p.id}`}
                            className="font-medium text-neutral-900 hover:text-brand"
                          >
                            {p.nome as string}
                          </Link>
                          {varCount.get(p.id as string) ? (
                            <span className="ml-2 rounded-full bg-brand/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand">
                              {varCount.get(p.id as string)} variações
                            </span>
                          ) : null}
                        </Td>
                        <Td>{rep ? rep.nome_fantasia || rep.razao_social : "—"}</Td>
                        <Td>{cat?.nome ?? "—"}</Td>
                        <Td className="max-w-[200px] truncate">{(p.aplicacao as string) || "—"}</Td>
                        <Td className="text-right">{pm != null ? formatBRL(pm) : "—"}</Td>
                        <Td>
                          <Badge tone={p.ativo ? "green" : "neutral"}>
                            {p.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </Td>
                        <Td className="sticky right-0 bg-white text-right">
                          <div className="flex justify-end gap-1">
                            <Link
                              href={`/sistema/produtos/${p.id}`}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                              title="Ver"
                            >
                              <Eye size={15} />
                            </Link>
                            {canManage(profile.role) && (
                              <Link
                                href={`/sistema/produtos/${p.id}/editar`}
                                className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                                title="Editar"
                              >
                                <Pencil size={15} />
                              </Link>
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
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} />
        </>
      )}
    </div>
  );
}
