import Link from "next/link";
import Image from "next/image";
import { Truck, ChevronRight, MapPin } from "lucide-react";
import { requireSeller } from "@/lib/sistema/seller-auth";
import { catalogoDropSeller } from "@/lib/sistema/seller-catalogo";
import SellerLocked from "@/components/drop/SellerLocked";
import { Card, CardBody } from "@/components/sistema/ui/Card";

// Sem contato (telefone/WhatsApp/e-mail) nem CNPJ aqui — a PH é
// intermediária entre seller e fábrica, contato direto quebraria esse
// papel (ver lib/sistema/seller-catalogo.ts, CatalogoDropItem).
interface FornecedorResumo {
  nome: string;
  logoUrl: string | null;
  razaoSocial: string | null;
  cidade: string | null;
  uf: string | null;
  total: number;
  anunciados: number;
}

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

  const porFornecedor = new Map<string, FornecedorResumo>();
  for (const p of catalogo) {
    const id = p.fornecedorId ?? "sem-fornecedor";
    const atual =
      porFornecedor.get(id) ??
      ({
        nome: p.fornecedorNome ?? "Sem fornecedor definido",
        logoUrl: p.fornecedorLogoUrl,
        razaoSocial: p.fornecedorRazaoSocial,
        cidade: p.fornecedorCidade,
        uf: p.fornecedorUf,
        total: 0,
        anunciados: 0,
      } satisfies FornecedorResumo);
    atual.total++;
    if (p.anuncios.length > 0) atual.anunciados++;
    porFornecedor.set(id, atual);
  }
  const fornecedores = [...porFornecedor.entries()].sort((a, b) => a[1].nome.localeCompare(b[1].nome));

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900">Produtos para Anunciar</h1>
        <p className="text-sm text-neutral-500">Escolha um fornecedor pra ver os produtos disponíveis.</p>
      </div>

      {fornecedores.length === 0 ? (
        <Card>
          <CardBody className="text-sm text-neutral-600">Nenhum produto disponível pra venda no momento.</CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {fornecedores.map(([id, f]) => (
            <Link
              key={id}
              href={`/drop/dashboard/produtos/${id}`}
              className="group flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors hover:border-brand/30 hover:shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-neutral-200 bg-white">
                    {f.logoUrl ? (
                      <Image src={f.logoUrl} alt={f.nome} width={48} height={48} className="h-full w-full object-contain p-1" unoptimized />
                    ) : (
                      <Truck size={18} className="text-neutral-300" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="line-clamp-1 text-sm font-semibold text-neutral-900">{f.nome}</p>
                    {f.razaoSocial && f.razaoSocial !== f.nome && (
                      <p className="line-clamp-1 text-xs text-neutral-400">{f.razaoSocial}</p>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} className="mt-2 shrink-0 text-neutral-300 transition-transform group-hover:translate-x-0.5" />
              </div>

              {f.cidade && (
                <p className="flex items-center gap-1.5 text-xs text-neutral-500">
                  <MapPin size={12} className="shrink-0 text-neutral-400" />
                  {f.cidade}
                  {f.uf ? `/${f.uf}` : ""}
                </p>
              )}

              <p className="mt-auto text-xs text-neutral-400">
                {f.total} produto{f.total > 1 ? "s" : ""} · {f.anunciados} já anunciado{f.anunciados !== 1 ? "s" : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
