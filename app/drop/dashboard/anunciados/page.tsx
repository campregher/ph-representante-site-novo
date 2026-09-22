import { requireSeller } from "@/lib/sistema/seller-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import { getMlRecord } from "@/lib/sistema/ml-auth";
import SellerLocked from "@/components/drop/SellerLocked";
import SellerCatalogoDrop from "@/components/public/SellerCatalogoDrop";
import { Card, CardBody } from "@/components/sistema/ui/Card";

export default async function DropDashboardAnunciadosPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Anunciados</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const [catalogo, mlRecord] = await Promise.all([catalogoDropSeller(seller.id), getMlRecord(seller.id)]);
  const anunciados = catalogo.filter((p) => p.anuncio);

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Anunciados</h1>
        <p className="text-sm text-neutral-500">Seus produtos já publicados no Mercado Livre.</p>
      </div>

      <Card>
        <CardBody>
          {anunciados.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Você ainda não anunciou nenhum produto. Vá em &quot;Produtos para Anunciar&quot; pra começar.
            </p>
          ) : (
            <SellerCatalogoDrop
              token={seller.portalToken}
              mlConectado={!!mlRecord}
              itens={anunciados.map((p) => ({ ...p, precoMinimo: p.precoMinimo as number }))}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
