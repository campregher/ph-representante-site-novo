"use client";

import { useState, useEffect, use, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, ShoppingBag, Package, Plus,
  Star, AlertCircle, CheckCircle2, ChevronRight,
  Info, Car, Tag, FileText, DollarSign,
  Download, Upload, Search, Pencil, Trash2,
  ToggleLeft, ToggleRight, X, TableProperties, Send, ExternalLink,
  CheckSquare, Square, Minus,
} from "lucide-react";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";
import { calcQualityScore } from "@/components/marca/QualityIndicator";
import { toast } from "sonner";

/* ─── types ─────────────────────────────────────── */

interface Categoria {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ativa: boolean;
  ml_category_id: string | null;
  ml_category_name: string | null;
  ml_category_path: string[] | null;
}

interface Atributo {
  id: string;
  name: string;
  value_type: string;
  required: boolean;
  multivalued: boolean;
  values: { id: string; name: string }[];
  hint: string | null;
  default_unit: string | null;
  allowed_units: { id: string; name: string }[];
  attribute_group_id: string;
  attribute_group_name: string;
}

interface Produto {
  id: string;
  sku: string;
  name: string;
  price?: number;
  resale_price?: number;
  active: boolean;
  images: string[];
  ml_category_id?: string;
  attributes?: Record<string, string>;
  ml_item_id?: string;
  ml_status?: string;
}

type Tab = "produtos" | "campos";

/* ─── seções de campos estáticos ────────────────── */

const VALUE_TYPE_LABEL: Record<string, string> = {
  string:      "Texto",
  number:      "Número",
  boolean:     "Sim/Não",
  list:        "Opções",
  number_unit: "Número + unidade",
  imagens:     "Imagens",
};

interface StaticField { name: string; hint: string; type: string }

const SECOES_ESTATICAS: { icon: React.ElementType; title: string; fields: StaticField[] }[] = [
  {
    icon: FileText,
    title: "Informações do produto",
    fields: [
      { name: "Nome / Título",   hint: "Título que aparecerá no anúncio",        type: "string"  },
      { name: "SKU",             hint: "Código interno do produto",               type: "string"  },
      { name: "Descrição",       hint: "Descrição detalhada do produto",          type: "string"  },
      { name: "Fotos",           hint: "Mínimo 1 imagem, máximo 5",              type: "imagens" },
      { name: "Condição",        hint: "Novo, Usado ou Recondicionado",           type: "list"    },
    ],
  },
  {
    icon: DollarSign,
    title: "Condições do anúncio",
    fields: [
      { name: "Preço",           hint: "Preço de venda em reais",                type: "number"  },
      { name: "Estoque",         hint: "Quantidade disponível",                  type: "number"  },
      { name: "Tipo de anúncio", hint: "Clássico ou Premium",                    type: "list"    },
    ],
  },
  {
    icon: Car,
    title: "Compatibilidade veicular",
    fields: [
      { name: "Montadora",       hint: "Ex: Volkswagen, Ford, Chevrolet",        type: "list"    },
      { name: "Modelo",          hint: "Ex: Gol, Ka, Onix",                      type: "list"    },
      { name: "Ano",             hint: "Ano de fabricação do veículo",           type: "list"    },
    ],
  },
];

/* ─── helpers de UI ──────────────────────────────── */

function FieldTypeBadge({ type }: { type: string }) {
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/5 text-gray-500 font-medium">
      {VALUE_TYPE_LABEL[type] ?? type}
    </span>
  );
}

function Secao({
  icon: Icon, title, badge, children,
}: {
  icon: React.ElementType; title: string; badge?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-white/6">
        <div className="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
          <Icon size={13} className="text-brand" />
        </div>
        <p className="text-sm font-bold text-white flex-1">{title}</p>
        {badge}
      </div>
      <div className="divide-y divide-white/4">{children}</div>
    </div>
  );
}

function FieldRow({ name, hint, type, required, values }: {
  name: string; hint?: string | null; type: string; required?: boolean;
  values?: { id: string; name: string }[];
}) {
  return (
    <div className="px-5 py-3.5 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm text-white font-medium">{name}</p>
          {required && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-400/15 text-red-400">
              Obrigatório
            </span>
          )}
        </div>
        {hint && <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{hint}</p>}
        {values && values.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {values.slice(0, 8).map(v => (
              <span key={v.id} className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-400 rounded-lg">{v.name}</span>
            ))}
            {values.length > 8 && (
              <span className="text-[10px] px-2 py-0.5 bg-white/5 text-gray-500 rounded-lg">+{values.length - 8}</span>
            )}
          </div>
        )}
      </div>
      <FieldTypeBadge type={type} />
    </div>
  );
}

/* ─── page ───────────────────────────────────────── */

export default function CategoriaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router  = useRouter();

  const [tab,        setTab]        = useState<Tab>("produtos");
  const [cat,        setCat]        = useState<Categoria | null>(null);
  const [atributos,  setAtributos]  = useState<Atributo[]>([]);
  const [produtos,   setProdutos]   = useState<Produto[]>([]);
  const [loadingCat, setLoadingCat] = useState(true);
  const [loadingAttr,setLoadingAttr]= useState(false);
  const [loadingProd,setLoadingProd]= useState(false);
  const [search,     setSearch]     = useState("");
  const [delId,      setDelId]      = useState<string | null>(null);
  const [deleting,   setDeleting]   = useState(false);
  const [toggling,   setToggling]   = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);

  /* importação */
  const [importModal, setImportModal] = useState(false);
  const [importing,   setImporting]   = useState(false);
  const [importFile,  setImportFile]  = useState<File | null>(null);
  const [importResult,setImportResult]= useState<{ count: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ── seleção / bulk edit ── */
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());
  const [bulkLoading,    setBulkLoading]    = useState(false);
  const [bulkPriceModal, setBulkPriceModal] = useState(false);
  const [bulkPrecoInput, setBulkPrecoInput] = useState("");
  const [bulkDelModal,   setBulkDelModal]   = useState(false);

  /* carrega categoria */
  useEffect(() => {
    setLoadingCat(true);
    fetch(`/api/marca/categorias/${id}`)
      .then(r => r.json())
      .then(d => setCat(d.error ? null : d))
      .catch(() => setCat(null))
      .finally(() => setLoadingCat(false));
  }, [id]);

  /* carrega atributos ML e produtos */
  useEffect(() => {
    if (!cat?.ml_category_id) { setAtributos([]); setProdutos([]); return; }

    setLoadingAttr(true);
    fetch(`/api/ml/atributos?category_id=${cat.ml_category_id}`)
      .then(r => r.json())
      .then(d => setAtributos(Array.isArray(d) ? d : []))
      .catch(() => setAtributos([]))
      .finally(() => setLoadingAttr(false));

    loadProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat?.ml_category_id]);

  /* limpa seleção quando lista muda */
  useEffect(() => { setSelectedIds(new Set()); }, [produtos]);

  async function handlePublish(p: Produto) {
    setPublishing(p.id);
    try {
      const res  = await fetch(`/api/marca/produtos/${p.id}/ml-publish`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Anúncio publicado no Mercado Livre!");
      setProdutos(prev => prev.map(x => x.id === p.id
        ? { ...x, ml_item_id: data.ml_item_id, ml_status: data.ml_status }
        : x
      ));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao publicar");
    } finally {
      setPublishing(null);
    }
  }

  function loadProducts() {
    if (!cat?.ml_category_id) return;
    setLoadingProd(true);
    fetch(`/api/marca/produtos?ml_category_id=${cat.ml_category_id}`)
      .then(r => r.json())
      .then(d => setProdutos(Array.isArray(d) ? d : []))
      .catch(() => setProdutos([]))
      .finally(() => setLoadingProd(false));
  }

  async function handleDelete(pid: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/marca/produtos/${pid}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao excluir");
      toast.success("Produto excluído.");
      setProdutos(prev => prev.filter(p => p.id !== pid));
      setDelId(null);
    } catch { toast.error("Erro ao excluir produto"); }
    finally { setDeleting(false); }
  }

  async function handleToggle(p: Produto) {
    setToggling(p.id);
    try {
      const res = await fetch(`/api/marca/produtos/${p.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: !p.active }),
      });
      if (!res.ok) throw new Error();
      setProdutos(prev => prev.map(x => x.id === p.id ? { ...x, active: !p.active } : x));
    } catch { toast.error("Erro ao alterar status"); }
    finally { setToggling(null); }
  }

  async function handleImport() {
    if (!importFile) { toast.error("Selecione um arquivo"); return; }
    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", importFile);
      fd.append("categoria_id", id);
      const res  = await fetch("/api/marca/produtos/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setImportResult({ count: data.count });
      toast.success(`${data.count} produto${data.count !== 1 ? "s" : ""} importado${data.count !== 1 ? "s" : ""}!`);
      loadProducts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao importar planilha");
    } finally {
      setImporting(false);
    }
  }

  /* ── bulk actions ── */
  function toggleSelect(pid: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === produtosFiltrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(produtosFiltrados.map(p => p.id)));
    }
  }

  async function handleBulkActive(active: boolean) {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/marca/produtos/batch", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: [...selectedIds], patch: { active } }),
      });
      if (!res.ok) throw new Error();
      const label = active ? "ativados" : "desativados";
      toast.success(`${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""} ${label}.`);
      setProdutos(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, active } : p));
      setSelectedIds(new Set());
    } catch { toast.error("Erro ao atualizar produtos"); }
    finally { setBulkLoading(false); }
  }

  async function handleBulkPrice() {
    const val = Number(bulkPrecoInput.replace(",", "."));
    if (!val || val <= 0) { toast.error("Preço inválido"); return; }
    setBulkLoading(true);
    try {
      const res = await fetch("/api/marca/produtos/batch", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: [...selectedIds], patch: { resale_price: val } }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Preço atualizado em ${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""}.`);
      setProdutos(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, resale_price: val } : p));
      setSelectedIds(new Set());
      setBulkPriceModal(false);
      setBulkPrecoInput("");
    } catch { toast.error("Erro ao atualizar preço"); }
    finally { setBulkLoading(false); }
  }

  async function handleBulkDelete() {
    setBulkLoading(true);
    try {
      const res = await fetch("/api/marca/produtos/batch", {
        method:  "DELETE",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids: [...selectedIds] }),
      });
      if (!res.ok) throw new Error();
      toast.success(`${selectedIds.size} produto${selectedIds.size !== 1 ? "s" : ""} excluído${selectedIds.size !== 1 ? "s" : ""}.`);
      setProdutos(prev => prev.filter(p => !selectedIds.has(p.id)));
      setSelectedIds(new Set());
      setBulkDelModal(false);
    } catch { toast.error("Erro ao excluir produtos"); }
    finally { setBulkLoading(false); }
  }

  /* filtro de busca */
  const produtosFiltrados = produtos.filter(p =>
    !search.trim() ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const allSelected     = produtosFiltrados.length > 0 && selectedIds.size === produtosFiltrados.length;
  const someSelected    = selectedIds.size > 0 && !allSelected;
  const anySelected     = selectedIds.size > 0;

  /* ── loading / not found ── */
  if (loadingCat) {
    return (
      <div className="min-h-screen">
        <MarcaContentHeader title="Categoria" />
        <div className="flex items-center justify-center gap-2 py-32 text-gray-500 text-sm">
          <Loader2 size={16} className="animate-spin" /> Carregando...
        </div>
      </div>
    );
  }

  if (!cat) {
    return (
      <div className="min-h-screen">
        <MarcaContentHeader title="Categoria" />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <AlertCircle size={32} className="text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">Categoria não encontrada.</p>
          <button onClick={() => router.back()} className="mt-5 text-xs text-brand hover:underline">← Voltar</button>
        </div>
      </div>
    );
  }

  const required  = atributos.filter(a => a.required);
  const optional  = atributos.filter(a => !a.required);

  return (
    <div className="min-h-screen pb-24">
      <MarcaContentHeader title={cat.nome} />

      {/* Toolbar */}
      <div className="bg-dark-900 border-b border-white/8 sticky top-[53px] z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/marca/produtos")}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors mr-auto"
          >
            <ArrowLeft size={14} /> Produtos
          </button>

          {/* Abas */}
          <div className="flex bg-dark-800 rounded-xl border border-white/8 p-0.5">
            <button
              onClick={() => setTab("produtos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === "produtos" ? "bg-brand text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <TableProperties size={12} /> Produtos
            </button>
            <button
              onClick={() => setTab("campos")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                tab === "campos" ? "bg-brand text-white" : "text-gray-400 hover:text-white"
              }`}
            >
              <FileText size={12} /> Ficha técnica
            </button>
          </div>
        </div>
      </div>

      {/* ══ ABA PRODUTOS ══════════════════════════════════════════ */}
      {tab === "produtos" && (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-4">

          {/* Cabeçalho + ações */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                <Tag size={15} className="text-brand" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold text-white truncate">{cat.nome}</h1>
                {cat.ml_category_id ? (
                  <p className="text-[11px] text-yellow-400/80 truncate">{cat.ml_category_path?.join(" › ") ?? cat.ml_category_name}</p>
                ) : (
                  <p className="text-[11px] text-gray-600">Sem vínculo ML</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {cat.ml_category_id && (
                <>
                  <a
                    href={`/api/marca/categorias/${id}/template`}
                    download
                    className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    <Download size={12} /> Baixar template
                  </a>
                  <button
                    onClick={() => { setImportFile(null); setImportResult(null); setImportModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-xs font-semibold rounded-xl transition-all"
                  >
                    <Upload size={12} /> Importar
                  </button>
                </>
              )}
              <button
                onClick={() => router.push(`/marca/produtos/novo?categoria=${id}`)}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
              >
                <Plus size={14} /> Novo produto
              </button>
            </div>
          </div>

          {/* Barra de busca + contador */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nome ou SKU..."
                className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-white/8 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 transition-all"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-500 flex-shrink-0">
              {loadingProd ? "..." : `${produtosFiltrados.length} produto${produtosFiltrados.length !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Tabela */}
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
            {loadingProd ? (
              <div className="flex items-center justify-center gap-2 py-16 text-gray-500 text-sm">
                <Loader2 size={16} className="animate-spin" /> Carregando produtos...
              </div>
            ) : produtosFiltrados.length === 0 ? (
              <div className="py-16 text-center">
                <Package size={28} className="text-gray-700 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  {search ? "Nenhum produto encontrado" : "Nenhum produto nesta categoria"}
                </p>
                {!search && (
                  <div className="mt-5 flex items-center justify-center gap-3">
                    <button
                      onClick={() => router.push(`/marca/produtos/novo?categoria=${id}`)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
                    >
                      <Plus size={13} /> Cadastrar produto
                    </button>
                    {cat.ml_category_id && (
                      <button
                        onClick={() => { setImportFile(null); setImportResult(null); setImportModal(true); }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-dark-700 border border-white/10 text-gray-300 text-sm rounded-xl transition-all hover:border-white/20"
                      >
                        <Upload size={13} /> Importar planilha
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 bg-dark-900/50">
                      {/* Checkbox select-all */}
                      <th className="px-4 py-3 w-10">
                        <button
                          onClick={toggleSelectAll}
                          className="flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                          title={allSelected ? "Desmarcar todos" : "Selecionar todos"}
                        >
                          {allSelected
                            ? <CheckSquare size={15} className="text-brand" />
                            : someSelected
                              ? <Minus size={15} className="text-brand" />
                              : <Square size={15} />
                          }
                        </button>
                      </th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-12"></th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nome</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-32">SKU</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Custo</th>
                      <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Revenda</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">Qualidade</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">ML</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-20">Ativo</th>
                      <th className="text-center px-4 py-3 text-[11px] font-bold text-gray-500 uppercase tracking-wider w-28">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {produtosFiltrados.map(p => {
                      const isSelected = selectedIds.has(p.id);
                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-white/2 transition-colors group ${isSelected ? "bg-brand/5" : ""}`}
                        >
                          {/* Checkbox */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => toggleSelect(p.id)}
                              className="flex items-center justify-center text-gray-500 hover:text-brand transition-colors"
                            >
                              {isSelected
                                ? <CheckSquare size={15} className="text-brand" />
                                : <Square size={15} />
                              }
                            </button>
                          </td>

                          {/* Thumbnail */}
                          <td className="px-4 py-3">
                            {p.images?.[0] ? (
                              <img src={p.images[0]} alt="" className="w-9 h-9 rounded-lg object-cover bg-dark-700 flex-shrink-0" />
                            ) : (
                              <div className="w-9 h-9 rounded-lg bg-dark-700 flex items-center justify-center">
                                <Package size={13} className="text-gray-600" />
                              </div>
                            )}
                          </td>

                          {/* Nome */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => router.push(`/marca/produtos/${p.id}`)}
                              className="text-white hover:text-brand font-medium transition-colors text-left"
                            >
                              {p.name}
                            </button>
                          </td>

                          {/* SKU */}
                          <td className="px-4 py-3">
                            <span className="text-xs font-mono text-gray-400 bg-dark-700 px-2 py-1 rounded-lg">{p.sku}</span>
                          </td>

                          {/* Custo */}
                          <td className="px-4 py-3">
                            {p.price != null ? (
                              <span className="text-gray-300 font-medium text-xs">
                                R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>

                          {/* Revenda */}
                          <td className="px-4 py-3">
                            {p.resale_price != null ? (
                              <span className="text-white font-semibold">
                                R$ {p.resale_price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-gray-600 text-xs">—</span>
                            )}
                          </td>

                          {/* Badge de qualidade */}
                          <td className="px-4 py-3 text-center">
                            {(() => {
                              const { score, canPublish } = calcQualityScore({
                                name:             p.name,
                                sku:              p.sku,
                                price:            String(p.price ?? ""),
                                description:      "",
                                images:           p.images ?? [],
                                condition:        "new",
                                attrValues:       p.attributes ?? {},
                                requiredAttrs:    required.map(a => ({ id: a.id, name: a.name, required: true })),
                                optionalAttrs:    optional.map(a => ({ id: a.id, name: a.name, required: false })),
                                compatibilidades: [],
                              });
                              const color = score >= 90 ? "bg-green-400/15 text-green-400" :
                                            score >= 60 ? "bg-yellow-400/15 text-yellow-400" :
                                            "bg-red-400/15 text-red-400";
                              return (
                                <span
                                  className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-full ${color}`}
                                  title={canPublish ? "Pode publicar" : "Campos obrigatórios faltando"}
                                >
                                  {score}%
                                </span>
                              );
                            })()}
                          </td>

                          {/* Status ML */}
                          <td className="px-4 py-3 text-center">
                            {p.ml_item_id ? (
                              <a
                                href={`https://www.mercadolivre.com.br/anuncio/${p.ml_item_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full transition-colors ${
                                  p.ml_status === "active"
                                    ? "bg-green-400/15 text-green-400 hover:bg-green-400/25"
                                    : "bg-red-400/15 text-red-400 hover:bg-red-400/25"
                                }`}
                                title="Ver anúncio no ML"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.ml_status === "active" ? "bg-green-400" : "bg-red-400"}`} />
                                {p.ml_status === "active" ? "Ativo" : p.ml_status ?? "Inativo"}
                                <ExternalLink size={9} />
                              </a>
                            ) : p.ml_status === "error" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-red-400/15 text-red-400">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" /> Erro
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePublish(p)}
                                disabled={publishing === p.id}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-dark-700 border border-white/10 text-gray-400 hover:text-white hover:border-yellow-400/40 hover:bg-yellow-400/8 transition-all disabled:opacity-50"
                                title="Publicar no Mercado Livre"
                              >
                                {publishing === p.id
                                  ? <Loader2 size={10} className="animate-spin" />
                                  : <Send size={10} />
                                }
                                {publishing === p.id ? "..." : "Publicar"}
                              </button>
                            )}
                          </td>

                          {/* Toggle ativo */}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleToggle(p)}
                              disabled={toggling === p.id}
                              className="inline-flex items-center justify-center"
                            >
                              {toggling === p.id
                                ? <Loader2 size={14} className="animate-spin text-gray-500" />
                                : p.active
                                  ? <ToggleRight size={18} className="text-brand" />
                                  : <ToggleLeft  size={18} className="text-gray-600" />
                              }
                            </button>
                          </td>

                          {/* Ações */}
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => router.push(`/marca/produtos/${p.id}`)}
                                className="p-1.5 text-gray-500 hover:text-white hover:bg-white/8 rounded-lg transition-all"
                                title="Editar"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => setDelId(p.id)}
                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                                title="Excluir"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ ABA CAMPOS / FICHA TÉCNICA ═══════════════════════════ */}
      {tab === "campos" && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">

          {/* ML badge */}
          <div className="flex items-center gap-2 px-4 py-3 bg-dark-800 border border-white/8 rounded-2xl">
            <ShoppingBag size={13} className={cat.ml_category_id ? "text-yellow-400" : "text-gray-600"} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-gray-500">Mercado Livre</p>
              {cat.ml_category_id
                ? <p className="text-xs text-gray-300 truncate">{cat.ml_category_path?.join(" › ") ?? cat.ml_category_name}</p>
                : <p className="text-xs text-gray-600">Não vinculado</p>
              }
            </div>
            {cat.ml_category_id
              ? <CheckCircle2 size={13} className="text-yellow-400 flex-shrink-0" />
              : <AlertCircle  size={13} className="text-gray-600 flex-shrink-0" />
            }
          </div>

          {SECOES_ESTATICAS.map(({ icon, title, fields }) => (
            <Secao key={title} icon={icon} title={title}
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/8 text-gray-400">
                  {fields.length} campo{fields.length !== 1 ? "s" : ""}
                </span>
              }
            >
              {fields.map(f => <FieldRow key={f.name} name={f.name} hint={f.hint} type={f.type} />)}
            </Secao>
          ))}

          {cat.ml_category_id && (
            <Secao icon={Star} title="Características obrigatórias"
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-400/15 text-red-400">
                  {loadingAttr ? "..." : required.length} campo{required.length !== 1 ? "s" : ""}
                </span>
              }
            >
              {loadingAttr ? (
                <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-xs">
                  <Loader2 size={13} className="animate-spin" /> Carregando...
                </div>
              ) : required.length === 0 ? (
                <div className="px-5 py-6 text-center text-xs text-gray-600">
                  Nenhum atributo obrigatório nesta categoria
                </div>
              ) : (
                required.map(a => (
                  <FieldRow key={a.id} name={a.name} hint={a.hint} type={a.value_type} required values={a.values} />
                ))
              )}
            </Secao>
          )}

          {cat.ml_category_id && !loadingAttr && optional.length > 0 && (
            <Secao icon={Info} title="Características opcionais"
              badge={
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/8 text-gray-400">
                  {optional.length} campo{optional.length !== 1 ? "s" : ""}
                </span>
              }
            >
              {optional.map(a => (
                <FieldRow key={a.id} name={a.name} hint={a.hint} type={a.value_type} values={a.values} />
              ))}
            </Secao>
          )}

          {cat.ml_category_id && (
            <div className="flex gap-3">
              <a
                href={`/api/marca/categorias/${id}/template`}
                download
                className="flex items-center gap-2 px-4 py-2.5 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
              >
                <Download size={14} /> Baixar template desta categoria
              </a>
            </div>
          )}
        </div>
      )}

      {/* ══ BARRA DE AÇÕES EM MASSA ══════════════════════════════ */}
      {anySelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center gap-2 px-4 py-3 bg-dark-800 border border-white/20 rounded-2xl shadow-2xl shadow-black/60 backdrop-blur-sm">
            <span className="text-xs font-semibold text-white mr-1">
              {selectedIds.size} selecionado{selectedIds.size !== 1 ? "s" : ""}
            </span>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => handleBulkActive(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-green-400 hover:bg-green-400/10 transition-all disabled:opacity-50"
            >
              <ToggleRight size={14} /> Ativar
            </button>
            <button
              onClick={() => handleBulkActive(false)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-400 hover:bg-white/8 transition-all disabled:opacity-50"
            >
              <ToggleLeft size={14} /> Desativar
            </button>
            <button
              onClick={() => { setBulkPrecoInput(""); setBulkPriceModal(true); }}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-400 hover:bg-blue-400/10 transition-all disabled:opacity-50"
            >
              <DollarSign size={14} /> Alterar preço
            </button>
            <button
              onClick={() => setBulkDelModal(true)}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-400/10 transition-all disabled:opacity-50"
            >
              <Trash2 size={14} /> Excluir
            </button>
            <div className="w-px h-4 bg-white/10" />
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-gray-500 hover:text-white rounded-lg hover:bg-white/8 transition-all"
              title="Desmarcar todos"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ══ MODAL IMPORTAR ═══════════════════════════════════════ */}
      {importModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !importing && setImportModal(false)}
        >
          <div
            className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
              <h3 className="text-sm font-bold text-white">Importar produtos em massa</h3>
              <button onClick={() => setImportModal(false)} disabled={importing}
                className="text-gray-500 hover:text-white transition-colors disabled:opacity-50">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              {/* Instrução */}
              <div className="p-4 bg-brand/8 border border-brand/20 rounded-xl space-y-2">
                <p className="text-xs font-bold text-white">Como importar:</p>
                <ol className="text-xs text-gray-400 space-y-1 list-decimal list-inside">
                  <li>Baixe o template específico desta categoria</li>
                  <li>Preencha os produtos (a partir da linha 3)</li>
                  <li>Salve e faça upload aqui</li>
                </ol>
                <a
                  href={`/api/marca/categorias/${id}/template`}
                  download
                  className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline mt-1"
                >
                  <Download size={11} /> Baixar template da categoria
                </a>
              </div>

              {/* Upload */}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={e => {
                    setImportFile(e.target.files?.[0] ?? null);
                    setImportResult(null);
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={importing}
                  className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center gap-2 transition-all ${
                    importFile
                      ? "border-brand/40 bg-brand/5"
                      : "border-white/10 hover:border-white/20"
                  }`}
                >
                  {importFile ? (
                    <>
                      <CheckCircle2 size={20} className="text-brand" />
                      <p className="text-sm font-semibold text-white">{importFile.name}</p>
                      <p className="text-xs text-gray-500">Clique para trocar</p>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="text-gray-600" />
                      <p className="text-sm text-gray-400">Clique para selecionar o arquivo</p>
                      <p className="text-xs text-gray-600">.xlsx, .xls ou .csv</p>
                    </>
                  )}
                </button>
              </div>

              {/* Resultado */}
              {importResult && (
                <div className="flex items-center gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-xl">
                  <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                  <p className="text-sm text-green-400 font-semibold">
                    {importResult.count} produto{importResult.count !== 1 ? "s" : ""} importado{importResult.count !== 1 ? "s" : ""}!
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/8">
              <button
                onClick={() => setImportModal(false)}
                disabled={importing}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >
                {importResult ? "Fechar" : "Cancelar"}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={!importFile || importing}
                  className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {importing
                    ? <><Loader2 size={13} className="animate-spin" /> Importando...</>
                    : <><Upload size={13} /> Importar planilha</>
                  }
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL BULK PREÇO ═════════════════════════════════════ */}
      {bulkPriceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !bulkLoading && setBulkPriceModal(false)}
        >
          <div
            className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-sm"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
              <div>
                <h3 className="text-sm font-bold text-white">Alterar preço de revenda</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedIds.size} produto{selectedIds.size !== 1 ? "s" : ""} selecionado{selectedIds.size !== 1 ? "s" : ""}</p>
              </div>
              <button onClick={() => setBulkPriceModal(false)} disabled={bulkLoading}
                className="text-gray-500 hover:text-white transition-colors disabled:opacity-50">
                <X size={16} />
              </button>
            </div>

            <div className="px-6 py-5">
              <label className="block text-xs text-gray-400 mb-2">Novo preço de revenda (R$)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">R$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={bulkPrecoInput}
                  onChange={e => setBulkPrecoInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleBulkPrice()}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-2.5 bg-dark-700 border border-white/10 rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand/40"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/8">
              <button
                onClick={() => setBulkPriceModal(false)}
                disabled={bulkLoading}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkPrice}
                disabled={!bulkPrecoInput || bulkLoading}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkLoading
                  ? <><Loader2 size={13} className="animate-spin" /> Salvando...</>
                  : "Aplicar"
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL BULK EXCLUIR ════════════════════════════════════ */}
      {bulkDelModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !bulkLoading && setBulkDelModal(false)}
        >
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">Excluir {selectedIds.size} produto{selectedIds.size !== 1 ? "s" : ""}?</p>
            <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setBulkDelModal(false)}
                disabled={bulkLoading}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleBulkDelete}
                disabled={bulkLoading}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {bulkLoading && <Loader2 size={13} className="animate-spin" />}
                {bulkLoading ? "Excluindo..." : `Excluir ${selectedIds.size}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL EXCLUIR INDIVIDUAL ═════════════════════════════ */}
      {delId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => !deleting && setDelId(null)}
        >
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">Excluir produto?</p>
            <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDelId(null)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(delId)}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
