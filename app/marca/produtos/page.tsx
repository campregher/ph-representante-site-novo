"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, RefreshCw, Package, Search, Pencil, Trash2, X, Loader2, ToggleLeft, ToggleRight, FileSpreadsheet } from "lucide-react";
import Image from "next/image";

interface Product {
  id: string; sku: string; name: string; brand: string;
  description: string; price?: number; images: string[]; active: boolean; createdAt: string;
}

type FormData = {
  sku: string; name: string; description: string; price: string;
  img1: string; img2: string; img3: string; active: boolean;
};

const emptyForm: FormData = { sku: "", name: "", description: "", price: "", img1: "", img2: "", img3: "", active: true };
const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

function fmt(v: number) { return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export default function MarcaProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [q,        setQ]        = useState("");
  const [modal,    setModal]    = useState<{ open: boolean; editing: Product | null }>({ open: false, editing: null });
  const [form,     setForm]     = useState<FormData>(emptyForm);
  const [saving,   setSaving]   = useState(false);
  const [delId,    setDelId]    = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/marca/produtos${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar produtos"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCreate() { setForm(emptyForm); setModal({ open: true, editing: null }); }
  function openEdit(p: Product) {
    setForm({
      sku: p.sku, name: p.name, description: p.description, price: p.price != null ? String(p.price) : "",
      img1: p.images[0] ?? "", img2: p.images[1] ?? "", img3: p.images[2] ?? "", active: p.active,
    });
    setModal({ open: true, editing: p });
  }
  function closeModal() { setModal({ open: false, editing: null }); }

  function field(key: keyof FormData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm(p => ({ ...p, [key]: e.target.value }));
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error("Nome obrigatório"); return; }
    if (!form.sku.trim())  { toast.error("SKU obrigatório"); return; }
    setSaving(true);
    try {
      const images = [form.img1, form.img2, form.img3].filter(Boolean);
      const body = {
        sku: form.sku.trim(), name: form.name.trim(), description: form.description.trim(),
        price: form.price ? Number(form.price.replace(",", ".")) : undefined,
        images, active: form.active,
      };
      const method = modal.editing ? "PATCH" : "POST";
      const url    = modal.editing ? `/api/marca/produtos/${modal.editing.id}` : "/api/marca/produtos";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(modal.editing ? "Produto atualizado!" : "Produto criado!");
      closeModal(); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar produto"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/marca/produtos/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Produto excluído.");
      setDelId(null); await load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir produto"); }
    finally { setDeleting(false); }
  }

  async function handleToggle(p: Product) {
    setToggling(p.id);
    try {
      const res  = await fetch(`/api/marca/produtos/${p.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ active: !p.active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setProducts(prev => prev.map(x => x.id === p.id ? { ...x, active: !p.active } : x));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao alterar status"); }
    finally { setToggling(null); }
  }

  const filtered = products.filter(p =>
    !q || p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="min-h-screen">
      <header className="bg-dark-900 border-b border-white/8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Buscar por nome ou SKU..."
              className="w-full pl-8 pr-3 py-2 bg-dark-800 border border-white/8 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 transition-all"
            />
          </div>
          <button onClick={load} disabled={loading}
            className="p-2 text-gray-500 hover:text-white bg-dark-800 border border-white/8 rounded-xl transition-all"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
          <Link href="/marca/produtos/import"
            className="flex items-center gap-1.5 px-3 py-2 bg-dark-800 border border-white/8 text-gray-300 hover:text-white text-sm font-semibold rounded-xl transition-all"
          >
            <FileSpreadsheet size={14} /> Importar Excel
          </Link>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
          >
            <Plus size={14} /> Novo produto
          </button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center text-gray-500 text-sm flex items-center justify-center gap-2">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-12 text-center">
            <Package size={28} className="text-gray-700 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">{q ? "Nenhum produto encontrado." : "Nenhum produto cadastrado ainda."}</p>
            {!q && (
              <button onClick={openCreate} className="mt-4 px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all">
                Cadastrar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
            <div className="divide-y divide-white/5">
              {filtered.map((p) => (
                <div key={p.id} className={`flex items-center gap-4 px-5 py-4 hover:bg-white/3 transition-colors ${!p.active ? "opacity-50" : ""}`}>
                  {/* Thumbnail */}
                  <div className="w-12 h-12 bg-dark-900 border border-white/8 rounded-xl flex-shrink-0 overflow-hidden">
                    {p.images[0] ? (
                      <Image src={p.images[0]} alt={p.name} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package size={16} className="text-gray-700" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                      {!p.active && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-gray-400/15 text-gray-400 border border-gray-400/25">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 font-mono mt-0.5">{p.sku}</p>
                    {p.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.description}</p>}
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    {p.price != null ? (
                      <p className="text-sm font-black text-white">{fmt(p.price)}</p>
                    ) : (
                      <p className="text-xs text-gray-600">Sem preço</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(p)} disabled={toggling === p.id}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      title={p.active ? "Desativar" : "Ativar"}
                    >
                      {toggling === p.id ? <Loader2 size={14} className="animate-spin" /> : p.active ? <ToggleRight size={14} className="text-brand" /> : <ToggleLeft size={14} />}
                    </button>
                    <button onClick={() => openEdit(p)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => setDelId(p.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-md flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8 flex-shrink-0">
              <h3 className="text-sm font-bold text-white">{modal.editing ? "Editar produto" : "Novo produto"}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>SKU *</label>
                  <input value={form.sku} onChange={field("sku")} placeholder="Ex: ATT-001" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Preço (R$)</label>
                  <input value={form.price} onChange={field("price")} placeholder="0,00" className={inp} />
                </div>
              </div>
              <div>
                <label className={lbl}>Nome *</label>
                <input value={form.name} onChange={field("name")} placeholder="Nome do produto" className={inp} />
              </div>
              <div>
                <label className={lbl}>Descrição</label>
                <textarea value={form.description} onChange={field("description")} placeholder="Descrição do produto..." rows={3}
                  className={`${inp} resize-none`}
                />
              </div>
              <div>
                <label className={lbl}>Imagens (URLs)</label>
                <div className="space-y-2">
                  <input value={form.img1} onChange={field("img1")} placeholder="URL da imagem 1" className={inp} />
                  <input value={form.img2} onChange={field("img2")} placeholder="URL da imagem 2 (opcional)" className={inp} />
                  <input value={form.img3} onChange={field("img3")} placeholder="URL da imagem 3 (opcional)" className={inp} />
                </div>
                {form.img1 && (
                  <div className="mt-2 flex gap-2">
                    {[form.img1, form.img2, form.img3].filter(Boolean).map((url, i) => (
                      <div key={i} className="w-16 h-16 bg-dark-900 border border-white/8 rounded-xl overflow-hidden">
                        <Image src={url} alt={`img${i+1}`} width={64} height={64} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setForm(p => ({ ...p, active: !p.active }))}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${form.active ? "bg-brand" : "bg-dark-600 border border-white/10"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.active ? "translate-x-4" : ""}`} />
                </button>
                <span className="text-sm text-gray-300 cursor-pointer select-none" onClick={() => setForm(p => ({ ...p, active: !p.active }))}>
                  {form.active ? "Produto ativo (visível no catálogo)" : "Produto inativo (oculto)"}
                </span>
              </div>
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/8 flex-shrink-0">
              <button onClick={closeModal} disabled={saving} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50">Cancelar</button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDelId(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">Excluir produto?</p>
            <p className="text-xs text-gray-500">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} disabled={deleting} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50">Cancelar</button>
              <button onClick={() => handleDelete(delId)} disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting && <Loader2 size={14} className="animate-spin" />}
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
