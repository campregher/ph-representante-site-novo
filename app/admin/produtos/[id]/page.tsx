import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getProductById } from "@/lib/produtos";
import ProductForm from "@/components/admin/ProductForm";

export default async function EditarProdutoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) notFound();

  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/produtos" className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">Editar produto</h1>
          <p className="text-xs font-mono text-brand/60 mt-0.5">{product.sku}</p>
        </div>
      </div>
      <div className="bg-dark-800 border border-white/8 rounded-2xl p-6">
        <ProductForm product={product} />
      </div>
    </div>
  );
}
