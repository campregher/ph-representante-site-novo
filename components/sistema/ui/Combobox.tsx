"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export interface ComboOption {
  id: string;
  label: string;
  /** texto extra pesquisável (ex.: razão social, CNPJ) além do label */
  keywords?: string;
}

export default function Combobox({
  value,
  options,
  onChange,
  placeholder = "Buscar…",
  disabled,
  limit = 50,
}: {
  value: string;
  options: ComboOption[];
  onChange: (id: string) => void;
  placeholder?: string;
  disabled?: boolean;
  limit?: number;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options.slice(0, limit);
    const digits = s.replace(/\D/g, "");
    const base = options.filter((o) => {
      const hay = `${o.label} ${o.keywords ?? ""}`.toLowerCase();
      if (hay.includes(s)) return true;
      return digits.length >= 2 && hay.replace(/\D/g, "").includes(digits);
    });
    return base.slice(0, limit);
  }, [q, options, limit]);

  return (
    <div className="relative">
      <Search
        size={15}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
      />
      <input
        value={open ? q : selected?.label ?? ""}
        readOnly={!open}
        disabled={disabled}
        placeholder={placeholder}
        onFocus={() => {
          setOpen(true);
          setQ("");
        }}
        onChange={(e) => setQ(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="w-full cursor-text rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-8 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-100"
      />
      {value && !disabled && (
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            onChange("");
            setQ("");
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-neutral-400 hover:text-neutral-700"
          aria-label="Limpar"
        >
          <X size={14} />
        </button>
      )}

      {open && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-neutral-400">Nada encontrado</div>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
                className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-neutral-50 ${
                  o.id === value ? "bg-brand/5 font-medium text-brand" : "text-neutral-800"
                }`}
              >
                {o.label}
              </button>
            ))
          )}
          {options.length > limit && !q && (
            <div className="px-3 py-1.5 text-[11px] text-neutral-400">
              digite para filtrar ({options.length} no total)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
