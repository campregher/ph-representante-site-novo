"use client";

import { useState, useEffect, useRef, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { Search, Plus, Trash2, Loader2, ArrowLeft, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Brand    { slug: string; name: string; segment: string | null; logo_url: string | null }
interface Product  { id: string; sku: string; name: string; brand: string; price?: number }
interface Item     { produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number }

const inp = "w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

export default function EditarOrcamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [loading,      setLoading]      = useState(true);
  const [numero,       setNumero]       = useState<number | null>(null);
  const [statusOrc,    setStatusOrc]    = useState<string>("");
  const [marca,        setMarca]        = useState<string | null>(null);
  const [brandData,    setBrandData]    = useState<Brand | null>(null);
  const [items,        setItems]        = useState<Item[]>([]);
  const [tipoPedido,   setTipoPedido]   = useState<"estoque" | "dropshipping" | "">("");
  const [condicao,     setCondicao]     = useState<"pix" | "boleto" | "semanal" | "">("");
  const [prazoBoleto,  setPrazoBoleto]  = useState("");
  const [transp,       setTransp]       = useState("");
  const [obs,          setObs]          = useState("");
  const [motivo,       setMotivo]       = useState("");
  const [error,        setError]        = useState<string | null>(null);
  const [submitting,   setSubmitting]   = useState(false);

  const [q,          setQ]          = useState("");
  const [results,    setResults]    = useState<Product[]>([]);
  const [searching,  setSearching]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("orcamentos")
        .select("numero, status, marca, tipo_pedido, condicao_pagamento, prazo_boleto, transportadora, observacoes, orcamento_itens(*)")
        .eq("id", id)
        .single();

      if (data) {
        setNumero(data.numero);
        setStatusOrc(data.status ?? "");
        const marcaSlug = data.marca ?? null;
        setMarca(marcaSlug);
        if (marcaSlug) {
          fetch(`/api/portal/marcas`)
            .then(r => r.json())
            .then((d: Brand[]) => setBrandData(Array.isArray(d) ? (d.find(b => b.slug === marcaSlug) ?? null) : null))
            .catch(() => {});
        }
        setTipoPedido((data.tipo_pedido as "estoque" | "dropshipping") ?? "estoque");
        setCondicao((data.condicao_pagamento as "pix" | "boleto" | "semanal") ?? "");
        setPrazoBoleto(data.prazo_boleto ?? "");
        setTransp(data.transportadora ?? "");
        setObs(data.observacoes ?? "");
        setItems(
          (data.orcamento_itens as Item[]).map((i) => ({
            produto_sku:    i.produto_sku,
            produto_nome:   i.produto_nome,
            quantidade:     i.quantidade,
            valor_unitario: Number(i.valor_unitario),
          }))
        );
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setResults([]);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const p = new URLSearchParams({ q });
        if (marca) p.set("marca", marca);
        const res  = await fetch(`/api/produtos?${p}`);
        const data = await res.json();
        const seen = new Set<string>();
        const unique = (Array.isArray(data) ? data : []).filter((p: Product) => {
          if (seen.has(p.sku)) return false;
          seen.add(p.sku); return true;
        });
        setResults(unique.slice(0, 8));
      } finally { setSearching(false); }
    }, 300);
  }, [q, marca]);

  function addItem(p: Product) {
    const idx = items.findIndex((i) => i.produto_sku === p.sku);
    if (idx >= 0) {
      setItems((prev) => prev.map((i, n) => n === idx ? { ...i, quantidade: i.quantidade + 1 } : i));
    } else {
      setItems((prev) => [...prev, { produto_sku: p.sku, produto_nome: p.name, quantidade: 1, valor_unitario: p.price ?? 0 }]);
    }
    setQ(""); setResults([]);
  }

  function updateQtd(idx: number, value: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, quantidade: value } : item));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  const isApproved = statusOrc === "aprovado";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.length === 0)  { toast.error("Adicione ao menos um produto."); return; }
    if (!condicao)           { toast.error("Selecione a condição de pagamento."); return; }
    if (condicao === "boleto" && !prazoBoleto.trim()) { toast.error("Informe o prazo do boleto (ex: 30/45/60)."); return; }
    if (isApproved && !motivo.trim()) { toast.error("Descreva o motivo da alteração para notificar o fornecedor."); return; }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/portal/orcamentos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          condicao,
          prazoBoleto: condicao === "boleto" ? prazoBoleto.trim() : null,
          transportadora: transp,
          observacoes: obs,
          ...(isApproved ? { action: "editar_aprovado", motivo: motivo.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao salvar");
      toast.success("Pedido atualizado com sucesso!");
      router.push(`/portal/orcamentos/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar pedido");
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 size={24} className="text-gray-500 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href={`/portal/orcamentos/${id}`}
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all flex-shrink-0"
          >
            <ArrowLeft size={15} />
          </Link>
          <h1 className="text-sm font-bold text-white">Editar Pedido #{numero}</h1>
          {isApproved && (
            <span className="ml-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-400 border border-yellow-400/25">
              Pedido aprovado — alteração notificará o fornecedor
            </span>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {isApproved && (
          <div className="flex items-start gap-3 px-4 py-3.5 bg-yellow-400/10 border border-yellow-400/20 rounded-2xl">
            <AlertTriangle size={15} className="text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-300">
              Este pedido já foi aprovado. Qualquer alteração enviará uma notificação automática ao fornecedor com o resumo das mudanças.
            </p>
          </div>
        )}

        {/* Marca (bloqueada) */}
        {brandData && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-4 flex items-center gap-4">
            {brandData.logo_url && (
              <div className="h-9 flex items-center">
                <Image src={brandData.logo_url} alt={brandData.name} width={80} height={36} className="object-contain h-8 w-auto" />
              </div>
            )}
            <div className="w-px h-7 bg-white/10" />
            <div>
              <p className="text-xs font-bold text-white">{brandData.name}</p>
              <p className="text-[11px] text-gray-500">{brandData.segment}</p>
            </div>
            <span className="ml-auto text-[10px] font-semibold text-gray-600 uppercase tracking-wider">Marca do pedido</span>
          </div>
        )}

        {/* Produtos */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">
            Produtos
            {brandData && <span className="ml-2 text-xs text-brand font-normal">— {brandData.name}</span>}
          </h2>

          <div ref={searchRef} className="relative">
            <label className={lbl}>Buscar por SKU ou nome</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              <input value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Digite o SKU ou nome do produto..."
                className={`${inp} pl-9`} autoComplete="off"
              />
              {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />}
            </div>
            {results.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-dark-800 border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                {results.map((p, i) => (
                  <button key={`${p.sku}-${i}`} type="button" onMouseDown={() => addItem(p)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <div>
                      <p className="text-sm text-white font-medium">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{p.sku}</p>
                    </div>
                    <Plus size={14} className="text-brand flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 ? (
            <div className="space-y-0 divide-y divide-white/5 border border-white/8 rounded-xl overflow-hidden">
              <div className="hidden sm:grid grid-cols-[1fr_80px_100px_32px] gap-2 px-3 py-2 bg-white/3 text-[11px] text-gray-500 font-semibold">
                <span>Produto</span>
                <span className="text-center">Qtd</span>
                <span className="text-right">Total</span>
                <span />
              </div>

              {items.map((item, idx) => {
                const rowTotal = item.quantidade * item.valor_unitario;
                return (
                  <div key={`${item.produto_sku}-${idx}`} className="px-3 py-3">
                    {/* Desktop */}
                    <div className="hidden sm:grid grid-cols-[1fr_80px_100px_32px] gap-2 items-center">
                      <div>
                        <p className="text-[10px] font-bold text-brand/80 tracking-wider">{item.produto_sku}</p>
                        <p className="text-sm text-white font-medium leading-snug mt-0.5">{item.produto_nome}</p>
                      </div>
                      <input type="number" min={1} value={item.quantidade}
                        onChange={(e) => updateQtd(idx, Math.max(1, parseInt(e.target.value) || 1))}
                        className="w-full px-2 py-1.5 bg-dark-900 border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:border-brand/50"
                      />
                      <p className="text-sm font-semibold text-white text-right whitespace-nowrap">
                        {rowTotal > 0 ? rowTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : <span className="text-gray-600 text-xs">A definir</span>}
                      </p>
                      <button type="button" onClick={() => removeItem(idx)}
                        className="text-gray-600 hover:text-red-400 transition-colors p-1 flex items-center justify-center"
                      ><Trash2 size={13} /></button>
                    </div>

                    {/* Mobile */}
                    <div className="sm:hidden">
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-brand/80 tracking-wider">{item.produto_sku}</p>
                          <p className="text-sm text-white font-medium leading-snug mt-0.5">{item.produto_nome}</p>
                        </div>
                        <button type="button" onClick={() => removeItem(idx)}
                          className="text-gray-600 hover:text-red-400 transition-colors p-1 flex-shrink-0 mt-0.5"
                        ><Trash2 size={13} /></button>
                      </div>
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Qtd</p>
                          <input type="number" min={1} value={item.quantidade}
                            onChange={(e) => updateQtd(idx, Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-2 py-1.5 bg-dark-900 border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:border-brand/50"
                          />
                        </div>
                        {rowTotal > 0 && (
                          <div className="text-right ml-auto">
                            <p className="text-[10px] text-gray-500 mb-1">Total</p>
                            <p className="text-sm font-bold text-white">{rowTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center justify-between px-3 py-2.5 bg-white/3">
                <span className="text-xs text-gray-500 font-semibold">Total geral</span>
                <span className="text-sm font-black text-white">
                  {items.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0) > 0
                    ? items.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : <span className="text-gray-500">A definir</span>}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-600 text-center py-4">Nenhum produto. Busque pelo nome ou SKU acima.</p>
          )}
        </div>

        {/* Condições */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Condições</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={lbl}>Condição de pagamento *</label>
              <div className="flex gap-2">
                {(tipoPedido === "dropshipping"
                  ? [{ value: "pix", label: "PIX" }, { value: "semanal", label: "Semanal" }]
                  : [{ value: "pix", label: "PIX" }, { value: "boleto", label: "Boleto" }]
                ).map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => { setCondicao(value as typeof condicao); setPrazoBoleto(""); }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                      condicao === value ? "bg-brand border-brand text-white" : "bg-dark-900 border-white/10 text-gray-400 hover:border-white/25"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {condicao === "semanal" && (
                <p className="mt-2 text-xs text-gray-500 bg-dark-900 rounded-xl px-3 py-2 border border-white/8">
                  Pedidos serão agrupados e faturados toda sexta-feira.
                </p>
              )}
              {condicao === "boleto" && (
                <div className="mt-3 space-y-2">
                  <label className={lbl}>Prazo (dias) *</label>
                  <input value={prazoBoleto} onChange={(e) => setPrazoBoleto(e.target.value)} placeholder="Ex: 30/45/60" className={inp} />
                  <p className="text-xs text-gray-600">Sujeito a análise de crédito</p>
                </div>
              )}
            </div>
            <div>
              <label className={lbl}>Transportadora</label>
              <input value={transp} onChange={(e) => setTransp(e.target.value)} placeholder="Nome da transportadora..." className={inp} />
            </div>
          </div>
          <div>
            <label className={lbl}>Observações</label>
            <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={`${inp} resize-none`} />
          </div>
        </div>

        {/* Motivo da alteração — obrigatório para pedidos aprovados */}
        {isApproved && (
          <div className="bg-dark-800 border border-yellow-400/20 rounded-2xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-yellow-400 flex items-center gap-2">
              <AlertTriangle size={14} /> Motivo da alteração *
            </h2>
            <p className="text-xs text-gray-500">Informe o que mudou. Essa mensagem será enviada ao fornecedor.</p>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ex: Adicionei mais 2 unidades do produto X, removi o produto Y..."
              className={`${inp} resize-none border-yellow-400/20 focus:border-yellow-400/50`}
            />
          </div>
        )}

        {error && (
          <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-3">{error}</p>
        )}

        <button type="submit" disabled={submitting}
          className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
        >
          {submitting && <Loader2 size={15} className="animate-spin" />}
          {submitting ? "Salvando..." : isApproved ? "Salvar e notificar fornecedor" : "Salvar alterações"}
        </button>
      </form>
    </div>
  );
}
