"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ShoppingBag, Loader2, CheckCircle2, AlertCircle, X,
  ExternalLink, Unlink, Package, Zap, ArrowRight,
  RefreshCw, AlertTriangle, Pause, Trash2, RotateCcw, Bell,
  Download, Link2, Search, ChevronDown, ChevronUp, Sparkles,
  TrendingUp, BarChart2, DollarSign, ShoppingCart, Calendar,
} from "lucide-react";
import { toast } from "sonner";

/* ── Types ────────────────────────────────────────────────────── */
interface Anuncio {
  id: string; produto_id: string; marca_slug: string;
  ml_item_id: string; ml_status: string; preco_revenda: number | null; created_at: string;
  produto_name: string | null; produto_thumbnail: string | null;
}

interface Notificacao {
  id: string; produto_id: string; produto_name: string; ml_item_id: string | null;
  tipo: "produto_editado" | "produto_pausado" | "produto_excluido";
  mensagem: string; lida: boolean; acao_tomada: string | null; created_at: string;
}

interface MLItem {
  id: string; title: string; price: number; status: string;
  thumbnail: string; permalink: string;
  vinculado: boolean; produto_id: string | null; marca_slug: string | null;
}

interface Produto {
  id: string; sku: string; name: string; brand: string;
  resale_price: number | null; price: number | null;
  images: string[]; ml_category_name: string | null;
}

interface MLStatus {
  connected: boolean; ml_user_id: string | null; ml_nickname: string | null;
  expires_at: string | null; anuncios: Anuncio[];
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/* ── Notification card ───────────────────────────────────────── */
const TIPO_LABEL = {
  produto_editado:  "Produto atualizado",
  produto_pausado:  "Produto pausado pela marca",
  produto_excluido: "Produto excluído da marca",
};
const TIPO_COLOR = {
  produto_editado:  "text-blue-400 border-blue-400/20 bg-blue-400/5",
  produto_pausado:  "text-yellow-400 border-yellow-400/20 bg-yellow-400/5",
  produto_excluido: "text-red-400 border-red-400/20 bg-red-400/5",
};
const TIPO_ICON = {
  produto_editado:  RefreshCw,
  produto_pausado:  AlertTriangle,
  produto_excluido: Trash2,
};

function NotificacaoCard({
  notif, onAcao,
}: {
  notif: Notificacao;
  onAcao: (notif: Notificacao, acao: "sincronizar" | "pausar" | "remover" | "dispensar") => Promise<void>;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const Icon = TIPO_ICON[notif.tipo];

  async function handle(acao: "sincronizar" | "pausar" | "remover" | "dispensar") {
    setLoading(acao);
    await onAcao(notif, acao).finally(() => setLoading(null));
  }

  return (
    <div className={`border rounded-xl p-4 space-y-3 ${TIPO_COLOR[notif.tipo]}`}>
      <div className="flex items-start gap-3">
        <Icon size={14} className="flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold">{TIPO_LABEL[notif.tipo]}</p>
          <p className="text-[11px] font-semibold text-white mt-0.5 truncate">{notif.produto_name}</p>
          {notif.ml_item_id && <p className="text-[10px] text-gray-500 font-mono">{notif.ml_item_id}</p>}
          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">{notif.mensagem}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {notif.tipo === "produto_editado" && notif.ml_item_id && (
          <button onClick={() => handle("sincronizar")} disabled={!!loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-400/30 text-blue-400 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50">
            {loading === "sincronizar" ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
            Sincronizar anúncio
          </button>
        )}
        {(notif.tipo === "produto_pausado" || notif.tipo === "produto_excluido") && notif.ml_item_id && (
          <button onClick={() => handle("pausar")} disabled={!!loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-yellow-400/15 hover:bg-yellow-400/25 border border-yellow-400/30 text-yellow-400 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50">
            {loading === "pausar" ? <Loader2 size={11} className="animate-spin" /> : <Pause size={11} />}
            Pausar meu anúncio
          </button>
        )}
        {notif.tipo === "produto_excluido" && notif.ml_item_id && (
          <button onClick={() => handle("remover")} disabled={!!loading}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-400/15 hover:bg-red-400/25 border border-red-400/30 text-red-400 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50">
            {loading === "remover" ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
            Remover anúncio
          </button>
        )}
        <button onClick={() => handle("dispensar")} disabled={!!loading}
          className="flex items-center gap-1 px-3 py-1.5 text-gray-500 hover:text-white text-[11px] rounded-lg transition-all">
          <X size={11} /> Dispensar
        </button>
      </div>
    </div>
  );
}

/* ── Product picker modal ───────────────────────────────────── */
function ProdutoPicker({
  mlItemId, onLink, onClose,
}: {
  mlItemId: string;
  onLink: (produto: Produto, mlItemId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [q,        setQ]        = useState("");
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [linking,  setLinking]  = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/portal/produtos/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setProdutos(data.produtos ?? []);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [q]);

  async function handleLink(p: Produto) {
    setLinking(p.id);
    await onLink(p, mlItemId).finally(() => setLinking(null));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm"
      onClick={onClose}>
      <div className="bg-dark-800 border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-white">Vincular a produto da marca</p>
            <p className="text-xs text-gray-500 mt-0.5 font-mono">{mlItemId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-white rounded-xl hover:bg-white/8 transition-all">
            <X size={16} />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/6 flex-shrink-0">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar por nome ou SKU..."
              autoFocus
              className="w-full pl-8 pr-3 py-2 bg-dark-700 border border-white/10 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-gray-500 text-sm gap-2">
              <Loader2 size={14} className="animate-spin" /> Buscando...
            </div>
          ) : produtos.length === 0 ? (
            <div className="py-8 text-center text-gray-500 text-sm">
              {q ? "Nenhum produto encontrado." : "Digite para buscar produtos."}
            </div>
          ) : (
            <div className="divide-y divide-white/4">
              {produtos.map(p => (
                <div key={p.id} className="flex items-center gap-3 px-5 py-3 hover:bg-white/3 transition-colors">
                  <div className="w-9 h-9 rounded-lg bg-dark-700 overflow-hidden flex-shrink-0">
                    {p.images?.[0] ? (
                      <Image src={p.images[0]} alt={p.name} width={36} height={36} className="w-full h-full object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-gray-600" /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{p.name}</p>
                    <p className="text-[10px] text-gray-500 font-mono">{p.sku} · {p.brand}</p>
                    {(p.resale_price ?? p.price) != null && (
                      <p className="text-[10px] text-brand font-bold mt-0.5">
                        {fmt(p.resale_price ?? p.price!)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleLink(p)}
                    disabled={!!linking}
                    className="flex items-center gap-1 px-3 py-1.5 bg-brand/15 hover:bg-brand/25 border border-brand/30 text-brand text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
                  >
                    {linking === p.id ? <Loader2 size={11} className="animate-spin" /> : <Link2 size={11} />}
                    Vincular
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Anúncios gerenciados pela plataforma ───────────────────── */
function statusLabel(s: string) {
  if (s === "active" || s === "approved") return "Ativo";
  if (s === "paused") return "Pausado";
  if (s === "closed") return "Encerrado";
  return s;
}
function statusClass(s: string) {
  if (s === "active" || s === "approved") return "bg-green-400/15 text-green-400 border-green-400/20";
  if (s === "paused") return "bg-yellow-400/15 text-yellow-400 border-yellow-400/20";
  return "bg-gray-400/15 text-gray-400 border-gray-400/20";
}

function AnunciosPlataforma({
  anuncios, removingId, onRemove,
}: {
  anuncios: Anuncio[];
  removingId: string | null;
  onRemove: (a: Anuncio) => void;
}) {
  const [filterQ,     setFilterQ]     = useState("");
  const [filterStatus,setFilterStatus]= useState<"all" | "active" | "paused">("all");

  const filtered = anuncios.filter(a => {
    const matchQ = !filterQ ||
      (a.produto_name ?? "").toLowerCase().includes(filterQ.toLowerCase()) ||
      a.ml_item_id.includes(filterQ) ||
      a.marca_slug.includes(filterQ);
    const isActive = a.ml_status === "active" || a.ml_status === "approved";
    const matchS =
      filterStatus === "all" ? true :
      filterStatus === "active" ? isActive :
      !isActive;
    return matchQ && matchS;
  });

  const ativos   = anuncios.filter(a => a.ml_status === "active" || a.ml_status === "approved").length;
  const inativos = anuncios.length - ativos;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-white">
          Publicados pela plataforma
          <span className="ml-2 text-xs font-normal text-gray-500">({anuncios.length})</span>
        </p>
        <a href="/portal/marcas" className="text-xs text-brand hover:underline">+ Publicar mais</a>
      </div>

      {anuncios.length === 0 ? (
        <div className="bg-dark-800 border border-white/8 rounded-2xl py-10 flex flex-col items-center gap-2">
          <Package size={24} className="text-gray-700" />
          <p className="text-sm text-gray-500">Nenhum produto publicado pela plataforma</p>
          <a href="/portal/marcas" className="text-xs text-brand hover:underline">Ir para catálogo →</a>
        </div>
      ) : (
        <>
          {/* Stats + filters */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilterStatus("all")}
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${filterStatus === "all" ? "bg-white/10 border-white/20 text-white" : "border-white/8 text-gray-500 hover:text-white"}`}
            >
              Todos {anuncios.length}
            </button>
            <button
              onClick={() => setFilterStatus("active")}
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${filterStatus === "active" ? "bg-green-400/15 border-green-400/30 text-green-400" : "border-white/8 text-gray-500 hover:text-white"}`}
            >
              Ativos {ativos}
            </button>
            <button
              onClick={() => setFilterStatus("paused")}
              className={`text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all ${filterStatus === "paused" ? "bg-yellow-400/15 border-yellow-400/30 text-yellow-400" : "border-white/8 text-gray-500 hover:text-white"}`}
            >
              Inativos {inativos}
            </button>
            {anuncios.length > 5 && (
              <div className="relative flex-1 min-w-[160px]">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  value={filterQ}
                  onChange={e => setFilterQ(e.target.value)}
                  placeholder="Filtrar..."
                  className="w-full pl-8 pr-3 py-1.5 bg-dark-800 border border-white/8 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand/40"
                />
              </div>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="bg-dark-800 border border-white/8 rounded-2xl py-8 text-center text-gray-500 text-sm">
              Nenhum anúncio encontrado.
            </div>
          ) : (
            <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/4">
              {filtered.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-xl bg-dark-700 overflow-hidden flex-shrink-0 border border-white/6">
                    {a.produto_thumbnail ? (
                      <Image
                        src={a.produto_thumbnail}
                        alt={a.produto_name ?? a.ml_item_id}
                        width={48} height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={16} className="text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate leading-tight">
                      {a.produto_name ?? a.ml_item_id}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-gray-500 font-mono">{a.ml_item_id}</span>
                      <span className="text-[10px] text-gray-600">{a.marca_slug}</span>
                    </div>
                    {a.preco_revenda != null && (
                      <p className="text-xs font-bold text-brand mt-0.5">{fmt(a.preco_revenda)}</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${statusClass(a.ml_status)}`}>
                    {statusLabel(a.ml_status)}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={`https://www.mercadolivre.com.br/anuncio/${a.ml_item_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                      title="Ver no ML"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => onRemove(a)}
                      disabled={removingId === a.id}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50"
                      title="Remover da plataforma"
                    >
                      {removingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Inline product picker (batch mode) ─────────────────────── */
type PendingLink = { produto_id: string; produto_name: string; produto_sku?: string; preco_revenda: number | null; auto?: boolean };

function InlineProdutoPicker({
  value, onChange,
}: {
  value: PendingLink | null;
  onChange: (p: PendingLink | null) => void;
}) {
  const [q,       setQ]       = useState(value?.produto_name ?? "");
  const [results, setResults] = useState<Produto[]>([]);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const wrapRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (value) return;
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); setOpen(false); return; }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res  = await fetch(`/api/portal/produtos/buscar?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setResults(data.produtos ?? []);
        setOpen(true);
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [q, value]);

  if (value) {
    return (
      <div className={`flex items-center gap-1.5 px-2.5 py-1.5 border rounded-xl min-w-0 max-w-[260px] ${value.auto ? "bg-purple-500/10 border-purple-500/25" : "bg-brand/10 border-brand/25"}`}>
        {value.auto
          ? <Sparkles size={10} className="text-purple-400 flex-shrink-0" />
          : <CheckCircle2 size={10} className="text-brand flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <p className={`text-[11px] font-semibold truncate leading-tight ${value.auto ? "text-purple-300" : "text-brand"}`}>{value.produto_name}</p>
          {value.produto_sku && (
            <p className={`text-[9px] font-mono leading-tight ${value.auto ? "text-purple-400/70" : "text-brand/60"}`}>{value.produto_sku}</p>
          )}
        </div>
        <button onClick={() => { onChange(null); setQ(""); }} className="text-gray-500 hover:text-white flex-shrink-0 ml-1">
          <X size={10} />
        </button>
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative w-[200px]">
      <input
        value={q}
        onChange={e => { setQ(e.target.value); onChange(null); }}
        onFocus={() => { if (results.length) setOpen(true); }}
        placeholder="Buscar produto..."
        className="w-full px-3 py-1.5 bg-dark-700 border border-white/10 rounded-xl text-xs text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 transition-all"
      />
      {loading && <Loader2 size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />}
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-white/12 rounded-xl overflow-hidden shadow-2xl z-50 max-h-52 overflow-y-auto">
          {results.slice(0, 8).map(p => (
            <button
              key={p.id}
              onClick={() => { onChange({ produto_id: p.id, produto_name: p.name, produto_sku: p.sku, preco_revenda: p.resale_price, auto: false }); setQ(p.name); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 transition-colors text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-dark-600 overflow-hidden flex-shrink-0">
                {p.images?.[0]
                  ? <img src={p.images[0]} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Package size={10} className="text-gray-600" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-white font-medium truncate">{p.name}</p>
                <p className="text-[10px] text-gray-500 font-mono">{p.sku}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── ML Listings section ────────────────────────────────────── */
function MeusAnunciosML({
  onVinculou,
}: {
  onVinculou: (mlItemId: string, produto: Produto) => void;
}) {
  const [anuncios,     setAnuncios]     = useState<MLItem[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [loaded,       setLoaded]       = useState(false);
  const [paging,       setPaging]       = useState<{ total: number; offset: number; limit: number } | null>(null);
  const [picker,       setPicker]       = useState<string | null>(null);
  const [expanded,     setExpanded]     = useState(true);
  const [filterQ,      setFilterQ]      = useState("");
  const [batchMode,    setBatchMode]    = useState(false);
  const [pendingLinks, setPendingLinks] = useState<Record<string, PendingLink>>({});
  const [savingBatch,  setSavingBatch]  = useState(false);
  const [suggesting,   setSuggesting]   = useState(false);

  async function fetchAnuncios(offset = 0) {
    setLoading(true);
    try {
      const res  = await fetch(`/api/portal/ml/meus-anuncios?limit=50&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      if (offset === 0) setAnuncios(data.anuncios ?? []);
      else setAnuncios(prev => [...prev, ...(data.anuncios ?? [])]);
      setPaging(data.paging);
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar anúncios");
    } finally { setLoading(false); }
  }

  async function handleLink(produto: Produto, mlItemId: string) {
    const res  = await fetch("/api/portal/ml/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produto_id: produto.id, ml_item_id: mlItemId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Erro ao vincular"); return; }
    toast.success("Anúncio vinculado! Vendas deste anúncio gerarão pedidos automáticos.");
    setAnuncios(prev => prev.map(a =>
      a.id === mlItemId ? { ...a, vinculado: true, produto_id: produto.id, marca_slug: produto.brand } : a
    ));
    setPicker(null);
    onVinculou(mlItemId, produto);
  }

  async function handleBatchSave() {
    const items = Object.entries(pendingLinks).map(([ml_item_id, l]) => ({ ml_item_id, produto_id: l.produto_id }));
    if (!items.length) return;
    setSavingBatch(true);
    try {
      const res  = await fetch("/api/portal/ml/vincular", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");

      const results: { ok: boolean; ml_item_id: string }[] = data.results ?? [];
      const ok  = results.filter(r => r.ok);
      const err = results.filter(r => !r.ok);

      if (ok.length) {
        toast.success(`${ok.length} anúncio${ok.length !== 1 ? "s" : ""} vinculado${ok.length !== 1 ? "s" : ""}!`);
        setAnuncios(prev => prev.map(a => {
          const link = pendingLinks[a.id];
          if (link && ok.some(r => r.ml_item_id === a.id))
            return { ...a, vinculado: true, produto_id: link.produto_id, marca_slug: link.produto_id };
          return a;
        }));
        ok.forEach(r => {
          const link = pendingLinks[r.ml_item_id];
          if (link) onVinculou(r.ml_item_id, { id: link.produto_id, name: link.produto_name, brand: "", sku: "", resale_price: link.preco_revenda, price: null, images: [], ml_category_name: null });
        });
      }
      if (err.length) toast.error(`${err.length} anúncio${err.length !== 1 ? "s" : ""} não vinculados.`);

      const remaining = { ...pendingLinks };
      ok.forEach(r => delete remaining[r.ml_item_id]);
      setPendingLinks(remaining);
      if (!Object.keys(remaining).length) setBatchMode(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar vínculos");
    } finally { setSavingBatch(false); }
  }

  async function handleSuggest() {
    const unlinked = anuncios.filter(a => !a.vinculado);
    if (!unlinked.length) return;
    setSuggesting(true);
    try {
      const res  = await fetch("/api/portal/ml/sugerir-vinculos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: unlinked.map(a => ({ id: a.id, title: a.title })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");

      type Sug = { ml_item_id: string; produto_id: string; produto_name: string; produto_sku: string; preco_revenda: number | null; confidence: string };
      const suggestions: Sug[] = data.suggestions ?? [];
      if (!suggestions.length) { toast.info("Nenhuma sugestão encontrada. Vincule manualmente."); return; }

      const next: Record<string, PendingLink> = { ...pendingLinks };
      for (const s of suggestions) {
        if (!next[s.ml_item_id]) {
          next[s.ml_item_id] = { produto_id: s.produto_id, produto_name: s.produto_name, produto_sku: s.produto_sku, preco_revenda: s.preco_revenda, auto: true };
        }
      }
      setPendingLinks(next);
      const skuCount   = suggestions.filter(s => s.confidence === "sku").length;
      const titleCount = suggestions.filter(s => s.confidence === "titulo").length;
      const parts = [];
      if (skuCount)   parts.push(`${skuCount} por SKU`);
      if (titleCount) parts.push(`${titleCount} por palavras-chave`);
      toast.success(`${suggestions.length} sugestão(ões) encontradas (${parts.join(", ")}). Revise e salve.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao sugerir vínculos");
    } finally {
      setSuggesting(false);
    }
  }

  const unlinkedCount = anuncios.filter(a => !a.vinculado).length;
  const pendingCount  = Object.keys(pendingLinks).length;

  const filtered = (batchMode ? anuncios.filter(a => !a.vinculado) : anuncios).filter(a =>
    !filterQ || a.title.toLowerCase().includes(filterQ.toLowerCase()) || a.id.includes(filterQ)
  );

  const hasMore = paging && (paging.offset + paging.limit) < paging.total;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-sm font-bold text-white"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Anúncios no Mercado Livre
          {loaded && <span className="text-xs font-normal text-gray-500">({paging?.total ?? anuncios.length})</span>}
        </button>
        <div className="flex items-center gap-2">
          {loaded && unlinkedCount > 0 && !batchMode && (
            <button
              onClick={() => { setBatchMode(true); setPendingLinks({}); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/25 text-brand text-xs font-bold rounded-xl transition-all"
            >
              <Link2 size={12} /> Vincular em massa ({unlinkedCount})
            </button>
          )}
          {batchMode && (
            <button
              onClick={() => { setBatchMode(false); setPendingLinks({}); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-white/10 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all"
            >
              <X size={12} /> Cancelar
            </button>
          )}
          <button
            onClick={() => fetchAnuncios(0)}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-white/8 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            {loaded ? "Atualizar" : "Carregar do ML"}
          </button>
        </div>
      </div>

      {/* Batch mode banner */}
      {batchMode && (
        <div className="flex items-start gap-3 px-4 py-3 bg-brand/8 border border-brand/20 rounded-xl">
          <Link2 size={13} className="text-brand flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-300">
              Selecione o produto para cada anúncio. Clique em <span className="text-white font-semibold">Salvar vínculos</span> quando terminar.
            </p>
            <button
              onClick={handleSuggest}
              disabled={suggesting}
              className="mt-2 flex items-center gap-1.5 px-3 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-400 text-[11px] font-semibold rounded-lg transition-all disabled:opacity-50"
            >
              {suggesting
                ? <><Loader2 size={11} className="animate-spin" /> Buscando sugestões...</>
                : <><Sparkles size={11} /> Sugerir vínculos automaticamente</>}
            </button>
          </div>
          {pendingCount > 0 && (
            <span className="text-xs font-bold text-brand flex-shrink-0 mt-0.5">{pendingCount} pendente{pendingCount !== 1 ? "s" : ""}</span>
          )}
        </div>
      )}

      {expanded && loaded && (
        <>
          {anuncios.length > 5 && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={filterQ}
                onChange={e => setFilterQ(e.target.value)}
                placeholder={batchMode ? "Filtrar anúncios sem vínculo..." : "Filtrar anúncios..."}
                className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-white/8 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-dark-800 border border-white/8 rounded-2xl py-8 text-center text-gray-500 text-sm">
              {batchMode ? "Todos os anúncios já estão vinculados." : filterQ ? "Nenhum anúncio encontrado." : "Nenhum anúncio ativo na sua conta ML."}
            </div>
          ) : (
            <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/4">
              {filtered.map(a => (
                <div key={a.id} className={`flex items-center gap-3 px-4 py-3 transition-colors ${pendingLinks[a.id] ? "bg-brand/4" : ""}`}>
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-xl bg-dark-700 overflow-hidden flex-shrink-0">
                    {a.thumbnail ? (
                      <Image src={a.thumbnail.replace("http://", "https://")} alt={a.title} width={40} height={40} className="w-full h-full object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package size={14} className="text-gray-600" /></div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-gray-500 font-mono">{a.id}</p>
                      {a.price > 0 && <p className="text-[10px] text-gray-400">{fmt(a.price)}</p>}
                    </div>
                    {!batchMode && a.vinculado && a.marca_slug && (
                      <p className="text-[10px] text-green-400 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 size={9} /> Vinculado · {a.marca_slug}
                      </p>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!batchMode && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${a.status === "active" || a.status === "approved" ? "bg-green-400/15 text-green-400" : "bg-gray-400/15 text-gray-400"}`}>
                        {a.status === "active" || a.status === "approved" ? "Ativo" : a.status}
                      </span>
                    )}
                    <a href={a.permalink} target="_blank" rel="noopener noreferrer" className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all" title="Ver no ML">
                      <ExternalLink size={12} />
                    </a>

                    {batchMode ? (
                      <InlineProdutoPicker
                        value={pendingLinks[a.id] ?? null}
                        onChange={p => setPendingLinks(prev => {
                          const next = { ...prev };
                          if (p) next[a.id] = p; else delete next[a.id];
                          return next;
                        })}
                      />
                    ) : a.vinculado ? (
                      <span className="p-1.5 text-green-400" title="Vinculado"><CheckCircle2 size={12} /></span>
                    ) : (
                      <button
                        onClick={() => setPicker(a.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/25 text-brand text-[10px] font-bold rounded-lg transition-all"
                      >
                        <Link2 size={10} /> Vincular
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {hasMore && (
            <button
              onClick={() => fetchAnuncios((paging?.offset ?? 0) + (paging?.limit ?? 50))}
              disabled={loading}
              className="w-full py-2.5 text-xs text-gray-400 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={12} className="animate-spin mx-auto" /> : `Carregar mais (${paging!.total - anuncios.length} restantes)`}
            </button>
          )}
        </>
      )}

      {expanded && !loaded && !loading && (
        <div className="bg-dark-800 border border-white/8 border-dashed rounded-2xl py-8 text-center space-y-2">
          <Download size={20} className="text-gray-600 mx-auto" />
          <p className="text-sm text-gray-500">Clique em &quot;Carregar do ML&quot; para importar seus anúncios</p>
          <p className="text-xs text-gray-600">Você poderá vincular cada anúncio a um produto da marca para ativar o dropshipping automático</p>
        </div>
      )}

      {/* Floating save bar (batch mode) */}
      {batchMode && pendingCount > 0 && (
        <div className="sticky bottom-4 z-30">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5 bg-dark-800 border border-brand/30 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-sm">
            <div>
              <p className="text-sm font-bold text-white">{pendingCount} vínculo{pendingCount !== 1 ? "s" : ""} pendente{pendingCount !== 1 ? "s" : ""}</p>
              <p className="text-xs text-gray-500">Clique em salvar para confirmar todos</p>
            </div>
            <button
              onClick={handleBatchSave}
              disabled={savingBatch}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex-shrink-0"
            >
              {savingBatch ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><CheckCircle2 size={14} /> Salvar vínculos</>}
            </button>
          </div>
        </div>
      )}

      {picker && (
        <ProdutoPicker mlItemId={picker} onLink={handleLink} onClose={() => setPicker(null)} />
      )}
    </div>
  );
}

/* ── Vendas ML ───────────────────────────────────────────────── */
type Periodo = "mes" | "7d" | "30d" | "90d";

const PERIODO_LABEL: Record<Periodo, string> = {
  mes:  "Este mês",
  "7d":  "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
};

interface VendaItem {
  ml_item_id: string; title: string; quantity: number; unit_price: number;
  vinculado: boolean; produto_id: string | null; marca_slug: string | null;
}

interface VendaOrder {
  id: number; date_created: string; status: string;
  total_amount: number; buyer: string; items: VendaItem[];
}

interface RankingItem {
  produto_id: string; marca_slug: string; titulo: string; qtd: number; total: number;
}

interface VendasData {
  periodo: Periodo;
  totalVendido: number;
  totalPedidos: number;
  ticketMedio: number;
  ranking: RankingItem[];
  orders: VendaOrder[];
}

function VendasML() {
  const [periodo,       setPeriodo]       = useState<Periodo>("mes");
  const [data,          setData]          = useState<VendasData | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [semPermissao,  setSemPermissao]  = useState(false);
  const [expanded,      setExpanded]      = useState<string | null>(null);

  async function fetchVendas(p: Periodo) {
    setLoading(true);
    setSemPermissao(false);
    try {
      const res  = await fetch(`/api/portal/ml/vendas?periodo=${p}`);
      const json = await res.json();
      if (res.status === 403 && json.sem_permissao) { setSemPermissao(true); return; }
      if (!res.ok) throw new Error(json.error ?? "Erro");
      setData(json);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar vendas");
    } finally { setLoading(false); }
  }

  useEffect(() => { fetchVendas(periodo); }, [periodo]);

  function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
  }

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 bg-dark-800 border border-white/8 rounded-xl">
          {(Object.keys(PERIODO_LABEL) as Periodo[]).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${periodo === p ? "bg-brand text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
            >
              {PERIODO_LABEL[p]}
            </button>
          ))}
        </div>
        <button
          onClick={() => fetchVendas(periodo)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 border border-white/8 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Atualizar
        </button>
      </div>

      {semPermissao && (
        <div className="bg-dark-800 border border-yellow-400/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-white">Permissão de pedidos não habilitada</p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                O aplicativo ML não tem acesso à API de pedidos. Para habilitar, acesse o{" "}
                <span className="text-yellow-400 font-semibold">ML Developers</span> e ative a permissão{" "}
                <span className="text-white font-semibold">Pedidos (Orders)</span> para o seu app.
              </p>
            </div>
          </div>
          <div className="ml-7 space-y-2 text-xs text-gray-500">
            <p className="font-semibold text-gray-400">Como corrigir:</p>
            <ol className="list-decimal list-inside space-y-1 leading-relaxed">
              <li>Acesse <span className="text-brand font-mono">developers.mercadolivre.com.br</span></li>
              <li>Selecione seu aplicativo</li>
              <li>Vá em <span className="text-white">Permissões</span> e habilite <span className="text-white">Pedidos</span></li>
              <li>Salve e reconecte sua conta ML aqui na plataforma</li>
            </ol>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Buscando vendas no Mercado Livre...
        </div>
      ) : !data || semPermissao ? null : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-800 border border-white/8 rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-green-400 mb-2">
                <DollarSign size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Total vendido</span>
              </div>
              <p className="text-xl font-bold text-white">{fmt(data.totalVendido)}</p>
              <p className="text-[10px] text-gray-500">{PERIODO_LABEL[data.periodo]}</p>
            </div>
            <div className="bg-dark-800 border border-white/8 rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-blue-400 mb-2">
                <ShoppingCart size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Pedidos</span>
              </div>
              <p className="text-xl font-bold text-white">{data.totalPedidos}</p>
              <p className="text-[10px] text-gray-500">pedidos pagos</p>
            </div>
            <div className="bg-dark-800 border border-white/8 rounded-2xl p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-purple-400 mb-2">
                <TrendingUp size={14} />
                <span className="text-[11px] font-semibold uppercase tracking-wide">Ticket médio</span>
              </div>
              <p className="text-xl font-bold text-white">{fmt(data.ticketMedio)}</p>
              <p className="text-[10px] text-gray-500">por pedido</p>
            </div>
          </div>

          {data.totalPedidos === 0 ? (
            <div className="bg-dark-800 border border-white/8 border-dashed rounded-2xl py-12 flex flex-col items-center gap-2">
              <BarChart2 size={24} className="text-gray-700" />
              <p className="text-sm text-gray-500">Nenhum pedido pago neste período</p>
            </div>
          ) : (
            <>
              {/* Ranking de produtos */}
              {data.ranking.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-white flex items-center gap-2">
                    <BarChart2 size={14} className="text-brand" />
                    Produtos mais vendidos
                    <span className="text-xs font-normal text-gray-500">(anúncios vinculados)</span>
                  </p>
                  <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/4">
                    {data.ranking.map((r, i) => {
                      const pct = data.ranking[0].total > 0
                        ? Math.round((r.total / data.ranking[0].total) * 100)
                        : 0;
                      return (
                        <div key={r.produto_id ?? i} className="px-4 py-3 space-y-1.5">
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-bold text-gray-600 w-4 text-right flex-shrink-0">#{i + 1}</span>
                            <p className="text-xs font-semibold text-white flex-1 truncate">{r.titulo}</p>
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-bold text-brand">{fmt(r.total)}</p>
                              <p className="text-[10px] text-gray-500">{r.qtd} un.</p>
                            </div>
                          </div>
                          <div className="ml-7 h-1 bg-dark-600 rounded-full overflow-hidden">
                            <div className="h-full bg-brand/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de pedidos */}
              <div className="space-y-2">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  Pedidos recentes
                  <span className="text-xs font-normal text-gray-500">({data.orders.length})</span>
                </p>
                <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/4">
                  {data.orders.map(o => (
                    <div key={o.id}>
                      <button
                        onClick={() => setExpanded(prev => prev === String(o.id) ? null : String(o.id))}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-semibold text-white font-mono">#{o.id}</p>
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-400/15 text-green-400">
                              Pago
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mt-0.5">{o.buyer} · {fmtDate(o.date_created)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-white">{fmt(o.total_amount)}</p>
                          <p className="text-[10px] text-gray-500">{o.items.length} item{o.items.length !== 1 ? "s" : ""}</p>
                        </div>
                        {expanded === String(o.id)
                          ? <ChevronUp size={13} className="text-gray-500 flex-shrink-0" />
                          : <ChevronDown size={13} className="text-gray-500 flex-shrink-0" />}
                      </button>

                      {expanded === String(o.id) && (
                        <div className="border-t border-white/4 bg-dark-900/40 divide-y divide-white/3">
                          {o.items.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3 px-5 py-2.5">
                              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.vinculado ? "bg-green-400" : "bg-gray-600"}`} />
                              <p className="text-xs text-gray-300 flex-1 truncate">{item.title}</p>
                              <p className="text-[10px] text-gray-500 flex-shrink-0">{item.quantity}x</p>
                              <p className="text-xs font-semibold text-white flex-shrink-0">{fmt(item.unit_price * item.quantity)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────── */
export default function MercadoLivrePage() {
  const searchParams = useSearchParams();

  const [status,        setStatus]        = useState<MLStatus | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [removingId,    setRemovingId]    = useState<string | null>(null);
  const [notificacoes,  setNotificacoes]  = useState<Notificacao[]>([]);
  const [aba,           setAba]           = useState<"anuncios" | "vendas">("anuncios");

  async function load() {
    setLoading(true);
    try {
      const [statusRes, notifRes] = await Promise.all([
        fetch("/api/portal/ml/status"),
        fetch("/api/portal/ml/notificacoes"),
      ]);
      const statusData = await statusRes.json();
      const notifData  = notifRes.ok ? await notifRes.json() : { notificacoes: [] };
      setStatus(statusData);
      setNotificacoes((notifData.notificacoes ?? []).filter((n: Notificacao) => !n.lida));
    } catch {
      toast.error("Erro ao carregar status ML");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    if (searchParams.get("connected") === "1") toast.success("Conta do Mercado Livre conectada!");
    const err = searchParams.get("error");
    if (err === "auth")    toast.error("Sessão expirada durante a autorização. Tente novamente.");
    else if (err === "token") toast.error("Erro ao obter token do ML. Verifique as configurações do app.");
    else if (err === "no_code") toast.error("ML não retornou código de autorização. Tente novamente.");
    else if (err)          toast.error("Erro ao conectar conta ML. Tente novamente.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    if (!confirm("Desconectar sua conta do Mercado Livre?")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/portal/ml/disconnect", { method: "DELETE" });
      toast.success("Conta desconectada.");
      await load();
    } catch {
      toast.error("Erro ao desconectar conta");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleRemoveAnuncio(anuncio: Anuncio) {
    setRemovingId(anuncio.id);
    try {
      const res = await fetch("/api/portal/ml/publicar", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ml_item_id: anuncio.ml_item_id }),
      });
      if (!res.ok) throw new Error();
      toast.success("Anúncio removido.");
      setStatus(prev => prev ? { ...prev, anuncios: prev.anuncios.filter(a => a.id !== anuncio.id) } : prev);
    } catch {
      toast.error("Erro ao remover anúncio");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAcaoNotificacao(
    notif: Notificacao,
    acao: "sincronizar" | "pausar" | "remover" | "dispensar"
  ) {
    const res = await fetch("/api/portal/ml/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        acao, notificacao_id: notif.id, ml_item_id: notif.ml_item_id, produto_id: notif.produto_id,
      }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Erro"); return; }

    const MSGS: Record<string, string> = {
      sincronizar: "Anúncio sincronizado!", pausar: "Anúncio pausado.",
      remover: "Anúncio removido.", dispensar: "Notificação dispensada.",
    };
    toast.success(MSGS[acao]);
    setNotificacoes(prev => prev.filter(n => n.id !== notif.id));
    if (acao === "remover") {
      setStatus(prev => prev
        ? { ...prev, anuncios: prev.anuncios.filter(a => a.ml_item_id !== notif.ml_item_id) }
        : prev);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2 text-gray-500 text-sm">
        <Loader2 size={16} className="animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center flex-shrink-0">
          <ShoppingBag size={18} className="text-yellow-400" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white">Mercado Livre</h1>
          <p className="text-xs text-gray-500">Conecte sua conta e gerencie seus anúncios</p>
        </div>
        {notificacoes.length > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-400/10 border border-yellow-400/20 rounded-xl">
            <Bell size={12} className="text-yellow-400" />
            <span className="text-xs font-bold text-yellow-400">{notificacoes.length}</span>
          </div>
        )}
      </div>

      {/* Conexão */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
        {status?.connected ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Conta conectada</p>
                {status.ml_nickname && <p className="text-xs text-yellow-400 font-medium">{status.ml_nickname}</p>}
                <p className="text-[11px] text-gray-600">ID: {status.ml_user_id}</p>
              </div>
            </div>
            <button onClick={handleDisconnect} disabled={disconnecting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 border border-red-400/20 hover:bg-red-400/10 rounded-xl transition-all disabled:opacity-50">
              {disconnecting ? <Loader2 size={12} className="animate-spin" /> : <Unlink size={12} />}
              Desconectar
            </button>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertCircle size={16} className="text-yellow-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Conta não conectada</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                  Conecte sua conta para publicar produtos e ativar o dropshipping automático.
                </p>
              </div>
            </div>
            <a href="/api/portal/ml/connect"
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm rounded-xl transition-all flex-shrink-0">
              <ShoppingBag size={14} /> Conectar conta
            </a>
          </div>
        )}
      </div>

      {/* Notificações */}
      {notificacoes.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-bold text-white flex items-center gap-2">
            <Bell size={14} className="text-yellow-400" />
            Atualizações das marcas
            <span className="text-xs font-normal text-gray-500">({notificacoes.length})</span>
          </p>
          <div className="space-y-2">
            {notificacoes.map(n => (
              <NotificacaoCard key={n.id} notif={n} onAcao={handleAcaoNotificacao} />
            ))}
          </div>
        </div>
      )}

      {/* Como funciona (só quando desconectado) */}
      {!status?.connected && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-white">Como funciona o dropshipping</p>
          <div className="space-y-3">
            {[
              { icon: Zap,          text: "Conecte sua conta ML e navegue pelo catálogo das marcas" },
              { icon: ShoppingBag,  text: "Publique produtos novos ou vincule anúncios existentes" },
              { icon: ArrowRight,   text: "Quando uma venda acontecer, o pedido entra automaticamente na marca" },
              { icon: CheckCircle2, text: "A marca separa e envia com a etiqueta gerada pelo ML" },
            ].map(({ icon: Icon, text }, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={12} className="text-brand" />
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Abas */}
      {status?.connected && (
        <div className="flex items-center gap-1 p-1 bg-dark-800 border border-white/8 rounded-2xl">
          <button
            onClick={() => setAba("anuncios")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-xl transition-all ${aba === "anuncios" ? "bg-white/8 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
          >
            <ShoppingBag size={14} /> Anúncios
          </button>
          <button
            onClick={() => setAba("vendas")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-xl transition-all ${aba === "vendas" ? "bg-white/8 text-white shadow-sm" : "text-gray-400 hover:text-white"}`}
          >
            <TrendingUp size={14} /> Vendas Mercado Livre
          </button>
        </div>
      )}

      {/* Aba Anúncios */}
      {status?.connected && aba === "anuncios" && (
        <>
          <AnunciosPlataforma
            anuncios={status.anuncios}
            removingId={removingId}
            onRemove={handleRemoveAnuncio}
          />

          <MeusAnunciosML
            onVinculou={(mlItemId, produto) => {
              setStatus(prev => {
                if (!prev) return prev;
                const jaExiste = prev.anuncios.some(a => a.ml_item_id === mlItemId);
                if (jaExiste) return prev;
                return {
                  ...prev,
                  anuncios: [...prev.anuncios, {
                    id: mlItemId,
                    produto_id: produto.id,
                    marca_slug: produto.brand,
                    ml_item_id: mlItemId,
                    ml_status: "active",
                    preco_revenda: produto.resale_price,
                    created_at: new Date().toISOString(),
                    produto_name: produto.name,
                    produto_thumbnail: produto.images?.[0] ?? null,
                  }],
                };
              });
            }}
          />

          <div className="flex items-start gap-3 p-4 bg-brand/5 border border-brand/15 rounded-xl">
            <Zap size={13} className="text-brand flex-shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">
              Somente anúncios <span className="text-white font-semibold">vinculados a um produto</span> geram pedidos automáticos quando há uma venda no ML.
            </p>
          </div>
        </>
      )}

      {/* Aba Vendas */}
      {status?.connected && aba === "vendas" && <VendasML />}
    </div>
  );
}
