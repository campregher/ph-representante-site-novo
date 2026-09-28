import { requireRole } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { fornecedorOptions } from "@/lib/sistema/estoque";
import { getAdminMlRecord } from "@/lib/sistema/ml-admin-auth";
import { listarAnunciosEmpresaML } from "@/lib/sistema/ml-admin-catalogo";
import { PageHeader } from "@/components/sistema/ui/State";
import { Card, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import ImportarProdutosMlForm from "@/components/sistema/estoque/ImportarProdutosMlForm";
import AnunciosImportadosList from "@/components/sistema/estoque/AnunciosImportadosList";
import ImportarMlTabs from "@/components/sistema/estoque/ImportarMlTabs";
import SincronizarMlButton from "@/components/sistema/estoque/SincronizarMlButton";
import { ShoppingBag } from "lucide-react";

export default async function ImportarProdutosMlPage() {
  await requireRole("admin", "gerente");

  const conta = await getAdminMlRecord();

  if (!conta) {
    return (
      <div>
        <PageHeader title="Importar do Mercado Livre" description="Puxe os anúncios da conta do Mercado Livre da PH pra virar produto da linha própria." />
        <Card>
          <CardBody className="flex flex-col items-center gap-3 py-10 text-center">
            <ShoppingBag size={28} className="text-neutral-400" />
            <p className="text-sm text-neutral-600">
              Conecte a conta do Mercado Livre da empresa pra ver os anúncios disponíveis pra importar.
            </p>
            <a href="/api/sistema/ml/connect">
              <Button size="sm">Conectar Mercado Livre</Button>
            </a>
          </CardBody>
        </Card>
      </div>
    );
  }

  const supabase = await createSistemaClient();
  const [anuncios, { data: produtosImportados }, fornecedores] = await Promise.all([
    listarAnunciosEmpresaML(),
    supabase
      .from("produtos")
      .select("id, sku, nome, imagem_url, preco_bruto, estoque_atual, ativo, ml_item_id")
      .not("ml_item_id", "is", null),
    fornecedorOptions(),
  ]);

  const anuncioPorId = new Map(anuncios.map((a) => [a.mlItemId, a]));
  const idsImportados = new Set((produtosImportados ?? []).map((p) => p.ml_item_id as string));
  const disponiveis = anuncios.filter((a) => !idsImportados.has(a.mlItemId));

  const importados = (produtosImportados ?? []).map((p) => {
    const anuncio = anuncioPorId.get(p.ml_item_id as string) ?? null;
    return {
      produtoId: p.id as string,
      sku: p.sku as string,
      nome: p.nome as string,
      imagemUrl: p.imagem_url as string | null,
      precoBruto: p.preco_bruto as number | null,
      estoqueAtual: p.estoque_atual as number,
      ativo: !!p.ativo,
      mlItemId: p.ml_item_id as string,
      anuncio: anuncio
        ? { titulo: anuncio.titulo, preco: anuncio.preco, status: anuncio.status, permalink: anuncio.permalink }
        : null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Importar do Mercado Livre"
        description={`Conectado como ${conta.ml_nickname ?? conta.ml_user_id}. ${disponiveis.length} anúncio(s) disponível(is) · ${importados.length} já importado(s).`}
        action={<SincronizarMlButton />}
      />
      <Card>
        <CardBody>
          <ImportarMlTabs
            disponiveisLabel={`Disponíveis (${disponiveis.length})`}
            importadosLabel={`Já importados (${importados.length})`}
            disponiveis={
              <ImportarProdutosMlForm
                itens={disponiveis.map((a) => ({
                  mlItemId: a.mlItemId,
                  titulo: a.titulo,
                  preco: a.preco,
                  imagemUrl: a.imagemUrl,
                  categoryId: a.categoryId,
                  categoryNome: a.categoryNome,
                  marca: a.marca,
                  quantidadeDisponivel: a.quantidadeDisponivel,
                  status: a.status,
                  listingTypeId: a.listingTypeId,
                  logisticType: a.logisticType,
                  vendidos: a.vendidos,
                  ean: a.ean,
                  pesoKg: a.pesoKg,
                  alturaCm: a.alturaCm,
                  larguraCm: a.larguraCm,
                  comprimentoCm: a.comprimentoCm,
                  skuVendedor: a.skuVendedor,
                  imagens: a.imagens,
                }))}
                fornecedores={fornecedores}
              />
            }
            importados={<AnunciosImportadosList itens={importados} />}
          />
        </CardBody>
      </Card>
    </div>
  );
}
