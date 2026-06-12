"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Package, Tag, ShoppingBag, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";
import CategoryPicker from "@/components/marca/CategoryPicker";
import AttributeForm from "@/components/marca/AttributeForm";
import VehicleCompatibility, { Compatibilidade } from "@/components/marca/VehicleCompatibility";
import QualityIndicator, { QualityAttr } from "@/components/marca/QualityIndicator";

/* ─── types ──────────────────────────────────────── */

interface SelectedCategory {
  id: string;
  name: string;
  path: string[];
}

interface SiteCategoria {
  id: string;
  nome: string;
  ml_category_id: string | null;
  ml_category_name: string | null;
  ml_category_path: string[] | null;
}

interface MLAttr {
  id: string;
  name: string;
  value_type: string;
  required: boolean;
}

/* ─── helpers ─────────────────────────────────────── */

const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

/* ─── formulário principal ───────────────────────── */

function NovoProdutoForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const categoriaId  = searchParams.get("categoria");

  /* contexto de categoria do site */
  const [siteCategoria,  setSiteCategoria]  = useState<SiteCategoria | null>(null);
  const [loadingCat,     setLoadingCat]     = useState(false);

  /* categoria ML selecionada */
  const [category,       setCategory]       = useState<SelectedCategory | null>(null);

  /* atributos ML (carregados pelo AttributeForm, compartilhados com QualityIndicator) */
  const [loadingAttrs,   setLoadingAttrs]   = useState(false);
  const [requiredAttrs,  setRequiredAttrs]  = useState<QualityAttr[]>([]);
  const [optionalAttrs,  setOptionalAttrs]  = useState<QualityAttr[]>([]);

  /* campos do formulário */
  const [attributes,       setAttributes]       = useState<Record<string, string>>({});
  const [compatibilidades, setCompatibilidades]  = useState<Compatibilidade[]>([]);
  const [sku,              setSku]              = useState("");
  const [name,             setName]             = useState("");
  const [description,      setDescription]      = useState("");
  const [price,            setPrice]            = useState("");
  const [resalePrice,      setResalePrice]      = useState("");
  const [condition,        setCondition]        = useState("new");
  const [images,           setImages]           = useState(["", "", "", "", ""]);
  const [active,           setActive]           = useState(true);
  const [saving,           setSaving]           = useState(false);

  /* carrega categoria do site se vier da URL */
  useEffect(() => {
    if (!categoriaId) return;
    setLoadingCat(true);
    fetch(`/api/marca/categorias/${categoriaId}`)
      .then(r => r.json())
      .then((cat: SiteCategoria) => {
        if (cat.id) {
          setSiteCategoria(cat);
          if (cat.ml_category_id) {
            setCategory({
              id:   cat.ml_category_id,
              name: cat.ml_category_name ?? cat.nome,
              path: cat.ml_category_path ?? [],
            });
            setLoadingAttrs(true);
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCat(false));
  }, [categoriaId]);

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

  /* callback quando AttributeForm carrega os atributos */
  function handleAttrsLoaded(attrs: MLAttr[]) {
    setRequiredAttrs(attrs.filter(a => a.required).map(a => ({ id: a.id, name: a.name, required: true })));
    setOptionalAttrs(attrs.filter(a => !a.required).map(a => ({ id: a.id, name: a.name, required: false })));
    setLoadingAttrs(false);
  }

  const backUrl = categoriaId
    ? `/marca/produtos/categoria/${categoriaId}`
    : "/marca/produtos";

  async function handleSave() {
    if (!sku.trim())         { toast.error("SKU obrigatório"); return; }
    if (!name.trim())        { toast.error("Nome obrigatório"); return; }
    if (!resalePrice.trim()) { toast.error("Preço de revenda obrigatório"); return; }
    if (!category?.id)       { toast.error("Selecione uma categoria do Mercado Livre"); return; }

    setSaving(true);
    try {
      const body = {
        sku:              sku.trim(),
        name:             name.trim(),
        description:      description.trim(),
        price:            price       ? Number(price.replace(",", "."))       : undefined,
        resale_price:     resalePrice ? Number(resalePrice.replace(",", ".")) : undefined,
        images:           images.filter(Boolean),
        active,
        ml_category_id:   category.id,
        ml_category_name: category.name,
        ml_category_path: category.path,
        attributes,
        compatibilidades,
      };

      const res  = await fetch("/api/marca/produtos", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success("Produto cadastrado!");
      router.push(backUrl);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar produto");
    } finally {
      setSaving(false);
    }
  }

  const filledImages = images.filter(Boolean);

  return (
    <div className="min-h-screen">
      <MarcaContentHeader
        title="Novo produto"
        actions={
          <Link
            href={backUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-white/10 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
          >
            <ArrowLeft size={12} /> Voltar
          </Link>
        }
      />

      {/* Layout 2 colunas: formulário + sidebar */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex gap-6 items-start">

          {/* ── Coluna do formulário ── */}
          <div className="flex-1 min-w-0 space-y-5">

            {/* Badge de contexto */}
            {loadingCat && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 size={12} className="animate-spin" /> Carregando categoria...
              </div>
            )}

            {siteCategoria && !loadingCat && (
              <div className="flex items-center gap-3 px-4 py-3 bg-dark-800 border border-white/8 rounded-2xl">
                <div className="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                  <Tag size={13} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Categoria</p>
                  <p className="text-sm font-bold text-white">{siteCategoria.nome}</p>
                </div>
                {siteCategoria.ml_category_id && (
                  <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                    <ShoppingBag size={12} />
                    <span className="hidden sm:block text-[11px]">{siteCategoria.ml_category_name}</span>
                    <CheckCircle2 size={12} />
                  </div>
                )}
              </div>
            )}

            {/* Seletor de categoria ML (oculto se veio de categoria com ML vinculado) */}
            {!siteCategoria?.ml_category_id && (
              <section className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
                <div>
                  <h2 className="text-sm font-bold text-white mb-0.5">Categoria Mercado Livre</h2>
                  <p className="text-xs text-gray-500">Selecione a categoria para carregar os atributos corretos</p>
                </div>
                <CategoryPicker selected={category} onSelect={handleCategoryChange} />
              </section>
            )}

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

            {/* Condições do anúncio */}
            <section className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-bold text-white">Condições do anúncio</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={lbl}>Estoque</label>
                  <input type="number" min={0} placeholder="Qtd. disponível" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Tipo de anúncio</label>
                  <select className={inp} defaultValue="gold_special">
                    <option value="gold_special">Premium</option>
                    <option value="gold_pro">Clássico</option>
                  </select>
                </div>
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

            {/* Atributos ML */}
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

            {/* Botões de ação */}
            <div className="flex gap-3 pb-8">
              <Link
                href={backUrl}
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
                  : <><Package size={14} /> Cadastrar produto</>
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
                price={price}
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

export default function NovoProdutoPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-gray-500" />
      </div>
    }>
      <NovoProdutoForm />
    </Suspense>
  );
}
