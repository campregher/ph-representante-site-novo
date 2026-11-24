import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Layers, ChevronRight } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardBody } from "@/components/sistema/ui/Card";

interface CategoriaResumo {
  categoria: string;
  imagemUrl: string | null;
  total: number;
  anunciados: number;
}

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

  const catalogo = await catalogoDropSeller(seller.id);
  const itens = catalogo.filter((p) => (p.fornecedorId ?? "sem-fornecedor") === fornecedorId);
  const nomeFornecedor = itens[0]?.fornecedorNome ?? "Fornecedor";

  const porCategoria = new Map<string, CategoriaResumo>();
  for (const p of itens) {
    const categoria = p.categoria || "Sem categoria";
    const atual = porCategoria.get(categoria) ?? { categoria, imagemUrl: null, total: 0, anunciados: 0 };
    if (!atual.imagemUrl && p.imagem_url) atual.imagemUrl = p.imagem_url;
    atual.total++;
    if (p.anuncios.length > 0) atual.anunciados++;
    porCategoria.set(categoria, atual);
  }
  const categorias = [...porCategoria.values()].sort((a, b) => {
    if (a.categoria === "Sem categoria") return 1;
    if (b.categoria === "Sem categoria") return -1;
    return a.categoria.localeCompare(b.categoria);
  });

  return (
    <div className="max-w-5xl space-y-4">
      <Link href="/drop/dashboard/produtos" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-brand">
        <ArrowLeft size={14} /> Voltar aos fornecedores
      </Link>
      <div>
        <h1 className="text-lg font-bold text-neutral-900">{nomeFornecedor}</h1>
        <p className="text-sm text-neutral-500">Escolha uma categoria para ver os produtos disponíveis.</p>
      </div>

      {categorias.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-neutral-600">Nenhum produto encontrado para esse fornecedor.</CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categorias.map((c) => (
            <Link
              key={c.categoria}
              href={`/drop/dashboard/produtos/${fornecedorId}/${encodeURIComponent(c.categoria)}`}
              className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                    {c.imagemUrl ? (
                      <Image
                        src={c.imagemUrl}
                        alt={c.categoria}
                        width={48}
                        height={48}
                        className="h-full w-full object-contain p-1"
                        unoptimized
                      />
                    ) : (
                      <Layers size={18} className="text-neutral-300" />
                    )}
                  </div>
                  <p className="line-clamp-1 text-sm font-semibold text-neutral-900">{c.categoria}</p>
                </div>
                <ChevronRight size={16} className="mt-2 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5" />
              </div>
              <p className="mt-auto text-xs text-neutral-400">
                {c.total} produto{c.total > 1 ? "s" : ""} · {c.anunciados} já anunciado{c.anunciados !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
