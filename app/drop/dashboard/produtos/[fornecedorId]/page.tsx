import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import { getMlRecords } from "@/lib/sistema/ml-auth";
import SellerLocked from "@/components/drop/SellerLocked";
import SellerCatalogoDrop from "@/components/public/SellerCatalogoDrop";
import { Card, CardBody } from "@/components/sistema/ui/Card";

export default async function DropDashboardFornecedorProdutosPage({
  params,
}: {
  params: Promise<{ fornecedorId: string }>;
}) {
  const { fornecedorId } = await params;
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Produtos para Anunciar</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const [catalogo, mlContas] = await Promise.all([catalogoDropSeller(seller.id), getMlRecords(seller.id)]);
  const itens = catalogo.filter((p) => (p.fornecedorId ?? "sem-fornecedor") === fornecedorId);
  const nomeFornecedor = itens[0]?.fornecedorNome ?? "Fornecedor";

  return (
    <div className="max-w-3xl space-y-4">
      <Link href="/drop/dashboard/produtos" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand">
        <ArrowLeft size={14} /> Voltar aos fornecedores
      </Link>
      <h1 className="text-lg font-bold text-neutral-900">{nomeFornecedor}</h1>

      <Card>
        <CardBody>
          {itens.length === 0 ? (
            <p className="text-sm text-neutral-600">Nenhum produto encontrado pra esse fornecedor.</p>
          ) : (
            <SellerCatalogoDrop
              token={seller.portalToken}
              mlContas={mlContas.map((c) => ({ id: c.id, nickname: c.ml_nickname }))}
              itens={itens.map((p) => ({ ...p, precoMinimo: p.precoMinimo as number }))}
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}
