"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronRight, Loader2, Search, X, TreePine } from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface CategoryDetail {
  id: string;
  name: string;
  path_from_root: Category[];
  children_categories: Category[];
  is_leaf: boolean;
}

interface Suggestion {
  id: string;
  name: string;
  path: string[];
  confidence: number;
}

export interface SelectedCategory {
  id: string;
  name: string;
  path: string[];
}

interface Props {
  onSelect: (category: SelectedCategory) => void;
  selected?: SelectedCategory | null;
}

type Mode = "search" | "browse";

export default function CategoryPicker({ onSelect, selected }: Props) {
  const [mode,       setMode]       = useState<Mode>("search");
  const [query,      setQuery]      = useState("");
  const [suggestions,setSuggestions]= useState<Suggestion[]>([]);
  const [searching,  setSearching]  = useState(false);
  const [roots,      setRoots]      = useState<Category[]>([]);
  const [stack,      setStack]      = useState<CategoryDetail[]>([]);
  const [browsing,   setBrowsing]   = useState(false);
  const [open,       setOpen]       = useState(false);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Carrega categorias raiz ao entrar no modo manual
  useEffect(() => {
    if (mode === "browse" && roots.length === 0) {
      fetch("/api/ml/categorias")
        .then(r => r.json())
        .then(d => setRoots(Array.isArray(d) ? d : []))
        .catch(() => {});
    }
  }, [mode, roots.length]);

  // Predição com debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || mode !== "search") { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res  = await fetch(`/api/ml/preditor?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch { setSuggestions([]); }
      finally { setSearching(false); }
    }, 400);
  }, [query, mode]);

  async function browseTo(id: string) {
    setBrowsing(true);
    try {
      const res  = await fetch(`/api/ml/categorias?id=${id}`);
      const data: CategoryDetail = await res.json();
      const children = Array.isArray(data.children_categories) ? data.children_categories : [];
      const isLeaf   = data.is_leaf || children.length === 0;

      if (isLeaf) {
        const path = Array.isArray(data.path_from_root)
          ? data.path_from_root.map((p: Category) => p.name)
          : [data.name];
        pick({ id: data.id, name: data.name, path });
      } else {
        setStack(prev => [...prev, { ...data, children_categories: children }]);
      }
    } catch { }
    finally { setBrowsing(false); }
  }

  function pick(cat: SelectedCategory) {
    onSelect(cat);
    setOpen(false);
    setStack([]);
    setQuery("");
    setSuggestions([]);
  }

  function clear() {
    onSelect({ id: "", name: "", path: [] });
    setQuery("");
    setSuggestions([]);
  }

  // ── Selecionado ──
  if (selected?.id) {
    return (
      <div className="flex items-center gap-2 px-3 py-2.5 bg-dark-950 border border-brand/40 rounded-xl">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 truncate">{selected.path.slice(0, -1).join(" › ")}</p>
          <p className="text-sm font-semibold text-white truncate">{selected.name}</p>
        </div>
        <button type="button" onClick={clear} className="text-gray-500 hover:text-white transition-colors flex-shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  }

  const current       = stack[stack.length - 1];
  const browseList: Category[] = current ? (current.children_categories ?? []) : roots;
  const breadcrumb    = stack.map(s => s.name);

  return (
    <div className="relative">

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-sm text-gray-500 flex items-center justify-between hover:border-white/20 transition-all"
      >
        <span>Selecionar categoria...</span>
        <ChevronRight size={14} className={`transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-800 border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden">

          {/* Abas */}
          <div className="flex border-b border-white/8">
            <button
              type="button"
              onClick={() => { setMode("search"); setStack([]); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${mode === "search" ? "text-white border-b-2 border-brand -mb-px" : "text-gray-500 hover:text-gray-300"}`}
            >
              <Search size={12} /> Buscar
            </button>
            <button
              type="button"
              onClick={() => { setMode("browse"); setSuggestions([]); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${mode === "browse" ? "text-white border-b-2 border-brand -mb-px" : "text-gray-500 hover:text-gray-300"}`}
            >
              <TreePine size={12} /> Navegar
            </button>
          </div>

          {/* ── Modo Buscar ── */}
          {mode === "search" && (
            <div>
              <div className="px-3 py-2.5 border-b border-white/5">
                <div className="relative">
                  <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none" />
                  {searching && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-spin" />}
                  <input
                    autoFocus
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Digite o nome do produto..."
                    className="w-full pl-8 pr-8 py-2 bg-dark-900 border border-white/8 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-brand/40 transition-all"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto">
                {!query.trim() ? (
                  <p className="text-center text-xs text-gray-600 py-8 px-4">
                    Digite o nome do produto e o ML sugere a categoria automaticamente
                  </p>
                ) : searching ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-xs">
                    <Loader2 size={13} className="animate-spin" /> Buscando categorias...
                  </div>
                ) : suggestions.length === 0 ? (
                  <p className="text-center text-xs text-gray-600 py-8">Nenhuma sugestão encontrada</p>
                ) : (
                  suggestions.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pick(s)}
                      className={`w-full px-4 py-3 text-left hover:bg-white/5 flex items-center justify-between gap-3 transition-colors ${i > 0 ? "border-t border-white/4" : ""}`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{s.name}</p>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">{s.path.join(" › ")}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        s.confidence >= 0.8 ? "bg-green-400/15 text-green-400" :
                        s.confidence >= 0.5 ? "bg-yellow-400/15 text-yellow-400" :
                        "bg-gray-400/15 text-gray-400"
                      }`}>
                        {Math.round(s.confidence * 100)}%
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Modo Navegar ── */}
          {mode === "browse" && (
            <div>
              {/* Breadcrumb */}
              {breadcrumb.length > 0 && (
                <div className="px-4 pt-3 pb-2 flex items-center gap-1 flex-wrap border-b border-white/5">
                  <button type="button" onClick={() => setStack([])} className="text-xs text-gray-500 hover:text-white transition-colors">
                    Início
                  </button>
                  {breadcrumb.map((name, i) => (
                    <span key={i} className="flex items-center gap-1">
                      <ChevronRight size={10} className="text-gray-700" />
                      <button
                        type="button"
                        onClick={() => setStack(prev => prev.slice(0, i + 1))}
                        className={`text-xs transition-colors ${i === breadcrumb.length - 1 ? "text-white font-semibold" : "text-gray-500 hover:text-white"}`}
                      >
                        {name}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {stack.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStack(prev => prev.slice(0, -1))}
                  className="w-full px-4 py-2.5 text-left text-xs text-gray-500 hover:text-white hover:bg-white/5 flex items-center gap-2 border-b border-white/5 transition-colors"
                >
                  ← Voltar
                </button>
              )}

              <div className="max-h-64 overflow-y-auto">
                {browsing ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-xs">
                    <Loader2 size={13} className="animate-spin" /> Carregando...
                  </div>
                ) : browseList.length === 0 ? (
                  <p className="text-center text-xs text-gray-600 py-8">Nenhuma categoria encontrada</p>
                ) : (
                  browseList.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => browseTo(cat.id)}
                      className="w-full px-4 py-3 text-left text-sm text-gray-300 hover:text-white hover:bg-white/5 flex items-center justify-between transition-colors border-t border-white/4 first:border-0"
                    >
                      <span>{cat.name}</span>
                      <ChevronRight size={12} className="text-gray-600" />
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
