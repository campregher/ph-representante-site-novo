"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Send, ShoppingBag, ExternalLink, AlertCircle, Unlink } from "lucide-react";
import Link from "next/link";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";
import CategoryPicker from "@/components/marca/CategoryPicker";
import AttributeForm from "@/components/marca/AttributeForm";
import VehicleCompatibility, { Compatibilidade } from "@/components/marca/VehicleCompatibility";
import QualityIndicator, { QualityAttr } from "@/components/marca/QualityIndicator";

interface SelectedCategory {
  id: string;
  name: string;
  path: string[];
}

interface MLAttr {
  id: string;
  name: string;
  value_type: string;
  required: boolean;
}

const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

export default function EditarProdutoPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [publishing,  setPublishing]  = useState(false);
  const [unlinking,   setUnlinking]   = useState(false);
  const [mlItemId,    setMlItemId]    = useState<string | null>(null);
  const [mlStatus,    setMlStatus]    = useState<string | null>(null);
  const [mlError,     setMlError]     = useState<string | null>(null);

  /* categoria ML */
  const [category,      setCategory]      = useState<SelectedCategory | null>(null);
  const [loadingAttrs,  setLoadingAttrs]  = useState(false);
  const [requiredAttrs, setRequiredAttrs] = useState<QualityAttr[]>([]);
  const [optionalAttrs, setOptionalAttrs] = useState<QualityAttr[]>([]);

  /* campos */
  const [attributes,       setAttributes]       = useState<Record<string, string>>({});
  const [compatibilidades, setCompatibilidades] = useState<Compatibilidade[]>([]);
  const [sku,          setSku]          = useState("");
  const [name,         setName]         = useState("");
  const [description,  setDescription]  = useState("");
  const [price,        setPrice]        = useState("");
  const [resalePrice,  setResalePrice]  = useState("");
  const [condition,    setCondition]    = useState("new");
  const [images,       setImages]       = useState(["", "", "", "", ""]);
  const [active,       setActive]       = useState(true);

  useEffect(() => {
    fetch(`/api/marca/produtos/${id}`)
      .then(r => r.json())
      .then(p => {
        setSku(p.sku ?? "");
        setName(p.name ?? "");
        setDescription(p.description ?? "");
        setPrice(p.price != null ? String(p.price) : "");
        setResalePrice(p.resale_price != null ? String(p.resale_price) : "");
        setCondition(p.condition ?? "new");
        setImages([p.images?.[0] ?? "", p.images?.[1] ?? "", p.images?.[2] ?? "", p.images?.[3] ?? "", p.images?.[4] ?? ""]);
        setActive(p.active !== false);
        setAttributes(p.attributes ?? {});
        setCompatibilidades(p.compatibilidades ?? []);
        if (p.ml_category_id) {
          setCategory({ id: p.ml_category_id, name: p.ml_category_name ?? "", path: p.ml_category_path ?? [] });
          setLoadingAttrs(true);
        }
        if (p.ml_item_id) setMlItemId(p.ml_item_id);
        if (p.ml_status)  setMlStatus(p.ml_status);
      })
      .catch(() => toast.error("Erro ao carregar produto"))
      .finally(() => setLoading(false));
  }, [id]);

  function setImage(i: number, val: string) {
    setImages(prev => prev.map((v, idx) => (idx === i ? val : v)));
  }

  const handleCategoryChange = useCallback((cat: SelectedCategory) => {
    setCategory(cat.id ? cat : null);
    setAttributes({});
    setRequiredAttrs([]);
    setOptionalAttrs([]);
    if (cat.id) setLoadingAttrs(true);
  }, []);

  function handleAttrsLoaded(attrs: MLAttr[]) {
    setRequiredAttrs(attrs.filter(a => a.required).map(a => ({ id: a.id, name: a.name, required: true })));
    setOptionalAttrs(attrs.filter(a => !a.required).map(a => ({ id: a.id, name: a.name, required: false })));
    setLoadingAttrs(false);
  }

  async function handlePublish() {
    setPublishing(true);
    setMlError(null);
    try {
      const res  = await fetch(`/api/marca/produtos/${id}/ml-publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMlItemId(data.ml_item_id);
      setMlStatus(data.ml_status);
      toast.success("Anúncio publicado no Mercado Livre!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao publicar";
      setMlError(msg);
      toast.error(msg);
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnlink() {
    if (!confirm("Desvincular este anúncio do produto? O anúncio no Mercado Livre não será afetado.")) return;
    setUnlinking(true);
    try {
      const res = await fetch(`/api/marca/produtos/${id}/ml-unlink`, { method: "POST" });
      if (!res.ok) throw new Error("Erro ao desvincular");
      setMlItemId(null);
      setMlStatus(null);
      setMlError(null);
      toast.success("Anúncio desvinculado.");
    } catch {
      toast.error("Erro ao desvincular anúncio");
    } finally {
      setUnlinking(false);
    }
  }

  async function handleSave() {
    if (!sku.trim())         { toast.error("SKU obrigatório"); return; }
    if (!name.trim())        { toast.error("Nome obrigatório"); return; }
    if (!resalePrice.trim()) { toast.error("Preço de revenda obrigatório"); return; }

    setSaving(true);
    try {
      const body = {
        sku:              sku.trim(),
        name:             name.trim(),
        description:      description.trim(),
        price:            price       ? Number(price.replace(",", "."))       : null,
        resale_price:     resalePrice ? Number(resalePrice.replace(",", ".")) : null,
        condition,
        images:           images.filter(Boolean),
        active,
        ml_category_id:   category?.id   ?? null,
        ml_category_name: category?.name ?? null,
        ml_category_path: category?.path ?? null,
        attributes,
        compatibilidades,
      };

      const res  = await fetch(`/api/marca/produtos/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Produto atualizado!");
      router.push("/marca/produtos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-500" />
      </div>
    );
  }

  const filledImages = images.filter(Boolean);

  return (
    <div className="min-h-screen">
      <MarcaContentHeader
        title="Editar produto"
        actions={
          <Link
            href="/marca/produtos"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-white/10 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
          >
            <ArrowLeft size={12} /> Voltar
          </Link>
        }
      />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Coluna do formulário ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Categoria ML */}
            <section className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white mb-0.5">Categoria Mercado Livre</h2>
                <p className="text-xs text-gray-500">Selecione a categoria para carregar os atributos corretos</p>
              </div>
              <CategoryPicker selected={category} onSelect={handleCategoryChange} />
            </section>

            {/* Informações do produto */}
            <section className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Informações do produto</h2>

              <div>
                <label className={lbl}>
                  Nome / Título *
                  <span className={`ml-2 font-normal ${name.length >= 40 && name.length <= 60 ? "text-green-400" : name.length > 0 ? "text-yellow-400" : "text-gray-600"}`}>
                    ({name.length} chars — ideal 40-60)
                  </span>
                </label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Tapete Automotivo Universal 5 peças Preto"
                  className={inp}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={lbl}>SKU *</label>
                  <input value={sku} onChange={e => setSku(e.target.value)} placeholder="Ex: TAP-001" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Preço de custo (R$)</label>
                  <input value={price} onChange={e => setPrice(e.target.value)} placeholder="99.90" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Preço de revenda (R$) *</label>
                  <input value={resalePrice} onChange={e => setResalePrice(e.target.value)} placeholder="149.90" className={inp} />
                </div>
              </div>

              <div>
                <label className={lbl}>
                  Descrição
                  <span className={`ml-2 font-normal ${description.length >= 200 ? "text-green-400" : description.length > 50 ? "text-yellow-400" : "text-gray-600"}`}>
                    ({description.length} chars — ideal 200+)
                  </span>
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Descrição detalhada do produto..."
                  rows={4}
                  className={`${inp} resize-none`}
                />
              </div>

              <div>
                <label className={lbl}>
                  Fotos (URLs)
                  <span className={`ml-2 font-normal ${filledImages.length >= 3 ? "text-green-400" : filledImages.length >= 1 ? "text-yellow-400" : "text-gray-600"}`}>
                    ({filledImages.length}/3 — ideal 3+)
                  </span>
                </label>
                <div className="space-y-2">
                  {images.map((url, i) => (
                    <input
                      key={i}
                      value={url}
                      onChange={e => setImage(i, e.target.value)}
                      placeholder={i === 0 ? "URL da imagem principal" : `URL da imagem ${i + 1} (opcional)`}
                      className={inp}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className={lbl}>Condição *</label>
                <select value={condition} onChange={e => setCondition(e.target.value)} className={inp}>
                  <option value="new">Novo</option>
                  <option value="used">Usado</option>
                </select>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActive(v => !v)}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${active ? "bg-brand" : "bg-dark-600 border border-white/10"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${active ? "translate-x-4" : ""}`} />
                </button>
                <span className="text-sm text-gray-300 cursor-pointer select-none" onClick={() => setActive(v => !v)}>
                  {active ? "Produto ativo (visível no catálogo)" : "Produto inativo (oculto)"}
                </span>
              </div>
            </section>

            {/* Compatibilidade veicular */}
            <section className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white mb-0.5">Compatibilidade veicular</h2>
                <p className="text-xs text-gray-500">Deixe vazio se o produto for universal.</p>
              </div>
              <VehicleCompatibility value={compatibilidades} onChange={setCompatibilidades} />
            </section>

            {/* Atributos ML / Ficha técnica */}
            {category?.id && (
              <section className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white mb-0.5">Características do produto</h2>
                  <p className="text-xs text-gray-500">
                    Atributos da categoria <span className="text-white">{category.name}</span>
                  </p>
                </div>
                <AttributeForm
                  categoryId={category.id}
                  values={attributes}
                  onChange={setAttributes}
                  onLoad={handleAttrsLoaded}
                />
              </section>
            )}

            {/* Mercado Livre */}
            <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={14} className={mlItemId ? "text-yellow-400" : "text-gray-600"} />
                  <p className="text-sm font-bold text-white">Mercado Livre</p>
                </div>
                {mlItemId ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://www.mercadolivre.com.br/anuncio/${mlItemId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-yellow-400/15 text-yellow-400 hover:bg-yellow-400/25 transition-colors"
                    >
                      Ver anúncio <ExternalLink size={11} />
                    </a>
                    <button
                      onClick={handleUnlink}
                      disabled={unlinking}
                      className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/5 text-gray-400 hover:bg-red-400/10 hover:text-red-400 border border-white/8 hover:border-red-400/20 transition-all disabled:opacity-40"
                    >
                      {unlinking ? <Loader2 size={11} className="animate-spin" /> : <Unlink size={11} />}
                      Desvincular
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handlePublish}
                    disabled={publishing || !category?.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-400 font-bold text-sm rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {publishing
                      ? <><Loader2 size={13} className="animate-spin" /> Publicando...</>
                      : <><Send size={13} /> Publicar no ML</>
                    }
                  </button>
                )}
              </div>

              {mlItemId && (
                <div className="text-xs text-gray-500 flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mlStatus === "active" ? "bg-green-400" : "bg-red-400"}`} />
                  ID: <span className="font-mono text-gray-300">{mlItemId}</span>
                  <span className="text-gray-600">·</span>
                  <span className={mlStatus === "active" ? "text-green-400 font-semibold" : "text-red-400 font-semibold"}>
                    {mlStatus === "active" ? "Ativo" : mlStatus ?? "Inativo"}
                  </span>
                </div>
              )}

              {mlError && (
                <div className="flex items-start gap-2 p-3 bg-red-400/8 border border-red-400/20 rounded-xl">
                  <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-300">{mlError}</p>
                </div>
              )}

              {!mlItemId && !mlError && (
                <p className="text-xs text-gray-600">
                  {category?.id ? "Salve o produto e clique em Publicar para enviar ao ML." : "Vincule uma categoria ML para habilitar a publicação."}
                </p>
              )}
            </div>

            {/* Botões */}
            <div className="flex gap-3 pb-8">
              <Link
                href="/marca/produtos"
                className="flex-1 py-3 bg-dark-700 border border-white/10 text-gray-300 hover:text-white rounded-xl text-sm font-semibold text-center transition-all"
              >
                Cancelar
              </Link>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {saving
                  ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
                  : <><Save size={14} /> Salvar alterações</>
                }
              </button>
            </div>
          </div>

          {/* ── Sidebar de qualidade (sticky) ── */}
          <div className="w-72 flex-shrink-0 hidden lg:block">
            <div className="sticky top-[80px] space-y-0">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3 px-1">
                Qualidade do anúncio
              </p>
              <QualityIndicator
                name={name}
                sku={sku}
                price={resalePrice}
                description={description}
                images={images}
                condition={condition}
                attrValues={attributes}
                requiredAttrs={requiredAttrs}
                optionalAttrs={optionalAttrs}
                compatibilidades={compatibilidades}
                loadingAttrs={loadingAttrs}
              />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
