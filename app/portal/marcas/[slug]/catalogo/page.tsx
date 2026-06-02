"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  ArrowLeft, Search, Package, Loader2, Building2,
  CheckCircle, Clock, XCircle, ShieldAlert, RefreshCw, X, ChevronLeft, ChevronRight,
} from "lucide-react";

interface Marca {
  id: string; slug: string; name: string; segment: string | null; logo_url: string | null;
}
interface Acesso {
  status: string; bloqueado: boolean;
}
interface Product {
  id: string; sku: string; name: string; description: string; price?: number; images: string[];
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

function ProductModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [imgIndex, setImgIndex] = useState(0);
  const imgs = product.images.filter(Boolean);

  function prev() { setImgIndex(i => (i - 1 + imgs.length) % imgs.length); }
  function next() { setImgIndex(i => (i + 1) % imgs.length); }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[92vh] sm:max-h-[85vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
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
          {/* Image gallery */}
          {imgs.length > 0 ? (
            <div className="relative bg-dark-900">
              <div className="aspect-square w-full relative overflow-hidden">
                <Image
                  src={imgs[imgIndex]} alt={product.name}
                  fill className="object-contain p-4"
                  unoptimized
                />
              </div>

              {/* Prev / Next */}
              {imgs.length > 1 && (
                <>
                  <button onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-xl transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/50 hover:bg-black/70 text-white rounded-xl transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </>
              )}

              {/* Thumbnails */}
              {imgs.length > 1 && (
                <div className="flex justify-center gap-2 py-3 px-4 flex-wrap">
                  {imgs.map((src, i) => (
                    <button key={i} onClick={() => setImgIndex(i)}
                      className={`w-12 h-12 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                        i === imgIndex ? "border-brand" : "border-white/10 hover:border-white/30"
                      }`}
                    >
                      <Image src={src} alt={`${product.name} ${i + 1}`} width={48} height={48} className="w-full h-full object-cover" unoptimized />
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

          {/* Info */}
          <div className="px-5 py-5 space-y-4">
            {product.price != null ? (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Preço</p>
                <p className="text-2xl font-black text-white">{fmt(product.price)}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">Preço sob consulta</p>
            )}

            {product.description && (
              <div>
                <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1.5">Descrição</p>
                <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{product.description}</p>
              </div>
            )}

            <div>
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">SKU</p>
              <p className="text-sm font-mono text-gray-400">{product.sku}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CatalogoMarcaPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [marca,    setMarca]    = useState<Marca | null>(null);
  const [acesso,   setAcesso]   = useState<Acesso | null>(null);
  const [produtos, setProdutos] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState("");
  const [solicitando, setSolicitando] = useState(false);
  const [selected, setSelected] = useState<Product | null>(null);

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

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function solicitarAcesso() {
    setSolicitando(true);
    try {
      const res  = await fetch("/api/portal/marcas/solicitar", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ marca_slug: slug }),
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

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando catálogo...
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
            <p className="text-xs text-gray-600 mb-3">{filtered.length} produto{filtered.length !== 1 ? "s" : ""}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="bg-dark-800 border border-white/8 hover:border-white/20 rounded-2xl overflow-hidden flex flex-col text-left transition-all hover:bg-dark-750 active:scale-[0.98] cursor-pointer"
                >
                  <div className="aspect-square bg-dark-900 flex items-center justify-center overflow-hidden w-full">
                    {p.images[0] ? (
                      <Image
                        src={p.images[0]} alt={p.name}
                        width={200} height={200}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <Package size={28} className="text-gray-700" />
                    )}
                  </div>
                  <div className="p-3 flex flex-col gap-1 flex-1">
                    <p className="text-xs font-bold text-white leading-tight line-clamp-2">{p.name}</p>
                    <p className="text-[10px] text-gray-600 font-mono">{p.sku}</p>
                    {p.description && (
                      <p className="text-[10px] text-gray-500 line-clamp-2 mt-0.5">{p.description}</p>
                    )}
                    <div className="mt-auto pt-2">
                      {p.price != null ? (
                        <p className="text-sm font-black text-white">{fmt(p.price)}</p>
                      ) : (
                        <p className="text-xs text-gray-600">Sob consulta</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Product detail modal */}
      {selected && <ProductModal product={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
