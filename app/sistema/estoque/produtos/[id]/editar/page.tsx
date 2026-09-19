import { notFound } from "next/navigation";
import { requireRole } from "@/lib/sistema/auth";
import { fornecedorOptions, categoriaLinhaPropriaOptions, getProdutoProprio } from "@/lib/sistema/estoque";
import { PageHeader } from "@/components/sistema/ui/State";
import ProdutoProprioForm from "@/components/sistema/estoque/ProdutoProprioForm";

export default async function EditarProdutoProprioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("admin", "gerente");
  const { id } = await params;
  const [fornecedores, categorias, p] = await Promise.all([
    fornecedorOptions(),
    categoriaLinhaPropriaOptions(),
    getProdutoProprio(id),
  ]);
  if (!p) notFound();
  const pr = p as Record<string, unknown>;
  const s = (v: unknown) => (v == null ? "" : String(v));

  return (
    <div>
      <PageHeader title={`Editar — ${pr.nome as string}`} description={`Estoque atual: ${pr.estoque_atual}`} />
      <ProdutoProprioForm
        fornecedores={fornecedores}
        categorias={categorias}
        produtoId={id}
        initial={{
          sku: s(pr.sku), nome: s(pr.nome), descricao: s(pr.descricao), marca: s(pr.marca),
          fornecedor_id: s(pr.fornecedor_id), categoria_id: s(pr.categoria_id), ncm: s(pr.ncm), ean: s(pr.ean),
          unidade: s(pr.unidade) || "UN", imagem_url: s(pr.imagem_url),
          custo: s(pr.custo), preco_bruto: s(pr.preco_bruto),
          margem_minima_percentual: s(pr.margem_minima_percentual),
          ml_category_id: s(pr.ml_category_id), ml_category_nome: s(pr.ml_category_nome),
          estoque_minimo: s(pr.estoque_minimo),
          peso: s(pr.peso), altura: s(pr.altura), largura: s(pr.largura), comprimento: s(pr.comprimento),
          ativo: pr.ativo !== false, observacoes: s(pr.observacoes),
        }}
      />
    </div>
  );
}
