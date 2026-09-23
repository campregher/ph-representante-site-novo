import { requireRole } from "@/lib/sistema/auth";
import { createSistemaClient } from "@/lib/supabase/server";
import { fornecedorOptions } from "@/lib/sistema/estoque";
import { getAdminMlRecord } from "@/lib/sistema/ml-admin-auth";
import { listarAnunciosEmpresaML } from "@/lib/sistema/ml-admin-catalogo";
import { PageHeader } from "@/components/sistema/ui/State";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import ImportarProdutosMlForm from "@/components/sistema/estoque/ImportarProdutosMlForm";
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
  const [anuncios, { data: jaImportados }, fornecedores] = await Promise.all([
    listarAnunciosEmpresaML(),
    supabase.from("produtos").select("ml_item_id").not("ml_item_id", "is", null),
    fornecedorOptions(),
  ]);

  const idsImportados = new Set((jaImportados ?? []).map((p) => p.ml_item_id as string));
  const disponiveis = anuncios.filter((a) => !idsImportados.has(a.mlItemId));

  return (
    <div>
      <PageHeader
        title="Importar do Mercado Livre"
        description={`Conectado como ${conta.ml_nickname ?? conta.ml_user_id}. ${disponiveis.length} anúncio(s) disponível(is) (${idsImportados.size} já importado(s) ocultados).`}
        action={<SincronizarMlButton />}
      />
      <Card>
        <CardHeader title="Anúncios" description="Ativos e pausados. Selecione os que quer trazer pra linha própria — ajuste o SKU antes de importar." />
        <CardBody>
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
            }))}
            fornecedores={fornecedores}
          />
        </CardBody>
      </Card>
    </div>
  );
}
