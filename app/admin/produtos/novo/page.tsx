import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import ProductForm from "@/components/admin/ProductForm";

export default function NovoProdutoPage() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/produtos" className="text-gray-500 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-black text-white">Novo produto</h1>
          <p className="text-xs text-gray-500 mt-0.5">Preencha os dados do produto</p>
        </div>
      </div>
      <div className="bg-dark-800 border border-white/8 rounded-2xl p-6">
        <ProductForm />
      </div>
    </div>
  );
}
