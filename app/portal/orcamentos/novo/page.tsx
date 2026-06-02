"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import {
  Search, Plus, Trash2, Loader2, ArrowLeft, CheckCircle2,
  Package, Truck, AlertTriangle, FileText, X, Upload,
} from "lucide-react";

interface Acesso { status: string; bloqueado: boolean; condicoes_pagamento_drop: string[] }
interface Brand  { id: string; slug: string; name: string; segment: string | null; logo_url: string | null; acesso: Acesso | null }
interface Product { id: string; sku: string; name: string; brand: string; price?: number }
interface Item    { produto_sku: string; produto_nome: string; quantidade: number; valor_unitario: number }

const inp = "w-full px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

export default function NovoOrcamentoPage() {
  const router = useRouter();

  const [brands,        setBrands]        = useState<Brand[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(true);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);

  const [tipoPedido,       setTipoPedido]       = useState<"estoque" | "dropshipping" | "">("");
  const [etiquetas,        setEtiquetas]        = useState<File[]>([]);
  const [horarioPostagem,  setHorarioPostagem]  = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [q,             setQ]             = useState("");
  const [results,       setResults]       = useState<Product[]>([]);
  const [searching,     setSearching]     = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  const [items,          setItems]          = useState<Item[]>([]);
  const [condicao,       setCondicao]       = useState<"pix" | "boleto" | "semanal" | "">("");
  const [prazoBoleto,    setPrazoBoleto]    = useState("");
  const [transportadora, setTransportadora] = useState("");
  const [observacoes,    setObservacoes]    = useState("");

  const [loading,    setLoading]    = useState(false);
  const [skuModal,   setSkuModal]   = useState(false);
  const [skuWarning, setSkuWarning] = useState(false);

  useEffect(() => {
    fetch("/api/portal/marcas")
      .then(r => r.json())
      .then(d => setBrands(Array.isArray(d) ? d : []))
      .catch(() => setBrands([]))
      .finally(() => setBrandsLoading(false));
  }, []);

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
        const params = new URLSearchParams({ q });
        if (selectedBrand) params.set("marca", selectedBrand);
        const res  = await fetch(`/api/produtos?${params}`);
        const data = await res.json();
        const seen = new Set<string>();
        const unique = (Array.isArray(data) ? data : []).filter((p: Product) => {
          if (seen.has(p.sku)) return false;
          seen.add(p.sku); return true;
        });
        setResults(unique.slice(0, 10));
      } finally { setSearching(false); }
    }, 300);
  }, [q, selectedBrand]);

  const selectedBrandData = brands.find(b => b.slug === selectedBrand);
  const brandAcesso   = selectedBrandData?.acesso ?? null;
  const dropCondicoes = brandAcesso?.condicoes_pagamento_drop ?? ["pix", "boleto", "semanal"];

  const condicaoLabels: Record<string, string> = { pix: "PIX à vista", boleto: "Boleto", semanal: "Semanal" };

  // Auto-select brand's DROP condition when tipoPedido is dropshipping
  useEffect(() => {
    if (tipoPedido === "dropshipping" && dropCondicoes.length > 0) {
      setCondicao(dropCondicoes[0] as "pix" | "boleto" | "semanal");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoPedido, dropCondicoes[0]]);

  function selectBrand(slug: string) {
    setSelectedBrand(prev => prev === slug ? null : slug);
    setTipoPedido(""); setCondicao(""); setPrazoBoleto("");
    setEtiquetas([]); setHorarioPostagem("");
    setQ(""); setResults([]);
  }

  function addItem(p: Product) {
    const idx = items.findIndex(i => i.produto_sku === p.sku);
    if (idx >= 0) {
      setItems(prev => prev.map((i, n) => n === idx ? { ...i, quantidade: i.quantidade + 1 } : i));
    } else {
      setItems(prev => [...prev, { produto_sku: p.sku, produto_nome: p.name, quantidade: 1, valor_unitario: p.price ?? 0 }]);
    }
    setQ(""); setResults([]);
  }

  function updateItem(idx: number, field: keyof Item, value: number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const novos = Array.from(files).filter(f => !etiquetas.some(e => e.name === f.name));
    setEtiquetas(prev => [...prev, ...novos]);
  }

  function removeEtiqueta(idx: number) {
    setEtiquetas(prev => prev.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, i) => s + i.quantidade * i.valor_unitario, 0);

  function validate(): string | null {
    if (!selectedBrand)    return "Selecione uma marca antes de enviar.";
    if (!tipoPedido)       return "Selecione o tipo de pedido.";
    if (tipoPedido === "dropshipping" && etiquetas.length === 0)
                           return "Adicione ao menos uma etiqueta de envio.";
    if (tipoPedido === "dropshipping" && !horarioPostagem)
                           return "Informe o horário de postagem.";
    if (items.length === 0) return "Adicione ao menos um produto.";
    if (!condicao)         return "Selecione a condição de pagamento.";
    if (condicao === "boleto" && !prazoBoleto.trim())
                           return "Informe o prazo do boleto (ex: 30/45/60).";
    return null;
  }

  async function enviar() {
    setLoading(true);
    try {
      let etiquetasData: { nome: string; url: string }[] = [];

      if (tipoPedido === "dropshipping" && etiquetas.length > 0) {
        const fd = new FormData();
        etiquetas.forEach(f => fd.append("files", f));
        const uploadRes = await fetch("/api/portal/etiquetas", { method: "POST", body: fd });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error ?? "Erro ao enviar etiquetas");
        etiquetasData = uploadData;
      }

      const res = await fetch("/api/portal/orcamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items, condicao,
          prazoBoleto: condicao === "boleto" ? prazoBoleto.trim() : null,
          transportadora, observacoes,
          marca: selectedBrand,
          tipoPedido,
          etiquetas: etiquetasData,
          horarioPostagem: tipoPedido === "dropshipping" ? horarioPostagem : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erro ao enviar pedido");
      router.push(`/portal/orcamentos/${data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar pedido");
    } finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { toast.error(err); return; }

    if (tipoPedido === "dropshipping") {
      setSkuModal(true);
      return;
    }
    await enviar();
  }

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link href="/portal/orcamentos"
            className="flex items-center justify-center w-8 h-8 rounded-lg bg-dark-700 border border-white/10 text-gray-400 hover:text-white hover:border-white/20 transition-all flex-shrink-0"
          >
            <ArrowLeft size={15} />
          </Link>
          <h1 className="text-sm font-bold text-white">Novo Orçamento</h1>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">

        {/* ── Marca ── */}
        <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-white">Selecione a marca</h2>

          {selectedBrand ? (
            (() => {
              const b = brands.find(br => br.slug === selectedBrand)!;
              return (
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-5 flex-1 bg-brand/10 border border-brand/40 ring-1 ring-brand/30 rounded-xl px-5 py-4">
                    <CheckCircle2 size={18} className="text-brand flex-shrink-0" />
                    {b?.logo_url && (
                      <div className="h-14 flex items-center">
                        <Image src={b.logo_url} alt={b.name} width={140} height={56} className="object-contain h-14 w-auto" />
                      </div>
                    )}
                    <div className="w-px h-10 bg-brand/20 flex-shrink-0" />
                    <div>
                      <p className="text-base font-bold text-white">{b?.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{b?.segment}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedBrand(null); setTipoPedido(""); setCondicao(""); setPrazoBoleto(""); setEtiquetas([]); setHorarioPostagem(""); setItems([]); setQ(""); setResults([]); }}
                    className="text-xs text-gray-500 hover:text-white transition-colors whitespace-nowrap px-3 py-2 border border-white/10 rounded-xl hover:border-white/20"
                  >
                    Trocar marca
                  </button>
                </div>
              );
            })()
          ) : (
            brandsLoading ? (
              <div className="flex items-center justify-center py-8 text-gray-600 gap-2">
                <Loader2 size={16} className="animate-spin" /> Carregando marcas...
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {brands.map((b) => (
                  <button key={b.slug} type="button" onClick={() => selectBrand(b.slug)}
                    className="relative flex flex-col items-center gap-3 p-4 rounded-xl border bg-dark-900 border-white/8 hover:border-white/20 hover:bg-white/[0.03] transition-all"
                  >
                    <div className="h-12 flex items-center justify-center">
                      {b.logo_url ? (
                        <Image src={b.logo_url} alt={b.name} width={110} height={48} className="object-contain h-11 w-auto opacity-60 transition-all" />
                      ) : (
                        <span className="text-xs font-bold text-gray-600 uppercase">{b.slug}</span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-center leading-tight text-gray-400 line-clamp-1">{b.name}</span>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* ── Status de acesso à marca ── */}
        {selectedBrand && brandAcesso?.status !== "aprovado" && (
          <div className={`border rounded-2xl p-5 flex items-start gap-4 ${
            !brandAcesso
              ? "bg-dark-800 border-white/8"
              : brandAcesso.status === "pendente"
                ? "bg-yellow-400/5 border-yellow-400/20"
                : "bg-red-400/5 border-red-400/20"
          }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
              !brandAcesso ? "bg-dark-700 border border-white/10" :
              brandAcesso.status === "pendente" ? "bg-yellow-400/10 border border-yellow-400/20" :
              "bg-red-400/10 border border-red-400/20"
            }`}>
              {!brandAcesso
                ? <AlertTriangle size={18} className="text-gray-500" />
                : brandAcesso.status === "pendente"
                  ? <AlertTriangle size={18} className="text-yellow-400" />
                  : <AlertTriangle size={18} className="text-red-400" />}
            </div>
            <div>
              {!brandAcesso ? (
                <>
                  <p className="text-sm font-bold text-white">Acesso não solicitado</p>
                  <p className="text-xs text-gray-500 mt-1">Você ainda não tem acesso a esta marca. Solicite acesso na página <Link href="/portal/marcas" className="text-brand underline">Marcas</Link> e aguarde a aprovação.</p>
                </>
              ) : brandAcesso.status === "pendente" ? (
                <>
                  <p className="text-sm font-bold text-yellow-400">Aguardando aprovação</p>
                  <p className="text-xs text-gray-500 mt-1">Sua solicitação de acesso está sendo analisada pela marca. Você será notificado quando aprovado.</p>
                </>
              ) : brandAcesso.bloqueado ? (
                <>
                  <p className="text-sm font-bold text-orange-400">Conta bloqueada</p>
                  <p className="text-xs text-gray-500 mt-1">Sua conta está bloqueada para pedidos desta marca. Entre em contato com a PH Representante.</p>
                </>
              ) : (
                <>
                  <p className="text-sm font-bold text-red-400">Acesso recusado</p>
                  <p className="text-xs text-gray-500 mt-1">Sua solicitação de acesso foi recusada pela marca. Entre em contato com a PH Representante.</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Tipo de Pedido ── */}
        {selectedBrand && brandAcesso?.status === "aprovado" && !brandAcesso.bloqueado && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Tipo de pedido</h2>
            <div className="grid grid-cols-2 gap-3">

              <button type="button" onClick={() => { setTipoPedido("estoque"); setEtiquetas([]); setCondicao(""); setPrazoBoleto(""); }}
                className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all ${
                  tipoPedido === "estoque"
                    ? "bg-brand/10 border-brand/40 ring-1 ring-brand/30"
                    : "bg-dark-900 border-white/8 hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                {tipoPedido === "estoque" && <CheckCircle2 size={14} className="text-brand self-end -mb-1" />}
                <Package size={28} className={tipoPedido === "estoque" ? "text-brand" : "text-gray-500"} />
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Estoque</p>
                  <p className="text-xs text-gray-500 mt-1">Produtos para seu estoque</p>
                </div>
              </button>

              <button type="button" onClick={() => { setTipoPedido("dropshipping"); setCondicao(""); setPrazoBoleto(""); }}
                className={`flex flex-col items-center gap-3 p-5 rounded-xl border transition-all ${
                  tipoPedido === "dropshipping"
                    ? "bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/30"
                    : "bg-dark-900 border-white/8 hover:border-white/20 hover:bg-white/[0.03]"
                }`}
              >
                {tipoPedido === "dropshipping" && <CheckCircle2 size={14} className="text-blue-400 self-end -mb-1" />}
                <Truck size={28} className={tipoPedido === "dropshipping" ? "text-blue-400" : "text-gray-500"} />
                <div className="text-center">
                  <p className="text-sm font-bold text-white">Dropshipping</p>
                  <p className="text-xs text-gray-500 mt-1">Envio direto ao cliente final</p>
                </div>
              </button>

            </div>
          </div>
        )}

        {/* ── Etiquetas (Dropshipping) ── */}
        {tipoPedido === "dropshipping" && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white">Etiquetas de envio</h2>
              <p className="text-xs text-gray-500 mt-1">
                Anexe as etiquetas dos seus clientes. As etiquetas devem conter o <span className="text-white font-semibold">SKU do produto</span> para separação — sem isso a marca pode rejeitar o pedido.
              </p>
            </div>

            {/* Upload area */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
              className="w-full flex flex-col items-center gap-3 px-6 py-8 border-2 border-dashed border-white/15 rounded-xl hover:border-brand/40 hover:bg-brand/5 transition-all group"
            >
              <Upload size={24} className="text-gray-600 group-hover:text-brand transition-colors" />
              <div className="text-center">
                <p className="text-sm text-gray-400 group-hover:text-white transition-colors">Clique ou arraste os arquivos aqui</p>
                <p className="text-xs text-gray-600 mt-0.5">PDF, PNG, JPG — múltiplos arquivos permitidos</p>
              </div>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />

            {/* Lista de arquivos */}
            {etiquetas.length > 0 && (
              <div className="space-y-2">
                {etiquetas.map((f, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 bg-dark-900 rounded-xl border border-white/8">
                    <FileText size={14} className="text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-300 flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-gray-600 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
                    <button type="button" onClick={() => removeEtiqueta(i)}
                      className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0 p-0.5"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Horário de postagem */}
            <div>
              <label className={lbl}>Horário limite de postagem *</label>
              <input
                type="datetime-local"
                value={horarioPostagem}
                onChange={(e) => setHorarioPostagem(e.target.value)}
                required
                className={inp}
              />
              <p className="text-xs text-gray-600 mt-1.5">
                Data e hora até quando os pedidos devem ser postados pela marca.
              </p>
            </div>
          </div>
        )}

        {/* ── Produtos ── */}
        {tipoPedido && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">
              Produtos
              {selectedBrand && (
                <span className="ml-2 text-xs text-brand font-normal">
                  — {brands.find(b => b.slug === selectedBrand)?.name}
                </span>
              )}
            </h2>

            <div ref={searchRef} className="relative">
              <label className={lbl}>Buscar por SKU ou nome</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Digite o SKU ou nome do produto..."
                  className={`${inp} pl-9`}
                  autoComplete="off"
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
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr className="text-xs text-gray-500 border-b border-white/8">
                      <th className="text-left pb-2.5 font-semibold pl-1">Produto</th>
                      <th className="text-center pb-2.5 font-semibold w-24">Qtd</th>
                      <th className="text-right pb-2.5 font-semibold w-36 pr-1">Valor unit. (R$)</th>
                      <th className="text-right pb-2.5 font-semibold w-28 pr-1">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {items.map((item, idx) => (
                      <tr key={`${item.produto_sku}-${idx}`}>
                        <td className="py-3 pl-1">
                          <p className="text-[11px] font-bold text-brand/80 tracking-wide">{item.produto_sku}</p>
                          <p className="text-sm text-white font-medium leading-snug">{item.produto_nome}</p>
                        </td>
                        <td className="py-3 px-2">
                          <input type="number" min={1} value={item.quantidade}
                            onChange={(e) => updateItem(idx, "quantidade", Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 px-2 py-1.5 bg-dark-900 border border-white/10 rounded-lg text-white text-center text-sm focus:outline-none focus:border-brand/50"
                          />
                        </td>
                        <td className="py-3 px-1">
                          <input type="number" min={0} step={0.01} value={item.valor_unitario || ""}
                            onChange={(e) => updateItem(idx, "valor_unitario", parseFloat(e.target.value) || 0)}
                            placeholder="0,00"
                            className="w-32 px-2 py-1.5 bg-dark-900 border border-white/10 rounded-lg text-white text-right text-sm focus:outline-none focus:border-brand/50 ml-auto block"
                          />
                        </td>
                        <td className="py-3 pr-1 text-right font-medium text-white whitespace-nowrap">
                          {(item.quantidade * item.valor_unitario).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                        </td>
                        <td className="py-3">
                          <button type="button" onClick={() => removeItem(idx)} className="text-gray-600 hover:text-red-400 transition-colors p-1">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-white/8">
                      <td colSpan={3} className="pt-3 text-sm text-gray-400 font-semibold text-right pr-2">Total</td>
                      <td className="pt-3 text-right font-black text-white pr-1">
                        {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <p className="text-xs text-gray-600 text-center py-6">Nenhum produto adicionado. Busque pelo nome ou SKU acima.</p>
            )}
          </div>
        )}

        {/* ── Condições ── */}
        {tipoPedido && (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">Condições</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>Condição de pagamento *</label>
                {tipoPedido === "dropshipping" ? (
                  <div className="flex items-center gap-3 px-4 py-3 bg-brand/8 border border-brand/20 rounded-xl">
                    <CheckCircle2 size={15} className="text-brand flex-shrink-0" />
                    <div>
                      <p className="text-[11px] text-gray-500">Definida pelo fornecedor</p>
                      <p className="text-sm font-bold text-white">{condicaoLabels[dropCondicoes[0]] ?? dropCondicoes[0]}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      {[{ value: "pix", label: "PIX" }, { value: "boleto", label: "Boleto" }].map(({ value, label }) => (
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
                    {condicao === "boleto" && (
                      <div className="mt-3 space-y-2">
                        <label className={lbl}>Prazo (dias) *</label>
                        <input value={prazoBoleto} onChange={(e) => setPrazoBoleto(e.target.value)} placeholder="Ex: 30/45/60" className={inp} />
                        <p className="text-xs text-gray-600">Sujeito a análise de crédito</p>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div>
                <label className={lbl}>Transportadora</label>
                <input value={transportadora} onChange={(e) => setTransportadora(e.target.value)} placeholder="Nome da transportadora..." className={inp} />
              </div>
            </div>
            <div>
              <label className={lbl}>Observações</label>
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais para o representante..." rows={3}
                className={`${inp} resize-none`} />
            </div>
          </div>
        )}

        {tipoPedido && (
          <button type="submit" disabled={loading}
            className="w-full py-3.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? "Enviando..." : "Enviar orçamento"}
          </button>
        )}
      </form>

      {/* ── Modal: Verificação SKU ── */}
      {skuModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={18} className="text-yellow-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Verificação de etiquetas</h3>
                <p className="text-xs text-gray-500 mt-0.5">Antes de enviar o pedido dropshipping</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              As etiquetas anexadas mostram o <span className="text-white font-semibold">SKU do produto</span> para separação?
            </p>
            <p className="text-xs text-gray-600 bg-dark-900 rounded-xl px-3 py-2.5 border border-white/6">
              Sem o SKU nas etiquetas, a marca não consegue identificar qual produto separar para cada cliente e pode rejeitar o pedido.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setSkuModal(false); setSkuWarning(true); }}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm hover:border-white/20 transition-all"
              >
                Não contêm SKU
              </button>
              <button
                onClick={async () => { setSkuModal(false); await enviar(); }}
                disabled={loading}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Sim, têm SKU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Aviso sem SKU ── */}
      {skuWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-800 border border-red-400/20 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-400/10 border border-red-400/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Atenção — risco de rejeição</h3>
                <p className="text-xs text-gray-500 mt-0.5">Etiquetas sem SKU identificado</p>
              </div>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              Pedidos com etiquetas <span className="text-red-400 font-semibold">sem SKU</span> podem ser <span className="text-red-400 font-semibold">rejeitados pela marca</span> por impossibilidade de separação dos produtos.
            </p>
            <p className="text-sm text-gray-400">Deseja enviar mesmo assim ou corrigir as etiquetas?</p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setSkuWarning(false)}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm hover:border-white/20 transition-all"
              >
                Corrigir etiquetas
              </button>
              <button
                onClick={async () => { setSkuWarning(false); await enviar(); }}
                disabled={loading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {loading && <Loader2 size={13} className="animate-spin" />}
                Enviar assim mesmo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
