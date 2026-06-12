"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, X, Tag, ShoppingBag, ToggleLeft, ToggleRight, FolderOpen, ChevronRight } from "lucide-react";
import MarcaContentHeader from "@/components/marca/MarcaContentHeader";
import CategoryPicker from "@/components/marca/CategoryPicker";

interface Categoria {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  ativa: boolean;
  ml_category_id: string | null;
  ml_category_name: string | null;
  ml_category_path: string[] | null;
  created_at: string;
}

interface MLCategory {
  id: string;
  name: string;
  path: string[];
}

interface FormState {
  nome: string;
  descricao: string;
  ml: MLCategory | null;
}

const emptyForm: FormState = { nome: "", descricao: "", ml: null };
const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

export default function MarcaProdutosPage() {
  const router = useRouter();
  const [cats,    setCats]    = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal,   setModal]   = useState<{ open: boolean; editing: Categoria | null }>({ open: false, editing: null });
  const [form,    setForm]    = useState<FormState>(emptyForm);
  const [saving,  setSaving]  = useState(false);
  const [delId,   setDelId]   = useState<string | null>(null);
  const [deleting,setDeleting]= useState(false);
  const [toggling,setToggling]= useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch("/api/marca/categorias");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCats(Array.isArray(data) ? data : []);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao carregar categorias"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setForm(emptyForm);
    setModal({ open: true, editing: null });
  }

  function openEdit(cat: Categoria) {
    setForm({
      nome:     cat.nome,
      descricao:cat.descricao ?? "",
      ml: cat.ml_category_id ? {
        id:   cat.ml_category_id,
        name: cat.ml_category_name ?? "",
        path: cat.ml_category_path ?? [],
      } : null,
    });
    setModal({ open: true, editing: cat });
  }

  function closeModal() { setModal({ open: false, editing: null }); }

  async function handleSave() {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    try {
      const body = {
        nome:               form.nome.trim(),
        descricao:          form.descricao.trim() || null,
        ml_category_id:     form.ml?.id    ?? null,
        ml_category_name:   form.ml?.name  ?? null,
        ml_category_path:   form.ml?.path  ?? null,
      };
      const method = modal.editing ? "PATCH" : "POST";
      const url    = modal.editing ? `/api/marca/categorias/${modal.editing.id}` : "/api/marca/categorias";
      const res    = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data   = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(modal.editing ? "Categoria atualizada!" : "Categoria criada!");
      closeModal();
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      const res  = await fetch(`/api/marca/categorias/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Categoria excluída.");
      setDelId(null);
      load();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao excluir"); }
    finally { setDeleting(false); }
  }

  async function handleToggle(cat: Categoria) {
    setToggling(cat.id);
    try {
      const res  = await fetch(`/api/marca/categorias/${cat.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ativa: !cat.ativa }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCats(prev => prev.map(c => c.id === cat.id ? { ...c, ativa: !cat.ativa } : c));
    } catch (e) { toast.error(e instanceof Error ? e.message : "Erro ao alterar status"); }
    finally { setToggling(null); }
  }

  return (
    <div className="min-h-screen">
      <MarcaContentHeader title="Produtos" />

      {/* Toolbar */}
      <div className="bg-dark-900 border-b border-white/8 sticky top-[53px] z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-white">Categorias</p>
            <p className="text-[11px] text-gray-500">{cats.length} categoria{cats.length !== 1 ? "s" : ""} cadastrada{cats.length !== 1 ? "s" : ""}</p>
          </div>
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
          >
            <Plus size={14} /> Nova categoria
          </button>
        </div>
      </div>

      {/* Conteúdo */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-gray-500 text-sm">
            <Loader2 size={16} className="animate-spin" /> Carregando...
          </div>
        ) : cats.length === 0 ? (
          <div className="bg-dark-800 border border-white/8 rounded-2xl p-16 text-center">
            <FolderOpen size={32} className="text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-400 mb-1">Nenhuma categoria cadastrada</p>
            <p className="text-xs text-gray-600 mb-5">Crie categorias e vincule ao Mercado Livre para organizar seus produtos</p>
            <button
              onClick={openCreate}
              className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-xl transition-all"
            >
              Criar primeira categoria
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cats.map((cat) => (
              <div
                key={cat.id}
                className={`bg-dark-800 border rounded-2xl p-5 flex flex-col gap-3 transition-all ${cat.ativa ? "border-white/8 hover:border-white/15" : "border-white/4 opacity-50"}`}
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <button
                    className="flex items-center gap-2.5 min-w-0 flex-1 text-left hover:opacity-80 transition-opacity"
                    onClick={() => router.push(`/marca/produtos/categoria/${cat.id}`)}
                  >
                    <div className="w-9 h-9 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center flex-shrink-0">
                      <Tag size={15} className="text-brand" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        <p className="text-sm font-bold text-white truncate">{cat.nome}</p>
                        <ChevronRight size={12} className="text-gray-600 flex-shrink-0" />
                      </div>
                      {cat.descricao && <p className="text-xs text-gray-500 truncate mt-0.5">{cat.descricao}</p>}
                    </div>
                  </button>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggle(cat)}
                      disabled={toggling === cat.id}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      title={cat.ativa ? "Desativar" : "Ativar"}
                    >
                      {toggling === cat.id
                        ? <Loader2 size={13} className="animate-spin" />
                        : cat.ativa
                          ? <ToggleRight size={13} className="text-brand" />
                          : <ToggleLeft size={13} />
                      }
                    </button>
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-1.5 text-gray-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                      title="Editar"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => setDelId(cat.id)}
                      className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all"
                      title="Excluir"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Vínculos de marketplace */}
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">Vínculos</p>

                  {/* Mercado Livre */}
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-dark-900 border border-white/5">
                    <ShoppingBag size={12} className={cat.ml_category_id ? "text-yellow-400" : "text-gray-700"} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-500">Mercado Livre</p>
                      {cat.ml_category_id ? (
                        <p className="text-xs text-gray-300 truncate">{cat.ml_category_path?.join(" › ") ?? cat.ml_category_name}</p>
                      ) : (
                        <p className="text-xs text-gray-600">Não vinculado</p>
                      )}
                    </div>
                    {cat.ml_category_id && (
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal criar/editar */}
      {modal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeModal}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl w-full max-w-lg flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>

            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8 flex-shrink-0">
              <h3 className="text-sm font-bold text-white">{modal.editing ? "Editar categoria" : "Nova categoria"}</h3>
              <button onClick={closeModal} className="text-gray-500 hover:text-white transition-colors"><X size={16} /></button>
            </div>

            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

              {/* Dados da categoria */}
              <div className="space-y-4">
                <div>
                  <label className={lbl}>Nome da categoria *</label>
                  <input
                    value={form.nome}
                    onChange={e => setForm(p => ({ ...p, nome: e.target.value }))}
                    placeholder="Ex: Tapetes, Som Automotivo, Peças..."
                    className={inp}
                    autoFocus
                  />
                </div>
                <div>
                  <label className={lbl}>Descrição <span className="text-gray-600 font-normal">(opcional)</span></label>
                  <input
                    value={form.descricao}
                    onChange={e => setForm(p => ({ ...p, descricao: e.target.value }))}
                    placeholder="Breve descrição da categoria"
                    className={inp}
                  />
                </div>
              </div>

              {/* Vínculo ML */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <ShoppingBag size={13} className="text-yellow-400" />
                  <p className="text-xs font-bold text-white">Vínculo Mercado Livre</p>
                </div>
                <p className="text-xs text-gray-500">Selecione a categoria correspondente no ML. Os atributos e ficha técnica serão puxados automaticamente ao cadastrar produtos.</p>
                <CategoryPicker
                  selected={form.ml}
                  onSelect={cat => setForm(p => ({ ...p, ml: cat.id ? cat : null }))}
                />
              </div>

            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-white/8 flex-shrink-0">
              <button onClick={closeModal} disabled={saving} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving && <Loader2 size={13} className="animate-spin" />}
                {saving ? "Salvando..." : modal.editing ? "Salvar" : "Criar categoria"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal excluir */}
      {delId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => !deleting && setDelId(null)}>
          <div className="bg-dark-800 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold text-white">Excluir categoria?</p>
            <p className="text-xs text-gray-500">Os produtos vinculados a ela não serão excluídos, apenas o vínculo com a categoria será perdido.</p>
            <div className="flex gap-3">
              <button onClick={() => setDelId(null)} disabled={deleting} className="flex-1 py-2.5 bg-dark-700 border border-white/10 text-gray-300 rounded-xl text-sm disabled:opacity-50">
                Cancelar
              </button>
              <button onClick={() => handleDelete(delId)} disabled={deleting}
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
