"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

// Só pulamos campos que já existem em outros lugares do formulário
// ou que são auxiliares internos do ML — o restante segue a ficha da categoria
const BLOCKLIST = new Set([
  'BRAND',               // já é a marca do produto
  'PART_NUMBER',         // já é o SKU
  'HAS_COMPATIBILITIES', // gerenciamos via VehicleCompatibility
  'EMPTY_GTIN_REASON',   // auxiliar interno do ML
]);

interface MLAttr {
  id: string;
  name: string;
  value_type: string;
  required: boolean;
  multivalued: boolean;
  values: { id: string; name: string }[];
  hint: string | null;
  default_unit: string | null;
  allowed_units: { id: string; name: string }[];
}

interface Props {
  categoryId: string;
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  /** Se fornecido, usa em vez de buscar da API */
  prefetchedAttrs?: MLAttr[];
  /** Chamado quando os atributos forem carregados */
  onLoad?: (attrs: MLAttr[]) => void;
}

const inp = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-brand/50 transition-all";
const sel = "w-full px-3 py-2.5 bg-dark-950 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-brand/50 transition-all appearance-none";
const lbl = "block text-xs font-semibold text-gray-400 mb-1.5";

export default function AttributeForm({ categoryId, values, onChange, prefetchedAttrs, onLoad }: Props) {
  const [attrs,   setAttrs]   = useState<MLAttr[]>(prefetchedAttrs ?? []);
  const [loading, setLoading] = useState(!prefetchedAttrs && Boolean(categoryId));

  useEffect(() => {
    if (prefetchedAttrs) { setAttrs(prefetchedAttrs); return; }
    if (!categoryId) return;
    setLoading(true);
    fetch(`/api/ml/atributos?category_id=${categoryId}`)
      .then((r) => r.json())
      .then((data) => {
        const filtered = Array.isArray(data)
          ? data.filter((a: MLAttr) => !BLOCKLIST.has(a.id))
          : [];
        setAttrs(filtered);
        onLoad?.(filtered);
      })
      .catch(() => setAttrs([]))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId, prefetchedAttrs]);

  function set(id: string, value: string) {
    onChange({ ...values, [id]: value });
  }

  if (!categoryId) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-gray-500 text-sm">
        <Loader2 size={14} className="animate-spin" /> Carregando atributos...
      </div>
    );
  }

  if (attrs.length === 0) return null;

  // Separar obrigatórios dos opcionais
  const required = attrs.filter((a) => a.required);
  const optional = attrs.filter((a) => !a.required);

  return (
    <div className="space-y-5">
      {required.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Atributos obrigatórios</p>
          {required.map((attr) => (
            <AttrField key={attr.id} attr={attr} value={values[attr.id] ?? ""} onChange={(v) => set(attr.id, v)} />
          ))}
        </div>
      )}
      {optional.length > 0 && (
        <div className="space-y-4">
          <p className="text-xs font-bold text-white/40 uppercase tracking-wider">Atributos opcionais</p>
          {optional.map((attr) => (
            <AttrField key={attr.id} attr={attr} value={values[attr.id] ?? ""} onChange={(v) => set(attr.id, v)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AttrField({ attr, value, onChange }: { attr: MLAttr; value: string; onChange: (v: string) => void }) {
  const label = (
    <label className={lbl}>
      {attr.name}
      {attr.required && <span className="text-brand ml-1">*</span>}
    </label>
  );

  // Lista com valores predefinidos
  if (attr.value_type === "list" && attr.values.length > 0) {
    return (
      <div>
        {label}
        <select value={value} onChange={(e) => onChange(e.target.value)} className={sel}>
          <option value="">Selecionar...</option>
          {attr.values.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
    );
  }

  // Booleano
  if (attr.value_type === "boolean") {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(value === "true" ? "false" : "true")}
          className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${value === "true" ? "bg-brand" : "bg-dark-600 border border-white/10"}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value === "true" ? "translate-x-4" : ""}`} />
        </button>
        <span className="text-sm text-gray-300 select-none">{attr.name}</span>
      </div>
    );
  }

  // Número com unidade
  if (attr.value_type === "number_unit") {
    const [num, unit] = value.split("||");
    const defaultUnit = attr.default_unit ?? attr.allowed_units[0]?.id ?? "";
    return (
      <div>
        {label}
        <div className="flex gap-2">
          <input
            type="number"
            value={num ?? ""}
            onChange={(e) => onChange(`${e.target.value}||${unit ?? defaultUnit}`)}
            placeholder="0"
            className={`${inp} flex-1`}
          />
          {attr.allowed_units.length > 1 ? (
            <select
              value={unit ?? defaultUnit}
              onChange={(e) => onChange(`${num ?? ""}||${e.target.value}`)}
              className={`${sel} w-24`}
            >
              {attr.allowed_units.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          ) : (
            <span className="px-3 py-2.5 bg-dark-900 border border-white/10 rounded-xl text-sm text-gray-500 whitespace-nowrap">
              {attr.default_unit ?? attr.allowed_units[0]?.name ?? ""}
            </span>
          )}
        </div>
      </div>
    );
  }

  // Texto livre (string, number sem unidade, etc.)
  return (
    <div>
      {label}
      <input
        type={attr.value_type === "number" ? "number" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={attr.hint ?? attr.name}
        className={inp}
      />
    </div>
  );
}
