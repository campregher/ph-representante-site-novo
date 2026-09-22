import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardBody } from "@/components/sistema/ui/Card";

export default async function DropDashboardFornecedoresPage() {
  const seller = await requireSeller();

  if (!seller.liberado) {
    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold text-neutral-900">Produtos para Anunciar</h1>
        <SellerLocked seller={seller} />
      </div>
    );
  }

  const catalogo = await catalogoDropSeller(seller.id);

  const porFornecedor = new Map<string, { nome: string; total: number; anunciados: number }>();
  for (const p of catalogo) {
    const id = p.fornecedorId ?? "sem-fornecedor";
    const nome = p.fornecedorNome ?? "Sem fornecedor definido";
    const atual = porFornecedor.get(id) ?? { nome, total: 0, anunciados: 0 };
    atual.total++;
    if (p.anuncios.length > 0) atual.anunciados++;
    porFornecedor.set(id, atual);
  }
  const fornecedores = [...porFornecedor.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome));

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Produtos para Anunciar</h1>
        <p className="text-sm text-neutral-500">Escolha um fornecedor pra ver os produtos disponíveis.</p>
      </div>

      {fornecedores.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-neutral-600">Nenhum produto disponível pra venda no momento.</CardBody>
        </Card>
      ) : (
        <div className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 bg-white">
          {fornecedores.map(([id, f]) => (
            <Link
              key={id}
              href={`/drop/dashboard/produtos/${id}`}
              className="flex items-center justify-between gap-3 px-5 py-4 hover:bg-neutral-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand/10 text-brand">
                  <Truck size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{f.nome}</p>
                  <p className="text-xs text-neutral-400">
                    {f.total} produto{f.total > 1 ? "s" : ""} · {f.anunciados} já anunciado{f.anunciados !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-neutral-300" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
