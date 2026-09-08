import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { formatBRL, formatDate } from "@/lib/sistema/format";
import { precoLiquido } from "@/lib/sistema/preco";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
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
import ProdutoActions from "@/components/sistema/produtos/ProdutoActions";
import type { Produto } from "@/lib/sistema/types";

export default async function ProdutoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireSistemaProfile();
  const { id } = await params;
  const supabase = await createSistemaClient();

  const { data } = await supabase
    .from("produtos")
    .select(
      "*, representada:representadas(id, nome_fantasia, razao_social), categoria:categorias_produtos(nome)"
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const p = data as unknown as Produto & {
    representada: { id: string; nome_fantasia: string | null; razao_social: string } | null;
    categoria: { nome: string } | null;
  };

  const [{ data: tabelas }, { data: overrides }] = await Promise.all([
    supabase
      .from("tabelas_preco")
      .select("id, nome, tipo, ativa, desconto_percentual")
      .eq("representada_id", p.representada_id)
      .order("nome", { ascending: true }),
    supabase.from("produtos_precos").select("tabela_preco_id, preco").eq("produto_id", id),
  ]);
  const overrideMap = new Map(
    (overrides ?? []).map((o) => [o.tabela_preco_id as string, o.preco != null ? Number(o.preco) : null])
  );

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-neutral-200 bg-white">
            {p.imagem_url ? (
              <Image src={p.imagem_url} alt="" width={56} height={56} className="h-full w-full object-contain p-1" unoptimized />
            ) : (
              <Package size={22} className="text-neutral-300" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-neutral-900">{p.nome}</h1>
              <Badge tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Badge>
            </div>
            <p className="mt-0.5 font-mono text-sm text-neutral-500">{p.sku}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {p.representada && (
                <Link
                  href={`/sistema/representadas/${p.representada.id}`}
                  className="text-brand hover:underline"
                >
                  {p.representada.nome_fantasia || p.representada.razao_social}
                </Link>
              )}
              {p.categoria ? ` · ${p.categoria.nome}` : ""}
            </p>
          </div>
        </div>
        <ProdutoActions id={p.id} ativo={p.ativo} canManage={canManage(profile.role)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Dados" />
          <CardBody>
            <Row
              label="Preço bruto"
              value={p.preco_bruto != null ? formatBRL(Number(p.preco_bruto)) : ""}
            />
            <Row label="Código de fábrica" value={p.codigo_fabrica} />
            <Row label="EAN" value={p.ean} />
            <Row label="NCM" value={p.ncm} />
            <Row label="Marca" value={p.marca} />
            <Row label="Unidade" value={p.unidade} />
            <Row label="Peso da embalagem" value={p.peso != null ? `${p.peso} kg` : ""} />
            <Row
              label="Dimensões (A×L×C)"
              value={
                p.altura != null || p.largura != null || p.comprimento != null
                  ? `${p.altura ?? "?"} × ${p.largura ?? "?"} × ${p.comprimento ?? "?"} cm`
                  : ""
              }
            />
            <Row label="Atualizado em" value={formatDate(p.updated_at)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Aplicação" />
          <CardBody>
            <Row label="Aplicação" value={p.aplicacao} />
            <Row label="Montadora" value={p.montadora} />
            <Row label="Modelo" value={p.modelo} />
            <Row
              label="Anos"
              value={p.ano_inicio || p.ano_fim ? `${p.ano_inicio ?? "?"} – ${p.ano_fim ?? "?"}` : ""}
            />
          </CardBody>
        </Card>
        {p.descricao && (
          <Card className="lg:col-span-2">
            <CardHeader title="Descrição" />
            <CardBody>
              <p className="whitespace-pre-wrap text-sm text-neutral-700">{p.descricao}</p>
            </CardBody>
          </Card>
        )}
      </div>

      <div className="mt-4">
        <Card>
          <CardHeader
            title="Preço por tabela"
            description="Calculado a partir do preço bruto e do desconto de cada tabela (override = exceção)."
          />
          <CardBody className="p-0">
            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Tabela</Th>
                    <Th>Tipo</Th>
                    <Th className="text-right">Desconto</Th>
                    <Th className="text-right">Override</Th>
                    <Th className="text-right">Preço final</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {!tabelas || tabelas.length === 0 ? (
                    <TableEmpty colSpan={5}>
                      Nenhuma tabela de preço nesta representada.
                    </TableEmpty>
                  ) : (
                    tabelas.map((tab) => {
                      const ov = overrideMap.get(tab.id as string) ?? null;
                      const final = precoLiquido(
                        p.preco_bruto,
                        Number(tab.desconto_percentual),
                        ov
                      );
                      return (
                        <Tr key={tab.id as string}>
                          <Td>
                            <Link
                              href={`/sistema/tabelas/${tab.id}`}
                              className="text-neutral-900 hover:text-brand"
                            >
                              {tab.nome as string}
                            </Link>
                            {!tab.ativa && <span className="ml-1 text-xs text-neutral-400">(inativa)</span>}
                          </Td>
                          <Td>{(tab.tipo as string) || "—"}</Td>
                          <Td className="text-right">{Number(tab.desconto_percentual)}%</Td>
                          <Td className="text-right">{ov != null ? formatBRL(ov) : "—"}</Td>
                          <Td className="text-right font-medium">
                            {final != null ? formatBRL(final) : "—"}
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
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-500">{label}</span>
      <span className="text-right font-medium text-neutral-800">{value || "—"}</span>
    </div>
  );
}
