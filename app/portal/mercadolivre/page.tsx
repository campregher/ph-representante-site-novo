"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import {
  ShoppingBag, Loader2, CheckCircle2, AlertCircle, X,
  ExternalLink, Unlink, Package, Zap, ArrowRight,
  RefreshCw, AlertTriangle, Pause, Trash2, RotateCcw, Bell,
  Download, Link2, Search, ChevronDown, ChevronUp,
} from "lucide-react";
import { toast } from "sonner";

/* ── Types ────────────────────────────────────────────────────── */
interface Anuncio {
  id: string; produto_id: string; marca_slug: string;
  ml_item_id: string; ml_status: string; preco_revenda: number | null; created_at: string;
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
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

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

/* ── ML Listings section ────────────────────────────────────── */
function MeusAnunciosML({
  onVinculou,
}: {
  onVinculou: (mlItemId: string, produto: Produto) => void;
}) {
  const [anuncios,   setAnuncios]   = useState<MLItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [loaded,     setLoaded]     = useState(false);
  const [paging,     setPaging]     = useState<{ total: number; offset: number; limit: number } | null>(null);
  const [picker,     setPicker]     = useState<string | null>(null); // ml_item_id
  const [expanded,   setExpanded]   = useState(true);
  const [filterQ,    setFilterQ]    = useState("");

  async function fetchAnuncios(offset = 0) {
    setLoading(true);
    try {
      const res  = await fetch(`/api/portal/ml/meus-anuncios?limit=50&offset=${offset}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro");
      if (offset === 0) {
        setAnuncios(data.anuncios ?? []);
      } else {
        setAnuncios(prev => [...prev, ...(data.anuncios ?? [])]);
      }
      setPaging(data.paging);
      setLoaded(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao buscar anúncios");
    } finally {
      setLoading(false);
    }
  }

  async function handleLink(produto: Produto, mlItemId: string) {
    const res = await fetch("/api/portal/ml/vincular", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ produto_id: produto.id, ml_item_id: mlItemId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Erro ao vincular"); return; }

    toast.success("Anúncio vinculado! Vendas deste anúncio gerarão pedidos automáticos.");
    setAnuncios(prev => prev.map(a =>
      a.id === mlItemId
        ? { ...a, vinculado: true, produto_id: produto.id, marca_slug: produto.brand }
        : a
    ));
    setPicker(null);
    onVinculou(mlItemId, produto);
  }

  const filtered = anuncios.filter(a =>
    !filterQ || a.title.toLowerCase().includes(filterQ.toLowerCase()) || a.id.includes(filterQ)
  );

  const hasMore = paging && (paging.offset + paging.limit) < paging.total;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(e => !e)}
          className="flex items-center gap-2 text-sm font-bold text-white"
        >
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          Anúncios no Mercado Livre
          {loaded && (
            <span className="text-xs font-normal text-gray-500">
              ({paging?.total ?? anuncios.length})
            </span>
          )}
        </button>
        <button
          onClick={() => fetchAnuncios(0)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-700 hover:bg-dark-600 border border-white/8 text-gray-400 hover:text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
          {loaded ? "Atualizar" : "Carregar do ML"}
        </button>
      </div>

      {expanded && loaded && (
        <>
          {/* Filter */}
          {anuncios.length > 5 && (
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input
                value={filterQ}
                onChange={e => setFilterQ(e.target.value)}
                placeholder="Filtrar anúncios..."
                className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-white/8 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40"
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <div className="bg-dark-800 border border-white/8 rounded-2xl py-8 text-center text-gray-500 text-sm">
              {filterQ ? "Nenhum anúncio encontrado." : "Nenhum anúncio ativo na sua conta ML."}
            </div>
          ) : (
            <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/4">
              {filtered.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                  {/* Thumbnail */}
                  <div className="w-10 h-10 rounded-xl bg-dark-700 overflow-hidden flex-shrink-0">
                    {a.thumbnail ? (
                      <Image
                        src={a.thumbnail.replace("http://", "https://")}
                        alt={a.title}
                        width={40} height={40}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={14} className="text-gray-600" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-white truncate">{a.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-gray-500 font-mono">{a.id}</p>
                      {a.price > 0 && (
                        <p className="text-[10px] text-gray-400">{fmt(a.price)}</p>
                      )}
                    </div>
                    {a.vinculado && a.marca_slug && (
                      <p className="text-[10px] text-green-400 mt-0.5 flex items-center gap-1">
                        <CheckCircle2 size={9} /> Vinculado · {a.marca_slug}
                      </p>
                    )}
                  </div>

                  {/* Status + actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                      a.status === "active" || a.status === "approved"
                        ? "bg-green-400/15 text-green-400"
                        : "bg-gray-400/15 text-gray-400"
                    }`}>
                      {a.status === "active" || a.status === "approved" ? "Ativo" : a.status}
                    </span>

                    <a
                      href={a.permalink}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                      title="Ver no ML"
                    >
                      <ExternalLink size={12} />
                    </a>

                    {a.vinculado ? (
                      <span className="p-1.5 text-green-400" title="Vinculado">
                        <CheckCircle2 size={12} />
                      </span>
                    ) : (
                      <button
                        onClick={() => setPicker(a.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-brand/10 hover:bg-brand/20 border border-brand/25 text-brand text-[10px] font-bold rounded-lg transition-all"
                        title="Vincular a produto da marca"
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

      {picker && (
        <ProdutoPicker
          mlItemId={picker}
          onLink={handleLink}
          onClose={() => setPicker(null)}
        />
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
    if (searchParams.get("error"))              toast.error("Erro ao conectar conta ML. Tente novamente.");
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

      {/* Anúncios gerenciados pela plataforma */}
      {status?.connected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">
              Publicados pela plataforma
              <span className="ml-2 text-xs font-normal text-gray-500">({status.anuncios.length})</span>
            </p>
            <a href="/portal/marcas" className="text-xs text-brand hover:underline">+ Publicar mais</a>
          </div>

          {status.anuncios.length === 0 ? (
            <div className="bg-dark-800 border border-white/8 rounded-2xl py-8 flex flex-col items-center gap-2">
              <Package size={24} className="text-gray-700" />
              <p className="text-sm text-gray-500">Nenhum produto publicado pela plataforma</p>
              <a href="/portal/marcas" className="text-xs text-brand hover:underline">Ir para catálogo →</a>
            </div>
          ) : (
            <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden divide-y divide-white/4">
              {status.anuncios.map(a => (
                <div key={a.id} className="flex items-center gap-3 px-5 py-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-gray-500">{a.ml_item_id}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{a.marca_slug}</p>
                  </div>
                  {a.preco_revenda != null && (
                    <span className="text-sm font-bold text-white flex-shrink-0">{fmt(a.preco_revenda)}</span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    a.ml_status === "active" || a.ml_status === "approved"
                      ? "bg-green-400/15 text-green-400"
                      : a.ml_status === "paused"
                      ? "bg-yellow-400/15 text-yellow-400"
                      : "bg-gray-400/15 text-gray-400"
                  }`}>
                    {a.ml_status === "active" || a.ml_status === "approved" ? "Ativo"
                      : a.ml_status === "paused" ? "Pausado" : a.ml_status}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a href={`https://www.mercadolivre.com.br/anuncio/${a.ml_item_id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all">
                      <ExternalLink size={13} />
                    </a>
                    <button onClick={() => handleRemoveAnuncio(a)} disabled={removingId === a.id}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50">
                      {removingId === a.id ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Todos os anúncios da conta ML */}
      {status?.connected && (
        <MeusAnunciosML
          onVinculou={(mlItemId, produto) => {
            /* atualiza lista de anúncios gerenciados se ainda não estava lá */
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
                }],
              };
            });
          }}
        />
      )}

      {status?.connected && (
        <div className="flex items-start gap-3 p-4 bg-brand/5 border border-brand/15 rounded-xl">
          <Zap size={13} className="text-brand flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Somente anúncios <span className="text-white font-semibold">vinculados a um produto</span> geram pedidos automáticos quando há uma venda no ML.
          </p>
        </div>
      )}
    </div>
  );
}
