"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Package, Loader2, Building2,
  CheckCircle, Clock, XCircle, ShieldAlert, RefreshCw, X,
  ChevronLeft, ChevronRight, ShoppingBag, CheckCircle2,
  ExternalLink, Link2, Plus, Square, CheckSquare,
} from "lucide-react";

interface Marca { id: string; slug: string; name: string; segment: string | null; logo_url: string | null; }
interface Acesso { status: string; bloqueado: boolean; }
interface Compatibilidade {
  marcaNome: string; modeloNome: string; anoNome: string;
}
interface Product {
  id: string; sku: string; name: string; brand: string; description: string;
  price?: number; resale_price?: number; images: string[];
  ml_category_id?: string; ml_category_name?: string; ml_category_path?: string[];
  attributes?: Record<string, string>;
  compatibilidades?: Compatibilidade[];
  active: boolean;
  ml_item_id?: string; ml_status?: string;
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function StatusBadge({ acesso }: { acesso: Acesso | null }) {
  if (!acesso) return null;
  if (acesso.bloqueado)
    return <span className="flex items-center gap-1 text-[11px] font-semibold text-orange-400"><ShieldAlert size={11} /> Bloqueado</span>;
  if (acesso.status === "recusado")
    return <span className="flex items-center gap-1 text-[11px] font-semibold text-red-400"><XCircle size={11} /> Recusado</span>;
  if (acesso.status === "pendente")
    return <span className="flex items-center gap-1 text-[11px] font-semibold text-yellow-400"><Clock size={11} /> Aguardando aprovação</span>;
  if (acesso.status === "aprovado")
    return <span className="flex items-center gap-1 text-[11px] font-semibold text-green-400"><CheckCircle size={11} /> Aprovado</span>;
  return null;
}

/* ── Bulk Publish Modal ──────────────────────────────────────── */
function BulkPublishModal({
  products, onClose, onDone,
}: {
  products: Product[];
  onClose: () => void;
  onDone: (map: Record<string, string>) => void;
}) {
  const [prices, setPrices] = useState<Record<string, string>>(
    () => Object.fromEntries(products.map(p => [
      p.id,
      p.resale_price ? String(p.resale_price) : p.price ? String(p.price) : "",
    ]))
  );
  const [samePrice, setSamePrice] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handlePublishAll() {
    const effective = samePrice
      ? Object.fromEntries(products.map(p => [p.id, samePrice]))
      : prices;

    const invalid = products.filter(p => {
      const v = Number((effective[p.id] ?? "").replace(",", "."));
      return !v || v <= 0;
    });
    if (invalid.length) { toast.error(`Informe o preço de ${invalid.length} produto(s)`); return; }

    setBusy(true);
    setProgress({ done: 0, total: products.length });
    const successMap: Record<string, string> = {};
    const errs: Record<string, string> = {};

    for (const p of products) {
      const preco = Number((effective[p.id] ?? "").replace(",", "."));
      try {
        const res = await fetch("/api/portal/ml/publicar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ produto_id: p.id, preco_revenda: preco }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro");
        successMap[p.id] = data.ml_item_id;
      } catch (e) {
        errs[p.id] = e instanceof Error ? e.message : "Erro";
      }
      setProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
    }

    setBusy(false);
    setErrors(errs);
    const ok = Object.keys(successMap).length;
    if (ok > 0) {
      toast.success(`${ok} produto(s) publicado(s) com sucesso!`);
      onDone(successMap);
    }
    if (!ok) toast.error("Nenhum produto foi publicado.");
    if (ok > 0 && !Object.keys(errs).length) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={!busy ? onClose : undefined}
    >
      <div
        className="bg-dark-800 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Publicar no Mercado Livre</p>
            <p className="text-xs text-gray-500 mt-0.5">{products.length} produto(s) selecionado(s)</p>
          </div>
          {!busy && (
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all">
              <X size={16} />
            </button>
          )}
        </div>

        {progress && (
          <div className="px-5 pt-3 flex-shrink-0">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Publicando...</span><span>{progress.done}/{progress.total}</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-1.5">
              <div
                className="bg-yellow-400 h-1.5 rounded-full transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <div className="bg-dark-700/50 border border-white/6 rounded-xl p-3 space-y-2">
            <p className="text-[11px] text-gray-500">Mesmo preço para todos (opcional)</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                <input
                  type="number" step="0.01" min="0.01"
                  value={samePrice}
                  onChange={e => setSamePrice(e.target.value)}
                  placeholder="0,00"
                  className="w-full pl-10 pr-3 py-2 bg-dark-600 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/40"
                />
              </div>
              {samePrice && (
                <button onClick={() => setSamePrice("")} className="px-3 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all text-xs">
                  Limpar
                </button>
              )}
            </div>
          </div>

          {products.map(p => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-600 font-mono">{p.sku}</p>
                </div>
                {errors[p.id] && <span className="text-[10px] text-red-400 flex-shrink-0">{errors[p.id]}</span>}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                <input
                  type="number" step="0.01" min="0.01"
                  value={samePrice || prices[p.id] || ""}
                  onChange={e => setPrices(prev => ({ ...prev, [p.id]: e.target.value }))}
                  disabled={!!samePrice || busy}
                  placeholder="0,00"
                  className={`w-full pl-10 pr-3 py-2 bg-dark-700 border rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/40 disabled:opacity-50 ${
                    errors[p.id] ? "border-red-400/40" : "border-white/10"
                  }`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex-shrink-0">
          <button
            onClick={handlePublishAll}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm rounded-xl transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
            {busy ? "Publicando..." : `Publicar ${products.length} produto(s)`}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Bulk Link Modal ─────────────────────────────────────────── */
function BulkLinkModal({
  products, onClose, onDone,
}: {
  products: Product[];
  onClose: () => void;
  onDone: (map: Record<string, string>) => void;
}) {
  const [itemIds, setItemIds] = useState<Record<string, string>>(
    () => Object.fromEntries(products.map(p => [p.id, ""]))
  );
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleLinkAll() {
    const toProcess = products.filter(p => itemIds[p.id]?.trim());
    if (!toProcess.length) { toast.error("Preencha ao menos um ID de anúncio"); return; }

    setBusy(true);
    setProgress({ done: 0, total: toProcess.length });
    const successMap: Record<string, string> = {};
    const errs: Record<string, string> = {};

    for (const p of toProcess) {
      const mlId = itemIds[p.id].trim().toUpperCase();
      try {
        const res = await fetch("/api/portal/ml/vincular", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ produto_id: p.id, ml_item_id: mlId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Erro");
        successMap[p.id] = mlId;
      } catch (e) {
        errs[p.id] = e instanceof Error ? e.message : "Erro";
      }
      setProgress(prev => prev ? { ...prev, done: prev.done + 1 } : null);
    }

    setBusy(false);
    setErrors(errs);
    const ok = Object.keys(successMap).length;
    if (ok > 0) {
      toast.success(`${ok} anúncio(s) vinculado(s) com sucesso!`);
      onDone(successMap);
    }
    if (!ok) toast.error("Nenhum anúncio foi vinculado.");
    if (ok > 0 && !Object.keys(errs).length) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={!busy ? onClose : undefined}
    >
      <div
        className="bg-dark-800 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Vincular anúncios existentes</p>
            <p className="text-xs text-gray-500 mt-0.5">{products.length} produto(s) selecionado(s)</p>
          </div>
          {!busy && (
            <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all">
              <X size={16} />
            </button>
          )}
        </div>

        {progress && (
          <div className="px-5 pt-3 flex-shrink-0">
            <div className="flex justify-between text-xs text-gray-400 mb-1.5">
              <span>Vinculando...</span><span>{progress.done}/{progress.total}</span>
            </div>
            <div className="w-full bg-dark-700 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${(progress.done / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          <p className="text-[11px] text-gray-500">Cole o ID do anúncio no ML para cada produto (ex: MLB123456789)</p>
          {products.map(p => (
            <div key={p.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-600 font-mono">{p.sku}</p>
                </div>
                {errors[p.id] && <span className="text-[10px] text-red-400 flex-shrink-0">{errors[p.id]}</span>}
              </div>
              <input
                type="text"
                value={itemIds[p.id] || ""}
                onChange={e => setItemIds(prev => ({ ...prev, [p.id]: e.target.value }))}
                disabled={busy}
                placeholder="MLB123456789"
                className={`w-full px-3 py-2 bg-dark-700 border rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-400/40 font-mono disabled:opacity-50 ${
                  errors[p.id] ? "border-red-400/40" : "border-white/10"
                }`}
              />
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-white/8 flex-shrink-0">
          <button
            onClick={handleLinkAll}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            {busy ? "Vinculando..." : "Vincular anúncios"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Product Modal ───────────────────────────────────────────── */
function ProductModal({
  product, onClose, mlConnected, publishedItemId, onPublished,
}: {
  product: Product;
  onClose: () => void;
  mlConnected: boolean;
  publishedItemId?: string;
  onPublished: (productId: string, mlItemId: string) => void;
}) {
  const [imgIndex,  setImgIndex]  = useState(0);
  const [busy,      setBusy]      = useState(false);
  const [mlMode,    setMlMode]    = useState<"publish_new" | "link_existing" | null>(null);
  const [priceInput,setPriceInput]= useState(product.resale_price ? String(product.resale_price) : "");
  const [linkItemId,setLinkItemId]= useState("");

  const imgs = product.images.filter(Boolean);
  function prev() { setImgIndex(i => (i - 1 + imgs.length) % imgs.length); }
  function next() { setImgIndex(i => (i + 1) % imgs.length); }

  async function handlePublish() {
    const preco = Number(priceInput.replace(",", "."));
    if (!preco || preco <= 0) { toast.error("Informe um preço válido"); return; }
    setBusy(true);
    try {
      const res  = await fetch("/api/portal/ml/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produto_id: product.id, preco_revenda: preco }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao publicar");
      toast.success("Produto publicado no Mercado Livre!");
      onPublished(product.id, data.ml_item_id);
      setMlMode(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    } finally {
      setBusy(false);
    }
  }

  async function handleLink() {
    const id = linkItemId.trim().toUpperCase();
    if (!id) { toast.error("Informe o ID do anúncio"); return; }
    setBusy(true);
    try {
      const res  = await fetch("/api/portal/ml/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ produto_id: product.id, ml_item_id: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao vincular");
      toast.success("Anúncio vinculado com sucesso!");
      onPublished(product.id, id);
      setMlMode(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao vincular");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-3xl flex flex-col max-h-[92vh] sm:max-h-[88vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        <div className="flex items-center justify-between px-5 pt-3 sm:pt-5 pb-3 border-b border-white/8 flex-shrink-0">
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{product.name}</p>
            <p className="text-[11px] text-gray-500 font-mono mt-0.5">{product.sku}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-xl transition-all ml-3 flex-shrink-0">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* ── Layout: image left + info right on desktop ── */}
          <div className="sm:flex sm:items-start">
            {/* Image column */}
            <div className="sm:w-80 sm:flex-shrink-0 sm:border-r sm:border-white/8">
              {imgs.length > 0 ? (
                <div className="relative bg-dark-900">
                  <div className="aspect-square w-full relative overflow-hidden">
                    <Image src={imgs[imgIndex]} alt={product.name} fill className="object-contain p-4" unoptimized />
                  </div>
                  {imgs.length > 1 && (
                    <>
                      <button onClick={prev} className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-xl transition-all">
                        <ChevronLeft size={16} />
                      </button>
                      <button onClick={next} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-xl transition-all">
                        <ChevronRight size={16} />
                      </button>
                    </>
                  )}
                  {imgs.length > 1 && (
                    <div className="flex justify-center gap-1.5 py-3 px-4 flex-wrap">
                      {imgs.map((src, i) => (
                        <button key={i} onClick={() => setImgIndex(i)}
                          className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 ${
                            i === imgIndex ? "border-brand" : "border-white/10 hover:border-white/30"
                          }`}
                        >
                          <Image src={src} alt={`${product.name} ${i + 1}`} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="aspect-square bg-dark-900 flex items-center justify-center">
                  <Package size={48} className="text-gray-700" />
                </div>
              )}
            </div>

            {/* Info column */}
            <div className="flex-1 px-5 py-5 space-y-5">
              {/* Preços */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-dark-900/60 rounded-xl p-3">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Preço de custo</p>
                  {product.price != null
                    ? <p className="text-lg font-black text-white">{fmt(product.price)}</p>
                    : <p className="text-sm text-gray-600 italic">—</p>}
                </div>
                <div className="bg-brand/5 border border-brand/20 rounded-xl p-3">
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Preço de revenda</p>
                  {product.resale_price != null
                    ? <p className="text-lg font-black text-brand">{fmt(product.resale_price)}</p>
                    : <p className="text-sm text-gray-600 italic">—</p>}
                </div>
              </div>

              {/* SKU + Categoria */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">SKU</p>
                  <p className="text-sm font-mono text-gray-300">{product.sku}</p>
                </div>
                {product.ml_category_name && (
                  <div>
                    <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Categoria</p>
                    <p className="text-xs text-gray-300 leading-tight">{product.ml_category_name}</p>
                    {product.ml_category_path && product.ml_category_path.length > 1 && (
                      <p className="text-[10px] text-gray-600 mt-0.5 leading-tight">{product.ml_category_path.join(" › ")}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Descrição */}
              {product.description && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Descrição</p>
                  <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              {/* Ficha Técnica (atributos) */}
              {product.attributes && Object.keys(product.attributes).length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">Ficha Técnica</p>
                  <div className="rounded-xl overflow-hidden border border-white/6">
                    {Object.entries(product.attributes).map(([key, val], idx) => (
                      <div key={key} className={`flex gap-2 px-3 py-2 ${idx % 2 === 0 ? "bg-dark-900/40" : "bg-transparent"}`}>
                        <span className="text-[11px] text-gray-500 flex-shrink-0 w-36">{key}</span>
                        <span className="text-[11px] text-gray-200 break-words">{val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Compatibilidades */}
              {product.compatibilidades && product.compatibilidades.length > 0 && (
                <div>
                  <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-2">
                    Compatibilidades <span className="text-gray-700 ml-1 normal-case font-normal">{product.compatibilidades.length} veículos</span>
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-white/6 divide-y divide-white/4">
                    {product.compatibilidades.map((c, i) => (
                      <div key={i} className="px-3 py-1.5 text-[11px] text-gray-400 flex gap-2">
                        <span className="font-semibold text-gray-300 flex-shrink-0">{c.marcaNome}</span>
                        <span>{c.modeloNome}</span>
                        <span className="text-gray-600 flex-shrink-0">{c.anoNome}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Anúncio oficial da marca ── */}
              {product.ml_item_id && (
                <div className="flex items-center justify-between py-2.5 px-3 bg-yellow-400/5 border border-yellow-400/15 rounded-xl">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingBag size={13} className="text-yellow-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-500">Anúncio oficial da marca</p>
                      <p className="text-[11px] font-mono text-yellow-400 truncate">{product.ml_item_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {product.ml_status && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        product.ml_status === "active"
                          ? "bg-green-400/15 text-green-400"
                          : "bg-gray-400/15 text-gray-400"
                      }`}>
                        {product.ml_status === "active" ? "Ativo" : product.ml_status}
                      </span>
                    )}
                    <a
                      href={`https://www.mercadolivre.com.br/anuncio/${product.ml_item_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
                    >
                      Ver <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              )}

              {/* ── ML section ── */}
              {mlConnected && (
                <div className="pt-2 border-t border-white/6">
                {publishedItemId ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={13} className="text-green-400" />
                      <span className="text-xs text-green-400 font-semibold">Publicado no Mercado Livre</span>
                    </div>
                    <a
                      href={`https://www.mercadolivre.com.br/anuncio/${publishedItemId}`}
                      target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
                    >
                      Ver anúncio <ExternalLink size={10} />
                    </a>
                  </div>
                ) : mlMode === null ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMlMode("publish_new")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-yellow-400/30 hover:bg-yellow-400/10 text-yellow-400 text-xs font-semibold rounded-xl transition-all"
                    >
                      <Plus size={12} /> Publicar novo
                    </button>
                    <button
                      onClick={() => setMlMode("link_existing")}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 border border-blue-400/30 hover:bg-blue-400/10 text-blue-400 text-xs font-semibold rounded-xl transition-all"
                    >
                      <Link2 size={12} /> Vincular existente
                    </button>
                  </div>
                ) : mlMode === "publish_new" ? (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Defina seu preço de venda no ML</p>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                        <input
                          type="number" step="0.01" min="0.01"
                          value={priceInput}
                          onChange={e => setPriceInput(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handlePublish()}
                          placeholder="0,00"
                          className="w-full pl-10 pr-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-yellow-400/40"
                          autoFocus
                        />
                      </div>
                      <button
                        onClick={handlePublish} disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <ShoppingBag size={13} />}
                        {busy ? "Publicando..." : "Publicar"}
                      </button>
                      <button onClick={() => setMlMode(null)} className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-400">Cole o ID do anúncio (ex: MLB123456789)</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={linkItemId}
                        onChange={e => setLinkItemId(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && handleLink()}
                        placeholder="MLB123456789"
                        className="flex-1 px-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-blue-400/40 font-mono"
                        autoFocus
                      />
                      <button
                        onClick={handleLink} disabled={busy}
                        className="flex items-center gap-1.5 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                        {busy ? "Vinculando..." : "Vincular"}
                      </button>
                      <button onClick={() => setMlMode(null)} className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all">
                        <X size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            </div>{/* end info column */}
          </div>{/* end sm:flex */}
        </div>{/* end overflow-y-auto */}
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function CatalogoMarcaPage() {
  const params = useParams();
  const router = useRouter();
  const slug   = params.slug as string;

  const [marca,       setMarca]       = useState<Marca | null>(null);
  const [acesso,      setAcesso]      = useState<Acesso | null>(null);
  const [produtos,    setProdutos]    = useState<Product[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [q,           setQ]           = useState("");
  const [solicitando, setSolicitando] = useState(false);
  const [selected,    setSelected]    = useState<Product | null>(null);

  const [mlConnected,  setMlConnected]  = useState(false);
  const [publishedMap, setPublishedMap] = useState<Record<string, string>>({});
  const [selectedIds,  setSelectedIds]  = useState<Set<string>>(new Set());
  const [bulkModal,    setBulkModal]    = useState<"publish" | "link" | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/portal/marcas/${slug}/catalogo`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMarca(data.marca);
      setAcesso(data.acesso);
      setProdutos(Array.isArray(data.produtos) ? data.produtos : []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar catálogo");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    fetch("/api/portal/ml/status")
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setMlConnected(d.connected);
        const map: Record<string, string> = {};
        for (const a of (d.anuncios ?? [])) map[a.produto_id] = a.ml_item_id;
        setPublishedMap(map);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function clearSelection() { setSelectedIds(new Set()); }

  function handlePublished(prodId: string, mlItemId: string) {
    setPublishedMap(prev => ({ ...prev, [prodId]: mlItemId }));
  }

  function handleBulkDone(map: Record<string, string>) {
    setPublishedMap(prev => ({ ...prev, ...map }));
    clearSelection();
  }

  async function solicitarAcesso() {
    setSolicitando(true);
    try {
      const res  = await fetch("/api/portal/marcas/solicitar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marca_slug: slug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Solicitação enviada! Aguarde a aprovação da marca.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao solicitar acesso");
    } finally {
      setSolicitando(false);
    }
  }

  const filtered = produtos.filter(p =>
    !q ||
    p.name.toLowerCase().includes(q.toLowerCase()) ||
    p.sku.toLowerCase().includes(q.toLowerCase())
  );

  const semAcesso      = !acesso;
  const podeNovoPedido = acesso?.status === "aprovado" && !acesso.bloqueado;

  /* produtos selecionados para bulk */
  const selectedProducts = filtered.filter(p => selectedIds.has(p.id));
  const unpublishedSelected = selectedProducts.filter(p => !publishedMap[p.id]);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-dark-900 border-b border-white/8 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <button onClick={() => router.push("/portal/marcas")}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all flex-shrink-0"
          >
            <ArrowLeft size={14} />
          </button>

          {marca && (
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-dark-700 border border-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {marca.logo_url
                  ? <Image src={marca.logo_url} alt={marca.name} width={32} height={32} className="object-contain w-full h-full p-0.5" unoptimized />
                  : <Building2 size={14} className="text-gray-600" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-white truncate">{marca.name}</p>
                {marca.segment && <p className="text-xs text-gray-500">{marca.segment}</p>}
              </div>
              <StatusBadge acesso={acesso} />
            </div>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {semAcesso && !loading && (
              <button onClick={solicitarAcesso} disabled={solicitando}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-brand bg-brand/15 hover:bg-brand/25 border border-brand/30 rounded-xl transition-all disabled:opacity-50"
              >
                {solicitando ? <Loader2 size={12} className="animate-spin" /> : null}
                Solicitar acesso
              </button>
            )}
            {podeNovoPedido && (
              <button onClick={() => router.push("/portal/orcamentos/novo")}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold bg-brand hover:bg-brand-hover text-white rounded-xl transition-all"
              >
                Novo pedido
              </button>
            )}
            <button onClick={load} disabled={loading}
              className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </div>
      </header>

      {/* Search */}
      {!loading && produtos.length > 0 && (
        <div className="bg-dark-900 border-b border-white/5 sticky top-[57px] z-10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={q}
                onChange={e => setQ(e.target.value)}
                placeholder="Buscar produto por nome ou SKU..."
                className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-white/8 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 transition-all"
              />
            </div>
          </div>
        </div>
      )}

      <div className={`max-w-5xl mx-auto px-4 sm:px-6 py-6 ${selectedIds.size > 0 ? "pb-28" : ""}`}>
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando catálogo...
          </div>
        ) : acesso?.bloqueado ? (
          <div className="bg-dark-800 border border-orange-400/20 rounded-2xl p-12 text-center space-y-2">
            <ShieldAlert size={28} className="text-orange-400 mx-auto" />
            <p className="text-white font-bold text-sm">Acesso bloqueado</p>
            <p className="text-gray-500 text-xs">Entre em contato com a marca para regularizar sua situação.</p>
          </div>
        ) : acesso?.status === "recusado" ? (
          <div className="bg-dark-800 border border-red-400/15 rounded-2xl p-12 text-center space-y-2">
            <XCircle size={28} className="text-red-400 mx-auto" />
            <p className="text-white font-bold text-sm">Acesso recusado</p>
            <p className="text-gray-500 text-xs">Sua solicitação foi recusada por esta marca.</p>
          </div>
        ) : acesso?.status === "pendente" ? (
          <div className="bg-dark-800 border border-yellow-400/15 rounded-2xl p-12 text-center space-y-2">
            <Clock size={28} className="text-yellow-400 mx-auto" />
            <p className="text-white font-bold text-sm">Aguardando aprovação</p>
            <p className="text-gray-500 text-xs">Sua solicitação está em análise. Os produtos ficarão disponíveis após a aprovação.</p>
          </div>
        ) : !acesso ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center space-y-3">
            <Package size={28} className="text-gray-700 mx-auto" />
            <p className="text-white font-bold text-sm">Solicite acesso para ver o catálogo</p>
            <p className="text-gray-500 text-xs">Clique em &quot;Solicitar acesso&quot; para enviar uma solicitação à marca.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <Package size={28} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {q ? "Nenhum produto encontrado." : "Esta marca ainda não possui produtos cadastrados."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-600">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
              {mlConnected && selectedIds.size > 0 && (
                <button onClick={clearSelection} className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                  <X size={11} /> Limpar seleção
                </button>
              )}
            </div>

            {/* ── Desktop table ── */}
            <div className="hidden md:block bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/8 bg-dark-900/50">
                    {mlConnected && (
                      <th className="w-10 px-3 py-3 text-left">
                        <button
                          onClick={() => {
                            if (selectedIds.size === filtered.length) clearSelection();
                            else setSelectedIds(new Set(filtered.map(p => p.id)));
                          }}
                          className="text-gray-500 hover:text-white transition-colors"
                        >
                          {selectedIds.size === filtered.length && filtered.length > 0
                            ? <CheckSquare size={14} />
                            : <Square size={14} />}
                        </button>
                      </th>
                    )}
                    <th className="w-12 px-3 py-3" />
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Nome</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">SKU</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Custo</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Revenda</th>
                    <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">ML</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {filtered.map(p => (
                    <tr
                      key={p.id}
                      className={`group hover:bg-white/2 transition-colors cursor-pointer ${selectedIds.has(p.id) ? "bg-brand/5" : ""}`}
                      onClick={() => setSelected(p)}
                    >
                      {mlConnected && (
                        <td className="px-3 py-3" onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}>
                          <button className={`transition-colors ${selectedIds.has(p.id) ? "text-brand" : "text-gray-600 hover:text-white"}`}>
                            {selectedIds.has(p.id) ? <CheckSquare size={14} /> : <Square size={14} />}
                          </button>
                        </td>
                      )}
                      <td className="px-3 py-2">
                        <div className="w-10 h-10 rounded-lg bg-dark-900 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {p.images[0] ? (
                            <Image src={p.images[0]} alt={p.name} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                          ) : (
                            <Package size={14} className="text-gray-700" />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <p className="text-sm font-semibold text-white leading-tight">{p.name}</p>
                        {p.description && (
                          <p className="text-xs text-gray-500 line-clamp-1 mt-0.5">{p.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-mono text-gray-400">{p.sku}</span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs text-gray-400">
                          {p.price != null ? fmt(p.price) : <span className="text-gray-600">—</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-sm font-bold text-brand">
                          {p.resale_price != null ? fmt(p.resale_price) : <span className="text-gray-600 text-xs font-normal">—</span>}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {publishedMap[p.id] ? (
                          <span className="inline-flex items-center gap-1 bg-yellow-400/15 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-yellow-400/30">
                            ML
                          </span>
                        ) : mlConnected ? (
                          <span className="text-[10px] text-gray-600">—</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map(p => (
                <div key={p.id} className="relative">
                  <button
                    onClick={() => setSelected(p)}
                    className={`w-full bg-dark-800 border hover:border-white/20 rounded-2xl overflow-hidden flex flex-col text-left transition-all hover:bg-dark-750 active:scale-[0.98] cursor-pointer ${
                      selectedIds.has(p.id) ? "border-brand/60" : "border-white/8"
                    }`}
                  >
                    <div className="aspect-square bg-dark-900 flex items-center justify-center overflow-hidden w-full">
                      {p.images[0] ? (
                        <Image src={p.images[0]} alt={p.name} width={200} height={200} className="w-full h-full object-cover" unoptimized />
                      ) : (
                        <Package size={28} className="text-gray-700" />
                      )}
                    </div>
                    <div className="p-3 flex flex-col gap-1 flex-1">
                      <p className="text-xs font-bold text-white leading-tight line-clamp-2">{p.name}</p>
                      <p className="text-[10px] text-gray-600 font-mono">{p.sku}</p>
                      <div className="mt-auto pt-2 space-y-0.5">
                        {p.resale_price != null && (
                          <p className="text-sm font-black text-brand">{fmt(p.resale_price)}</p>
                        )}
                        {p.price != null && (
                          <p className={`text-xs font-semibold ${p.resale_price != null ? "text-gray-500" : "text-white font-black text-sm"}`}>
                            {p.resale_price != null ? `Custo: ${fmt(p.price)}` : fmt(p.price)}
                          </p>
                        )}
                        {p.price == null && p.resale_price == null && (
                          <p className="text-xs text-gray-600">Sob consulta</p>
                        )}
                      </div>
                    </div>
                  </button>

                  {mlConnected && (
                    <button
                      onClick={e => { e.stopPropagation(); toggleSelect(p.id); }}
                      className={`absolute top-2 left-2 z-10 p-0.5 rounded-lg transition-all ${
                        selectedIds.has(p.id)
                          ? "bg-brand text-white"
                          : "bg-black/60 text-white/50 hover:text-white hover:bg-black/80"
                      }`}
                    >
                      {selectedIds.has(p.id) ? <CheckSquare size={15} /> : <Square size={15} />}
                    </button>
                  )}

                  {publishedMap[p.id] && (
                    <div className="absolute top-2 right-2 z-10 bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-lg leading-none">
                      ML
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Floating bulk action bar */}
      {mlConnected && selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 bg-dark-800 border border-white/15 rounded-2xl shadow-2xl px-4 py-3 w-max max-w-[calc(100vw-2rem)]">
          <span className="text-xs text-gray-400 mr-1 flex-shrink-0">{selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}</span>
          <button
            onClick={() => {
              if (!unpublishedSelected.length) { toast.info("Todos os selecionados já estão publicados"); return; }
              setBulkModal("publish");
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/30 text-yellow-400 text-xs font-semibold rounded-xl transition-all flex-shrink-0"
          >
            <ShoppingBag size={12} /> Publicar novos
            {unpublishedSelected.length > 0 && unpublishedSelected.length < selectedIds.size && (
              <span className="bg-yellow-400 text-black text-[9px] font-black px-1 rounded-full leading-none py-0.5">{unpublishedSelected.length}</span>
            )}
          </button>
          <button
            onClick={() => setBulkModal("link")}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-xl transition-all flex-shrink-0"
          >
            <Link2 size={12} /> Vincular existentes
          </button>
          <button
            onClick={clearSelection}
            className="p-2 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Product detail modal */}
      {selected && (
        <ProductModal
          product={selected}
          onClose={() => setSelected(null)}
          mlConnected={mlConnected}
          publishedItemId={publishedMap[selected.id]}
          onPublished={handlePublished}
        />
      )}

      {/* Bulk publish modal */}
      {bulkModal === "publish" && unpublishedSelected.length > 0 && (
        <BulkPublishModal
          products={unpublishedSelected}
          onClose={() => setBulkModal(null)}
          onDone={handleBulkDone}
        />
      )}

      {/* Bulk link modal */}
      {bulkModal === "link" && selectedProducts.length > 0 && (
        <BulkLinkModal
          products={selectedProducts}
          onClose={() => setBulkModal(null)}
          onDone={handleBulkDone}
        />
      )}
    </div>
  );
}
