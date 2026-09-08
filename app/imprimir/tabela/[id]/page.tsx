import { notFound } from "next/navigation";
import Image from "next/image";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { formatBRL, formatDateTime } from "@/lib/sistema/format";
import { precoLiquido } from "@/lib/sistema/preco";
import PrintButton from "@/components/sistema/PrintButton";
import ExcelExportButton from "@/components/sistema/ExcelExportButton";
import type { TabelaPreco } from "@/lib/sistema/types";

export default async function ImprimirTabelaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSistemaProfile();
  const { id } = await params;
  const supabase = await createSistemaClient();

  const { data } = await supabase
    .from("tabelas_preco")
    .select("*, representada:representadas(nome_fantasia, razao_social, cnpj, logo_url)")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();

  const t = data as unknown as TabelaPreco & {
    representada: {
      nome_fantasia: string | null;
      razao_social: string;
      cnpj: string | null;
      logo_url: string | null;
    } | null;
  };
  const desc = Number(t.desconto_percentual) || 0;

  const [{ data: produtos }, { data: overrides }] = await Promise.all([
    supabase
      .from("produtos")
      .select("id, sku, nome, marca, preco_bruto, ativo")
      .eq("representada_id", t.representada_id)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase.from("produtos_precos").select("produto_id, preco").eq("tabela_preco_id", id),
  ]);
  const ovMap = new Map(
    (overrides ?? []).map((o) => [o.produto_id as string, o.preco != null ? Number(o.preco) : null])
  );

  const linhas = (produtos ?? [])
    .map((p) => {
      const bruto = p.preco_bruto != null ? Number(p.preco_bruto) : null;
      const ov = ovMap.get(p.id as string) ?? null;
      return {
        sku: p.sku as string,
        nome: p.nome as string,
        marca: (p.marca as string) || "",
        bruto,
        final: precoLiquido(bruto, desc, ov),
      };
    })
    .filter((l) => l.final != null);

  const repNome = t.representada?.nome_fantasia || t.representada?.razao_social || "representada";

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="no-print mb-4 flex justify-end gap-2">
        <ExcelExportButton
          filename={`tabela-${repNome}-${t.nome}`}
          sheetName={t.nome}
          columns={["Código", "Produto", "Marca", "Preço bruto", "Desconto %", "Preço líquido"]}
          rows={linhas.map((l) => [l.sku, l.nome, l.marca, l.bruto, desc, l.final])}
        />
        <PrintButton auto />
      </div>

      <div id="print-doc">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
          <div className="flex items-start gap-3">
            {t.representada?.logo_url && (
              <Image
                src={t.representada.logo_url}
                alt=""
                width={56}
                height={56}
                className="h-12 w-12 object-contain"
                unoptimized
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-neutral-900">
                {t.representada?.nome_fantasia || t.representada?.razao_social}
              </h1>
              <p className="text-sm text-neutral-600">
                Tabela: <strong>{t.nome}</strong>
                {t.tipo ? ` · ${t.tipo}` : ""} · Desconto {desc}%
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            Gerado em {formatDateTime(new Date())}
            <br />
            {linhas.length} itens
          </div>
        </header>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-neutral-400 text-left">
              <th className="py-1.5 pr-2">Código</th>
              <th className="py-1.5 pr-2">Produto</th>
              <th className="py-1.5 pr-2">Marca</th>
              <th className="py-1.5 pr-2 text-right">Preço bruto</th>
              <th className="py-1.5 pr-2 text-right">Desc.</th>
              <th className="py-1.5 text-right">Preço</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className="border-b border-neutral-200">
                <td className="py-1 pr-2 font-mono text-xs">{l.sku}</td>
                <td className="py-1 pr-2">{l.nome}</td>
                <td className="py-1 pr-2 text-neutral-600">{l.marca || "—"}</td>
                <td className="py-1 pr-2 text-right text-neutral-500">
                  {l.bruto != null ? formatBRL(l.bruto) : "—"}
                </td>
                <td className="py-1 pr-2 text-right text-neutral-500">{desc}%</td>
                <td className="py-1 text-right font-semibold">
                  {l.final != null ? formatBRL(l.final) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {linhas.length === 0 && (
          <p className="mt-6 text-sm text-neutral-500">Nenhum produto com preço nesta tabela.</p>
        )}

        <p className="mt-6 text-[11px] text-neutral-400">
          Preços sujeitos a alteração sem aviso prévio. Pedido mínimo e condições conforme
          combinado com a representada.
        </p>
      </div>
    </div>
  );
}
