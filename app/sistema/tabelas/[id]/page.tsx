import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSistemaProfile, canManage } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/sistema/format";
import { Badge } from "@/components/sistema/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import TabelaActions from "@/components/sistema/tabelas/TabelaActions";
import PrecoGrid, { type PrecoRow } from "@/components/sistema/tabelas/PrecoGrid";
import type { TabelaPreco } from "@/lib/sistema/types";

export default async function TabelaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await requireSistemaProfile();
  const { id } = await params;
  const supabase = await createSistemaClient();

  const { data } = await supabase
    .from("tabelas_preco")
    .select("*, representada:representadas(id, nome_fantasia, razao_social)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const t = data as unknown as TabelaPreco & {
    representada: { id: string; nome_fantasia: string | null; razao_social: string } | null;
  };

  const [{ data: produtos }, { data: precos }] = await Promise.all([
    supabase
      .from("produtos")
      .select("id, sku, nome, preco_bruto")
      .eq("representada_id", t.representada_id)
      .order("nome", { ascending: true }),
    supabase
      .from("produtos_precos")
      .select("produto_id, preco")
      .eq("tabela_preco_id", id),
  ]);

  const overrideMap = new Map(
    (precos ?? []).map((p) => [p.produto_id as string, p.preco != null ? Number(p.preco) : null])
  );

  const priceKey =
    `${t.desconto_percentual}|` +
    (precos ?? []).map((p) => `${p.produto_id}:${p.preco}`).join("|");

  const gridRows: PrecoRow[] = (produtos ?? []).map((p) => ({
    produto_id: p.id as string,
    sku: p.sku as string,
    nome: p.nome as string,
    preco_bruto: p.preco_bruto != null ? Number(p.preco_bruto) : null,
    override: overrideMap.get(p.id as string) ?? null,
  }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-neutral-900">{t.nome}</h1>
            <Badge tone={t.ativa ? "green" : "neutral"}>{t.ativa ? "Ativa" : "Inativa"}</Badge>
            {t.tipo && <Badge tone="blue">{t.tipo}</Badge>}
            <Badge tone="brand">{t.desconto_percentual}% desconto</Badge>
          </div>
          <p className="mt-0.5 text-sm text-neutral-500">
            {t.representada && (
              <Link
                href={`/sistema/representadas/${t.representada.id}`}
                className="text-brand hover:underline"
              >
                {t.representada.nome_fantasia || t.representada.razao_social}
              </Link>
            )}
            {" · "}
            {t.data_inicio ? formatDate(t.data_inicio) : "sem início"} –{" "}
            {t.data_fim ? formatDate(t.data_fim) : "sem fim"}
          </p>
        </div>
        <TabelaActions id={t.id} ativa={t.ativa} canManage={canManage(profile.role)} />
      </div>

      {t.descricao && (
        <Card className="mb-4">
          <CardBody className="text-sm text-neutral-700">{t.descricao}</CardBody>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Preços dos produtos"
          description={`Preço = preço bruto − ${t.desconto_percentual}% (desconto da tabela). Preencha o override só nas exceções.`}
        />
        <CardBody className="p-4">
          <PrecoGrid
            key={priceKey}
            tabelaId={t.id}
            descontoTabela={Number(t.desconto_percentual) || 0}
            rows={gridRows}
            canManage={canManage(profile.role)}
          />
        </CardBody>
      </Card>
    </div>
  );
}
