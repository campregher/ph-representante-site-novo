import { notFound } from "next/navigation";
import { requireRole } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import {
  listRepresentadaOptions,
  listAllCategorias,
  getProdutoVariacoes,
} from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import ProdutoForm from "@/components/sistema/produtos/ProdutoForm";
import type { VariacoesState } from "@/components/sistema/produtos/VariacoesEditor";
import type { Produto } from "@/lib/sistema/types";

export default async function EditarProdutoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "gerente");
  const { id } = await params;
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("produtos").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const produto = data as Produto;

  const [repOptions, categorias, variacoes] = await Promise.all([
    listRepresentadaOptions(),
    listAllCategorias(),
    getProdutoVariacoes(id),
  ]);

  const initialVariacoes: VariacoesState = {
    temVariacoes: produto.tem_variacoes || variacoes.length > 0,
    eixos: produto.variacao_eixos ?? [],
    variacoes: variacoes.map((v) => ({
      id: v.id,
      sku: v.sku,
      atributos: v.atributos ?? {},
      preco_bruto: v.preco_bruto != null ? String(v.preco_bruto).replace(".", ",") : "",
      imagem_url: v.imagem_url ?? "",
      codigo_fabrica: v.codigo_fabrica ?? "",
      ean: v.ean ?? "",
      ativo: v.ativo,
    })),
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={`Editar — ${produto.nome}`} />
      <ProdutoForm
        initial={produto}
        representadaOptions={repOptions}
        categorias={categorias}
        initialVariacoes={initialVariacoes}
      />
    </div>
  );
}
