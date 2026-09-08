import Link from "next/link";
import Image from "next/image";
import { Plus, Package, Eye, Pencil, Upload, ChevronLeft, ChevronRight } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { variacaoCountMap } from "@/lib/sistema/queries";
import { formatBRL, formatNumber } from "@/lib/sistema/format";
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

interface RepCard {
  id: string;
  nome: string;
  logo: string | null;
  total: number;
  inativos: number;
}

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
  const verTodos = sp.todos === "1";
  const page = Math.max(1, Number(sp.page) || 1);

  const supabase = await createSistemaClient();
  const gestor = canManage(profile.role);

  const acoesHeader = gestor ? (
    <div className="flex gap-2">
      <Link href="/sistema/produtos/import" className={buttonClass({ variant: "outline", size: "sm" })}>
        <Upload size={15} /> Importar
      </Link>
      <Link href="/sistema/produtos/novo" className={buttonClass({ size: "sm" })}>
        <Plus size={15} /> Novo produto
      </Link>
    </div>
  ) : null;

  // ─────────────────────────────────────────────────────────────────
  // NÍVEL 1 — grade de representadas (quando não há representada nem busca)
  // ─────────────────────────────────────────────────────────────────
  if (!representada && !busca && !verTodos) {
    const [{ data: reps }, { data: prods }] = await Promise.all([
      supabase
        .from("representadas")
        .select("id, nome_fantasia, razao_social, logo_url")
        .order("nome_fantasia", { ascending: true, nullsFirst: false }),
      supabase.from("produtos").select("representada_id, ativo").limit(50000),
    ]);

    const contagem = new Map<string, { total: number; inativos: number }>();
    for (const p of prods ?? []) {
      const rid = (p.representada_id as string) ?? "—";
      const c = contagem.get(rid) ?? { total: 0, inativos: 0 };
      c.total += 1;
      if (!p.ativo) c.inativos += 1;
      contagem.set(rid, c);
    }

    const cards: RepCard[] = (reps ?? [])
      .map((r) => {
        const c = contagem.get(r.id as string) ?? { total: 0, inativos: 0 };
        return {
          id: r.id as string,
          nome: (r.nome_fantasia as string) || (r.razao_social as string) || "—",
          logo: (r.logo_url as string) || null,
          total: c.total,
          inativos: c.inativos,
        };
      })
      .sort((a, b) => b.total - a.total || a.nome.localeCompare(b.nome));

    const totalProdutos = cards.reduce((s, c) => s + c.total, 0);
    const semRep = contagem.get("—")?.total ?? 0;

    return (
      <div>
        <PageHeader
          title="Produtos"
          description={`${formatNumber(totalProdutos, 0)} produtos em ${cards.filter((c) => c.total > 0).length} representadas.`}
          action={acoesHeader}
        />

        {totalProdutos === 0 ? (
          <EmptyState
            icon={<Package size={32} />}
            title="Nenhum produto cadastrado"
            description="Cadastre manualmente ou importe uma planilha de uma representada."
            action={
              gestor && (
                <Link href="/sistema/produtos/import" className={buttonClass({ size: "sm" })}>
                  <Upload size={15} /> Importar planilha
                </Link>
              )
            }
          />
        ) : (
          <>
            <Filters searchPlaceholder="Buscar produto em todas as representadas…" />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cards.map((c) => (
                <Link
                  key={c.id}
                  href={`/sistema/produtos?representada=${c.id}`}
                  className="group flex items-center gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-brand/40 hover:shadow-sm"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-100 bg-neutral-50">
                    {c.logo ? (
                      <Image
                        src={c.logo}
                        alt={c.nome}
                        width={44}
                        height={44}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Package size={20} className="text-neutral-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-neutral-900 group-hover:text-brand">
                      {c.nome}
                    </div>
                    <div className="mt-0.5 text-xs text-neutral-500">
                      {formatNumber(c.total, 0)} produto{c.total === 1 ? "" : "s"}
                      {c.inativos > 0 && (
                        <span className="text-neutral-400"> · {c.inativos} inativo{c.inativos === 1 ? "" : "s"}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-neutral-300 group-hover:text-brand" />
                </Link>
              ))}
            </div>

            {semRep > 0 && (
              <Link
                href="/sistema/produtos?todos=1"
                className="mt-3 inline-flex text-sm text-neutral-500 hover:text-brand hover:underline"
              >
                {semRep} produto(s) sem representada — ver na lista completa
              </Link>
            )}

            <div className="mt-4">
              <Link
                href="/sistema/produtos?todos=1"
                className="text-sm font-medium text-brand hover:underline"
              >
                Ver todos os produtos numa lista única →
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // NÍVEL 2 — lista (uma representada, busca global, ou "ver todos")
  // ─────────────────────────────────────────────────────────────────
  const [{ data: repOptionsRaw }, repAtual] = await Promise.all([
    supabase
      .from("representadas")
      .select("id, nome_fantasia, razao_social")
      .order("nome_fantasia", { ascending: true, nullsFirst: false }),
    representada
      ? supabase
          .from("representadas")
          .select("nome_fantasia, razao_social")
          .eq("id", representada)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const repOptions = (repOptionsRaw ?? []).map((r) => ({
    id: r.id as string,
    label: (r.nome_fantasia as string) || (r.razao_social as string),
  }));
  const repNome = repAtual.data
    ? (repAtual.data.nome_fantasia as string) || (repAtual.data.razao_social as string)
    : null;

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

  const showRepColumn = !representada;

  return (
    <div>
      <PageHeader
        title={repNome ? `Produtos · ${repNome}` : verTodos ? "Todos os produtos" : "Produtos"}
        description={
          total > 0
            ? `${formatNumber(total, 0)} produto${total === 1 ? "" : "s"}`
            : "Catálogo por representada."
        }
        action={acoesHeader}
      />

      <Link
        href="/sistema/produtos"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-500 hover:text-brand"
      >
        <ChevronLeft size={15} /> Todas as representadas
      </Link>

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

      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>SKU</Th>
              <Th>Produto</Th>
              {showRepColumn && <Th>Representada</Th>}
              <Th>Categoria</Th>
              <Th>Aplicação</Th>
              <Th className="text-right">Preço bruto</Th>
              <Th>Status</Th>
              <Th className="sticky right-0 bg-neutral-50 text-right">Ações</Th>
            </Tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={showRepColumn ? 8 : 7}>
                Nenhum resultado para os filtros aplicados.
              </TableEmpty>
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
                    {showRepColumn && (
                      <Td>{rep ? rep.nome_fantasia || rep.razao_social : "—"}</Td>
                    )}
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
                        {gestor && (
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
    </div>
  );
}
