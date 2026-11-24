"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ArrowRight, BookOpen, FileDown } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { brands } from "@/lib/brands";
import type { Product } from "@/lib/produtos";
import ProductModal from "@/components/catalog/ProductModal";

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };

function BrandCard({ brand }: { brand: (typeof brands)[0] }) {
  const [imgError, setImgError] = useState(false);
  return (
    <motion.div variants={item} whileHover={{ y: -4 }}>
      <Link href={`/catalogo/${brand.slug}`}
        className="group flex flex-col items-center bg-white rounded-md p-6 border border-gray-200 hover:border-brand/40 hover:shadow-lg transition-all duration-300 cursor-pointer"
      >
        <div className="w-full h-20 flex items-center justify-center mb-4 rounded-md bg-gray-900 overflow-hidden">
          {imgError ? (
            <span className="font-black text-white text-sm text-center">{brand.name}</span>
          ) : (
            <Image src={brand.logo} alt={brand.name} width={160} height={80} className="object-contain max-h-16 w-auto" onError={() => setImgError(true)} />
          )}
        </div>
        <p className="text-xs text-gray-500 text-center mb-3 font-medium uppercase tracking-wide">{brand.segment}</p>
        <span className="inline-flex items-center gap-1 text-xs text-brand font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
          Ver produtos <ArrowRight size={12} />
        </span>
      </Link>
    </motion.div>
  );
}

export default function CatalogoPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  async function downloadPDF() {
    setPdfLoading(true);
    try {
      const res = await fetch("/api/catalogo/pdf");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "catalogo-ph-representante.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfLoading(false);
    }
  }

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/produtos?q=${encodeURIComponent(q)}`);
      setResults(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 350);
    return () => clearTimeout(timeout);
  }, [query, search]);

  const showBrands = !query.trim();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-16 lg:top-[99px] z-30 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-4">
          <Link href="/" className="text-gray-500 hover:text-gray-900 transition-colors flex-shrink-0">
            <ArrowRight size={18} className="rotate-180" />
          </Link>
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por SKU ou nome do produto..."
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-300 rounded-md text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-900">
                <X size={14} />
              </button>
            )}
          </div>
          <button onClick={downloadPDF} disabled={pdfLoading}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-900 hover:bg-gray-50 text-gray-900 text-sm font-bold uppercase tracking-wide rounded-md transition-all disabled:opacity-50 flex-shrink-0"
          >
            <FileDown size={15} className={pdfLoading ? "animate-bounce" : ""} />
            <span className="hidden sm:inline">{pdfLoading ? "Gerando..." : "Baixar PDF"}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          {showBrands ? (
            <motion.div key="brands" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-md mb-4">
                  <BookOpen size={14} /> Catálogo Online
                </span>
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
                  Escolha uma <span className="text-brand">marca</span>
                </h1>
                <p className="text-gray-600">Selecione a marca ou use a busca acima para encontrar um produto específico.</p>
              </div>
              <motion.div variants={container} initial="hidden" animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
              >
                {brands.map((brand) => <BrandCard key={brand.slug} brand={brand} />)}
              </motion.div>
            </motion.div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-md overflow-hidden border border-gray-200 animate-pulse">
                      <div className="aspect-square bg-gray-100" />
                      <div className="p-4 space-y-2">
                        <div className="h-3 bg-gray-100 rounded w-1/3" />
                        <div className="h-3 bg-gray-100 rounded w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-gray-500 text-lg">Nenhum produto encontrado para &ldquo;{query}&rdquo;</p>
                  <button onClick={() => setQuery("")} className="mt-4 text-brand hover:underline text-sm">Limpar busca</button>
                </div>
              ) : (
                <>
                  <p className="text-gray-500 text-sm mb-6">{results.length} produto{results.length !== 1 ? "s" : ""} encontrado{results.length !== 1 ? "s" : ""}</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {results.map((p) => (
                      <ProductCard key={p.id} product={p} onClick={() => setSelected(p)} />
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}

function ProductCard({ product, onClick }: { product: Product; onClick: () => void }) {
  const brand = brands.find((b) => b.slug === product.brand);
  const [imgError, setImgError] = useState(false);
  return (
    <motion.button onClick={onClick} whileHover={{ y: -3 }}
      className="bg-white rounded-md overflow-hidden border border-gray-200 hover:border-brand/40 hover:shadow-lg transition-all duration-300 text-left group"
    >
      <div className="relative aspect-square bg-gray-50">
        {product.images[0] && !imgError ? (
          <Image src={product.images[0]} alt={product.name} fill className="object-contain p-2" onError={() => setImgError(true)} unoptimized />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">Sem imagem</div>
        )}
      </div>
      <div className="p-3">
        <span className="text-xs font-mono text-brand/70 mb-1 block">{product.sku}</span>
        <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 mb-2">{product.name}</p>
        {brand && (
          <div className="flex items-center gap-1.5 rounded bg-gray-900 px-1.5 py-1 w-fit">
            <Image src={brand.logo} alt={brand.name} width={40} height={16} className="object-contain h-4 w-auto" unoptimized />
          </div>
        )}
      </div>
    </motion.button>
  );
}
