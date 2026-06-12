"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  ShoppingBag, Loader2, CheckCircle2, AlertCircle, X,
  ExternalLink, Unlink, Package, Zap, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface Anuncio {
  id:            string;
  produto_id:    string;
  marca_slug:    string;
  ml_item_id:    string;
  ml_status:     string;
  preco_revenda: number | null;
  created_at:    string;
}

interface MLStatus {
  connected:   boolean;
  ml_user_id:  string | null;
  ml_nickname: string | null;
  expires_at:  string | null;
  anuncios:    Anuncio[];
}

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function MercadoLivrePage() {
  const searchParams = useSearchParams();

  const [status,       setStatus]       = useState<MLStatus | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [disconnecting,setDisconnecting]= useState(false);
  const [removingId,   setRemovingId]   = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/portal/ml/status");
      const data = await res.json();
      setStatus(data);
    } catch {
      toast.error("Erro ao carregar status ML");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    /* feedback de redirect OAuth */
    if (searchParams.get("connected") === "1") toast.success("Conta do Mercado Livre conectada!");
    if (searchParams.get("error"))              toast.error("Erro ao conectar conta ML. Tente novamente.");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDisconnect() {
    if (!confirm("Desconectar sua conta do Mercado Livre? Os anúncios publicados serão pausados.")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/portal/ml/disconnect", { method: "DELETE" });
      if (!res.ok) throw new Error();
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
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ml_item_id: anuncio.ml_item_id }),
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
        <div>
          <h1 className="text-lg font-bold text-white">Mercado Livre</h1>
          <p className="text-xs text-gray-500">Conecte sua conta e publique produtos das marcas</p>
        </div>
      </div>

      {/* Card de conexão */}
      <div className="bg-dark-800 border border-white/8 rounded-2xl p-5">
        {status?.connected ? (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-400/10 border border-green-400/20 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 size={16} className="text-green-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Conta conectada</p>
                {status.ml_nickname && (
                  <p className="text-xs text-yellow-400 font-medium">{status.ml_nickname}</p>
                )}
                <p className="text-[11px] text-gray-600">ID: {status.ml_user_id}</p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 border border-red-400/20 hover:bg-red-400/10 rounded-xl transition-all disabled:opacity-50"
            >
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
                  Conecte sua conta do Mercado Livre para publicar produtos e receber pedidos automaticamente.
                </p>
              </div>
            </div>
            <a
              href="/api/portal/ml/connect"
              className="flex items-center gap-2 px-4 py-2.5 bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-sm rounded-xl transition-all flex-shrink-0 whitespace-nowrap"
            >
              <ShoppingBag size={14} /> Conectar conta
            </a>
          </div>
        )}
      </div>

      {/* Como funciona */}
      {!status?.connected && (
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-bold text-white">Como funciona o dropshipping</p>
          <div className="space-y-3">
            {[
              { icon: Zap,          text: "Conecte sua conta ML e navegue pelo catálogo das marcas" },
              { icon: ShoppingBag,  text: "Publique produtos com seu preço de revenda no seu ML" },
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

      {/* Lista de anúncios */}
      {status?.connected && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-white">
              Meus anúncios
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({status.anuncios.length})
              </span>
            </p>
            <a
              href="/portal/marcas"
              className="text-xs text-brand hover:underline"
            >
              + Publicar mais produtos
            </a>
          </div>

          {status.anuncios.length === 0 ? (
            <div className="bg-dark-800 border border-white/8 rounded-2xl py-12 flex flex-col items-center gap-3">
              <Package size={28} className="text-gray-700" />
              <p className="text-sm text-gray-500">Nenhum produto publicado ainda</p>
              <a
                href="/portal/marcas"
                className="text-xs text-brand hover:underline"
              >
                Ir para catálogo de marcas →
              </a>
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
                    <span className="text-sm font-bold text-white flex-shrink-0">
                      {fmt(a.preco_revenda)}
                    </span>
                  )}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    a.ml_status === "active" || a.ml_status === "approved"
                      ? "bg-green-400/15 text-green-400"
                      : "bg-gray-400/15 text-gray-400"
                  }`}>
                    {a.ml_status === "active" || a.ml_status === "approved" ? "Ativo" : a.ml_status}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={`https://www.mercadolivre.com.br/anuncio/${a.ml_item_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                      title="Ver no ML"
                    >
                      <ExternalLink size={13} />
                    </a>
                    <button
                      onClick={() => handleRemoveAnuncio(a)}
                      disabled={removingId === a.id}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all disabled:opacity-50"
                      title="Remover anúncio"
                    >
                      {removingId === a.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : <X size={13} />
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nota sobre webhook */}
      {status?.connected && (
        <div className="flex items-start gap-3 p-4 bg-brand/5 border border-brand/15 rounded-xl">
          <Zap size={13} className="text-brand flex-shrink-0 mt-0.5" />
          <p className="text-xs text-gray-400 leading-relaxed">
            Quando uma venda for concluída no Mercado Livre, o pedido entra automaticamente na marca como{" "}
            <span className="text-white font-semibold">Em separação</span>. A etiqueta de envio já estará
            disponível no pedido da marca.
          </p>
        </div>
      )}
    </div>
  );
}
