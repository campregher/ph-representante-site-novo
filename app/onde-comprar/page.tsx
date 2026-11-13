"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, ExternalLink, MapPin, PackageSearch } from "lucide-react";
import Image from "next/image";
import type { OndeComprarProduto } from "@/lib/public/onde-comprar";

export default function OndeComprarPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OndeComprarProduto[]>([]);
  const [loading, setLoading] = useState(false);
  const [buscou, setBuscou] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setBuscou(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/onde-comprar?q=${encodeURIComponent(q)}`);
      setResults(await res.json());
    } finally {
      setLoading(false);
      setBuscou(true);
    }
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => search(query), 350);
    return () => clearTimeout(timeout);
  }, [query, search]);

  return (
    <div className="min-h-screen bg-white">
      <div className="bg-white border-b border-gray-200 sticky top-16 lg:top-[99px] z-30 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="relative">
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
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {!buscou && !loading ? (
          <div className="text-center mb-4">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-brand bg-brand/10 border border-brand/25 rounded-md mb-4">
              <MapPin size={14} /> Onde Comprar
            </span>
            <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
              Encontre onde <span className="text-brand">comprar</span>
            </h1>
            <p className="text-gray-600">Busque um produto e veja quais lojas vendem ele no Mercado Livre.</p>
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 rounded-md border border-gray-200 p-4 animate-pulse">
                  <div className="h-16 w-16 shrink-0 rounded-md bg-gray-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : buscou && results.length === 0 ? (
            <div className="text-center py-16">
              <PackageSearch size={36} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-lg">Nenhum produto encontrado para &ldquo;{query}&rdquo;</p>
            </div>
          ) : (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              {results.map((p) => (
                <div key={p.id} className="rounded-md border border-gray-200 p-4">
                  <div className="flex gap-4">
                    <div className="relative h-16 w-16 shrink-0 rounded-md bg-gray-50 overflow-hidden">
                      {p.imagem_url ? (
                        <Image src={p.imagem_url} alt={p.nome} fill className="object-contain p-1" unoptimized />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center text-gray-300 text-[10px]">Sem foto</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono text-brand/70 block">{p.sku}</span>
                      <p className="font-semibold text-gray-900 leading-snug">{p.nome}</p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-100">
                    {p.vendedores.length === 0 ? (
                      <p className="text-sm text-gray-400">Nenhum seller está vendendo esse produto ainda — volte em breve.</p>
                    ) : (
                      <div className="space-y-1.5">
                        {p.vendedores.map((v, i) => (
                          <a
                            key={i}
                            href={v.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
                          >
                            <span className="text-gray-700 font-medium truncate">{v.nome}</span>
                            <span className="flex items-center gap-1 text-brand font-semibold shrink-0">
                              Comprar no Mercado Livre <ExternalLink size={13} />
                            </span>
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
