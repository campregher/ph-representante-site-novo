import { requireSeller } from "@/lib/sistema/seller-auth";
import { getMlRecord } from "@/lib/sistema/ml-auth";
import SellerPortalMl from "@/components/public/SellerPortalMl";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";

export default async function DropDashboardIntegracaoPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Integração</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const mlRecord = await getMlRecord(seller.id);

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-bold text-neutral-900">Integração</h1>
      <SellerPortalMl
        token={seller.portalToken}
        conectado={!!mlRecord}
        nickname={mlRecord?.ml_nickname ?? null}
        redirectPath="/drop/dashboard/integracao"
      />
      <Card>
        <CardHeader title="Como funciona" />
        <CardBody className="space-y-2 text-sm text-neutral-600">
          <p>Conectar sua conta do Mercado Livre é obrigatório antes de anunciar qualquer produto.</p>
          <p>Depois de conectado, vá em &quot;Produtos para Anunciar&quot; para escolher o que vender.</p>
        </CardBody>
      </Card>
    </div>
  );
}
