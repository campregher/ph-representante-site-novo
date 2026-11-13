"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Search, X, Package, FileDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";
import { getBrandBySlug } from "@/lib/brands";
import type { Product } from "@/lib/produtos";
import ProductModal from "@/components/catalog/ProductModal";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } };

export default function BrandPage({ params }: { params: Promise<{ brand: string }> }) {
  const { brand: brandSlug } = use(params);
  const brand = getBrandBySlug(brandSlug);

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Product | null>(null);
  const [imgError, setImgError] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadPDF() {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/catalogo/pdf?marca=${brandSlug}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `catalogo-${brandSlug}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  }

  useEffect(() => {
    fetch(`/api/produtos?marca=${brandSlug}`)
      .then((r) => r.json())
      .then((data) => { setProducts(data); setFiltered(data); })
      .finally(() => setLoading(false));
  }, [brandSlug]);

  useEffect(() => {
    if (!query.trim()) { setFiltered(products); return; }
    const q = query.toLowerCase();
    setFiltered(products.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)));
  }, [query, products]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/catalogo" className="text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0">
            <ArrowRight size={18} className="rotate-180" />
          </Link>
          {brand && !imgError ? (
            <div className="rounded-md bg-gray-900 px-2.5 py-1.5 flex-shrink-0">
              <Image src={brand.logo} alt={brand.name} width={100} height={36} className="object-contain h-7 w-auto" onError={() => setImgError(true)} />
            </div>
          ) : (
            <span className="font-black text-gray-900 text-sm">{brand?.name ?? brandSlug.toUpperCase()}</span>
          )}
          <div className="relative flex-1 max-w-sm ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar produto..."
              className="w-full pl-9 pr-8 py-2 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-brand transition-all"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900">
                <X size={13} />
              </button>
            )}
          </div>
          <button onClick={downloadPDF} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-900 hover:bg-gray-50 text-gray-900 text-sm font-bold uppercase tracking-wide rounded-md transition-all disabled:opacity-50 flex-shrink-0"
          >
            <FileDown size={15} className={pdfLoading ? "animate-bounce" : ""} />
            <span className="hidden sm:inline">{pdfLoading ? "Gerando..." : "Baixar PDF"}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Brand info */}
        {brand && (
          <div className="mb-8">
            <h1 className="text-2xl font-black text-gray-900 mb-1">{brand.name}</h1>
            <p className="text-gray-500 text-sm">{brand.segment}</p>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="bg-white rounded-md overflow-hidden border border-gray-200 animate-pulse">
                <div className="aspect-square bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-2 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">
              {query ? `Nenhum produto encontrado para "${query}"` : "Nenhum produto cadastrado para esta marca ainda."}
            </p>
            {query && <button onClick={() => setQuery("")} className="mt-3 text-brand hover:underline text-sm">Limpar busca</button>}
          </div>
        ) : (
          <>
            <p className="text-gray-500 text-xs mb-5">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
            <motion.div variants={container} initial="hidden" animate="show"
              className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4"
            >
              {filtered.map((p) => (
                <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
              ))}
            </motion.div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.button variants={item} onClick={onClick} whileHover={{ y: -3 }}
      className="bg-white rounded-md overflow-hidden border border-gray-200 hover:border-brand/40 hover:shadow-lg transition-all duration-300 text-left group"
    >
      <div className="relative aspect-square bg-gray-50">
        {product.images[0] && !imgError ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-contain p-2 group-hover:scale-105 transition-transform duration-300" onError={() => setImgError(true)} unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Sem imagem</div>
        )}
      </div>
      <div className="p-3">
        <span className="text-xs font-mono text-brand/70 mb-1 block">{product.sku}</span>
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{product.name}</p>
      </div>
    </motion.button>
  );
}
