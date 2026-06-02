"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Search, X, Trash2, Pencil, Package, Upload, RefreshCw } from "lucide-react";
import type { Product } from "@/lib/produtos";

interface Brand { slug: string; name: string; logo_url: string | null }

export default function AdminProdutosPage() {
  const [products,   setProducts]   = useState<Product[]>([]);
  const [filtered,   setFiltered]   = useState<Product[]>([]);
  const [brands,     setBrands]     = useState<Brand[]>([]);
  const [loadError,  setLoadError]  = useState("");
  const [query,      setQuery]      = useState("");
  const [brandFilter,setBrandFilter]= useState("");
  const [loading,    setLoading]    = useState(true);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [deleting,   setDeleting]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await fetch("/api/produtos?admin=1");
      const data = await res.json();
      if (!Array.isArray(data)) {
        setLoadError(data?.error ?? "Erro ao carregar produtos");
        setProducts([]);
        setFiltered([]);
      } else {
        setProducts(data);
        setFiltered(data);
      }
    } catch {
      setLoadError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    fetch("/api/admin/marcas")
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    let list = products;
    if (brandFilter) list = list.filter((p) => p.brand === brandFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    setFiltered(list);
    setSelected(new Set());
  }, [query, brandFilter, products]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  }

  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`Excluir ${selected.size} produto${selected.size > 1 ? "s" : ""}? Esta ação não pode ser desfeita.`)) return;
    setDeleting(true);
    try {
      const results = await Promise.all(
        [...selected].map((id) => fetch(`/api/produtos/${id}`, { method: "DELETE" }).then((r) => r.json()))
      );
      const errors = results.filter((r) => r.error);
      if (errors.length) setLoadError(`Erro ao excluir: ${errors[0].error}`);
      await load();
    } finally {
      setDeleting(false);
    }
  }

  async function deleteSingle(id: string, name: string) {
    if (!confirm(`Excluir "${name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/produtos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) { setLoadError(`Erro ao excluir: ${data.error}`); return; }
      await load();
    } finally {
      setDeleting(false);
    }
  }

  const getBrand = (slug: string) => brands.find((b) => b.slug === slug);

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div>
          <h1 className="text-xl font-black text-white">Produtos</h1>
          <p className="text-xs text-gray-500 mt-0.5">{products.length} cadastrado{products.length !== 1 ? "s" : ""}</p>
        </div>
        <div className="ml-auto flex gap-2">
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          ><RefreshCw size={15} className={loading ? "animate-spin" : ""} /></button>
          <Link href="/admin/produtos/import"
            className="flex items-center gap-1.5 px-3 py-2 text-sm bg-dark-800 border border-white/10 text-gray-300 hover:text-white rounded-xl transition-all"
          ><Upload size={14} /> Importar CSV</Link>
          <Link href="/admin/produtos/novo"
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all"
          ><Plus size={14} /> Novo produto</Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome ou SKU..."
            className="w-full pl-8 pr-8 py-2 bg-dark-800 border border-white/8 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/40 transition-all"
          />
          {query && <button onClick={() => setQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"><X size={12} /></button>}
        </div>
        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
          className="px-3 py-2 bg-dark-800 border border-white/8 rounded-xl text-gray-300 text-sm focus:outline-none focus:border-brand/40 transition-all"
        >
          <option value="">Todas as marcas</option>
          {brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
        </select>
        {selected.size > 0 && (
          <button onClick={deleteSelected} disabled={deleting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl hover:bg-red-400/20 transition-all disabled:opacity-50"
          ><Trash2 size={13} /> Excluir {selected.size} selecionado{selected.size > 1 ? "s" : ""}</button>
        )}
      </div>

      {loadError && (
        <div className="mb-4 px-4 py-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-sm">
          Erro: {loadError}. Verifique se a aba &quot;Produtos&quot; existe na planilha do Google Sheets.
        </div>
      )}

      {/* Table */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Carregando produtos...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Package size={36} className="text-gray-700 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              {query || brandFilter ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left">
                <th className="pl-4 py-3 w-8">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll} className="accent-brand" />
                </th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Produto</th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Marca</th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Status</th>
                <th className="py-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p, idx) => {
                const brand = getBrand(p.brand);
                return (
                  <tr key={p.id} className={`border-b border-white/5 hover:bg-white/3 transition-colors ${idx === filtered.length - 1 ? "border-b-0" : ""}`}>
                    <td className="pl-4 py-3">
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="accent-brand" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        {p.images[0] ? (
                          <div className="w-10 h-10 rounded-lg bg-dark-900 overflow-hidden flex-shrink-0">
                            <Image src={p.images[0]} alt={p.name} width={40} height={40} className="object-contain w-full h-full" unoptimized />
                          </div>
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-dark-900 flex items-center justify-center flex-shrink-0">
                            <Package size={16} className="text-gray-700" />
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium leading-snug line-clamp-1">{p.name}</p>
                          <p className="text-xs font-mono text-brand/60">{p.sku}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell">
                      <span className="text-xs text-gray-400">{brand?.name ?? p.brand}</span>
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${p.active ? "bg-green-500/15 text-green-400" : "bg-gray-700/50 text-gray-500"}`}>
                        {p.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/admin/produtos/${p.id}`}
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                        ><Pencil size={14} /></Link>
                        <button onClick={() => deleteSingle(p.id, p.name)} disabled={deleting}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50"
                        ><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
