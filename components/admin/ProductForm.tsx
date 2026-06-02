"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import type { Product } from "@/lib/produtos";

interface Brand { slug: string; name: string; logo_url: string | null }
interface ProductFormProps { product?: Product }

const inputCls = "w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const labelCls = "block text-xs font-semibold text-gray-400 mb-1.5";

export default function ProductForm({ product }: ProductFormProps) {
  const router = useRouter();
  const isEdit = Boolean(product);

  const [brands,       setBrands]       = useState<Brand[]>([]);
  const [brandsLoading,setBrandsLoading]= useState(true);
  const [form, setForm] = useState({
    sku:         product?.sku         ?? "",
    name:        product?.name        ?? "",
    brand:       product?.brand       ?? "",
    description: product?.description ?? "",
    image1:      product?.images[0]   ?? "",
    image2:      product?.images[1]   ?? "",
    image3:      product?.images[2]   ?? "",
    active:      product?.active      ?? true,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  useEffect(() => {
    fetch("/api/admin/marcas")
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d.filter((b: Brand & { ativo: boolean }) => b.ativo) : []))
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, []);

  function set(field: keyof typeof form, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const body = {
      sku:         form.sku.trim(),
      name:        form.name.trim(),
      brand:       form.brand,
      description: form.description.trim(),
      images:      [form.image1, form.image2, form.image3].filter(Boolean),
      active:      form.active,
    };
    try {
      const url    = isEdit ? `/api/produtos/${product!.id}` : "/api/produtos";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || "Erro ao salvar produto"); }
      router.push("/admin/produtos");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar produto");
    } finally { setLoading(false); }
  }

  const selectedBrand = brands.find(b => b.slug === form.brand);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div>
          <label className={labelCls}>SKU *</label>
          <input className={inputCls} value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="ex: ATT-001" required />
        </div>

        <div>
          <label className={labelCls}>Marca *</label>
          {brandsLoading ? (
            <div className={`${inputCls} flex items-center gap-2 text-gray-600`}>
              <Loader2 size={13} className="animate-spin" /> Carregando marcas...
            </div>
          ) : (
            <div className="space-y-2">
              <select
                className={inputCls}
                value={form.brand}
                onChange={e => set("brand", e.target.value)}
                required
              >
                <option value="">Selecionar marca</option>
                {brands.map(b => (
                  <option key={b.slug} value={b.slug}>{b.name}</option>
                ))}
              </select>
              {selectedBrand && selectedBrand.logo_url && (
                <div className="flex items-center gap-2 px-3 py-2 bg-dark-950 border border-white/8 rounded-xl">
                  <Image
                    src={selectedBrand.logo_url}
                    alt={selectedBrand.name}
                    width={60} height={24}
                    className="object-contain h-5 w-auto"
                  />
                  <span className="text-xs text-gray-500">{selectedBrand.name}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Nome do produto *</label>
        <input className={inputCls} value={form.name} onChange={e => set("name", e.target.value)} placeholder="Nome completo do produto" required />
      </div>

      <div>
        <label className={labelCls}>Descrição</label>
        <textarea
          className={`${inputCls} resize-none h-24`}
          value={form.description}
          onChange={e => set("description", e.target.value)}
          placeholder="Descrição opcional do produto"
        />
      </div>

      <div className="space-y-3">
        <label className={labelCls}>Imagens (URLs)</label>
        <input className={inputCls} value={form.image1} onChange={e => set("image1", e.target.value)} placeholder="URL da imagem 1" />
        <input className={inputCls} value={form.image2} onChange={e => set("image2", e.target.value)} placeholder="URL da imagem 2 (opcional)" />
        <input className={inputCls} value={form.image3} onChange={e => set("image3", e.target.value)} placeholder="URL da imagem 3 (opcional)" />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => set("active", !form.active)}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${form.active ? "bg-brand" : "bg-dark-700"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-4" : ""}`} />
        </button>
        <span className="text-sm text-gray-300">
          {form.active ? "Produto ativo (visível no catálogo)" : "Produto inativo (oculto no catálogo)"}
        </span>
      </div>

      {error && (
        <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => router.back()}
          className="px-5 py-2.5 bg-dark-700 border border-white/10 text-gray-300 hover:text-white rounded-xl text-sm transition-all"
        >
          Cancelar
        </button>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          {loading ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar produto"}
        </button>
      </div>
    </form>
  );
}
