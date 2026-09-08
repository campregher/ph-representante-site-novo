import { notFound } from "next/navigation";
import Image from "next/image";
import { requireSistemaProfile } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { formatBRL, formatDateTime } from "@/lib/sistema/format";
import { precoLiquido } from "@/lib/sistema/preco";
import PrintButton from "@/components/sistema/PrintButton";
import ExcelExportButton from "@/components/sistema/ExcelExportButton";
import type { Representada } from "@/lib/sistema/types";

export default async function ImprimirRepresentadaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ incluir_inativas?: string }>;
}) {
  await requireSistemaProfile();
  const { id } = await params;
  const { incluir_inativas } = await searchParams;
  const supabase = await createSistemaClient();

  const { data: rep } = await supabase
    .from("representadas")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!rep) notFound();
  const r = rep as Representada;

  let tq = supabase
    .from("tabelas_preco")
    .select("id, nome, tipo, desconto_percentual, ativa")
    .eq("representada_id", id)
    .order("desconto_percentual", { ascending: true });
  if (incluir_inativas !== "1") tq = tq.eq("ativa", true);

  const [{ data: tabelas }, { data: produtos }, { data: overrides }] = await Promise.all([
    tq,
    supabase
      .from("produtos")
      .select("id, sku, nome, marca, preco_bruto")
      .eq("representada_id", id)
      .eq("ativo", true)
      .order("nome", { ascending: true }),
    supabase
      .from("produtos_precos")
      .select("produto_id, tabela_preco_id, preco")
      .in(
        "tabela_preco_id",
        (
          await supabase.from("tabelas_preco").select("id").eq("representada_id", id)
        ).data?.map((x) => x.id as string) ?? []
      ),
  ]);

  const tabs = tabelas ?? [];
  const ovKey = (pid: string, tid: string) => `${pid}::${tid}`;
  const ovMap = new Map(
    (overrides ?? []).map((o) => [
      ovKey(o.produto_id as string, o.tabela_preco_id as string),
      o.preco != null ? Number(o.preco) : null,
    ])
  );

  const linhas = (produtos ?? [])
    .map((p) => {
      const bruto = p.preco_bruto != null ? Number(p.preco_bruto) : null;
      return {
        sku: p.sku as string,
        nome: p.nome as string,
        bruto,
        precos: tabs.map((t) =>
          precoLiquido(
            bruto,
            Number(t.desconto_percentual),
            ovMap.get(ovKey(p.id as string, t.id as string)) ?? null
          )
        ),
      };
    })
    .filter((l) => l.bruto != null);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {tabs.length > 3 && (
        <style dangerouslySetInnerHTML={{ __html: "@media print{@page{size:A4 landscape}}" }} />
      )}
      <div className="no-print mb-4 flex justify-end gap-2">
        <ExcelExportButton
          filename={`precos-${r.nome_fantasia || r.razao_social}`}
          sheetName={(r.nome_fantasia || r.razao_social).slice(0, 28)}
          columns={[
            "Código",
            "Produto",
            "Preço bruto",
            ...tabs.map((t) => `${t.nome} (-${Number(t.desconto_percentual)}%)`),
          ]}
          rows={linhas.map((l) => [l.sku, l.nome, l.bruto, ...l.precos])}
        />
        <PrintButton auto />
      </div>

      <div id="print-doc">
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-neutral-300 pb-4">
          <div className="flex items-start gap-3">
            {r.logo_url && (
              <Image
                src={r.logo_url}
                alt=""
                width={56}
                height={56}
                className="h-12 w-12 object-contain"
                unoptimized
              />
            )}
            <div>
              <h1 className="text-lg font-bold text-neutral-900">
                {r.nome_fantasia || r.razao_social}
              </h1>
              <p className="text-sm text-neutral-600">
                Tabela de preços {tabs.length > 1 ? "consolidada" : ""} · {linhas.length} produtos
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-neutral-500">
            Gerado em {formatDateTime(new Date())}
          </div>
        </header>

        {tabs.length === 0 ? (
          <p className="text-sm text-neutral-500">
            Esta representada não tem tabelas de preço {incluir_inativas === "1" ? "" : "ativas"}.
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-neutral-400 text-left">
                <th className="py-1.5 pr-2">Código</th>
                <th className="py-1.5 pr-2">Produto</th>
                <th className="py-1.5 pr-2 text-right">Bruto</th>
                {tabs.map((t) => (
                  <th key={t.id as string} className="py-1.5 pr-2 text-right">
                    {t.nome as string}
                    <div className="font-normal text-neutral-400">
                      -{Number(t.desconto_percentual)}%{t.ativa ? "" : " (inativa)"}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((l, i) => (
                <tr key={i} className="border-b border-neutral-200">
                  <td className="py-1 pr-2 font-mono">{l.sku}</td>
                  <td className="py-1 pr-2">{l.nome}</td>
                  <td className="py-1 pr-2 text-right text-neutral-500">
                    {l.bruto != null ? formatBRL(l.bruto) : "—"}
                  </td>
                  {l.precos.map((v, j) => (
                    <td key={j} className="py-1 pr-2 text-right font-medium">
                      {v != null ? formatBRL(v) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="mt-6 text-[11px] text-neutral-400">
          Preços sujeitos a alteração sem aviso prévio. Documento gerado pelo Sistema Comercial —
          PH Representante.
        </p>
      </div>
    </div>
  );
}
