"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";

export interface FilterSelect {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export default function Filters({
  searchKey = "busca",
  searchPlaceholder = "Buscar…",
  selects = [],
}: {
  searchKey?: string;
  searchPlaceholder?: string;
  selects?: FilterSelect[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const [term, setTerm] = useState(params.get(searchKey) ?? "");
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function apply(next: URLSearchParams) {
    next.delete("page");
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    apply(next);
  }

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const current = params.get(searchKey) ?? "";
      if (term !== current) setParam(searchKey, term.trim());
    }, 350);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);

  const hasFilters =
    !!(params.get(searchKey) ?? "") || selects.some((s) => params.get(s.key));

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[220px] flex-1">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"
        />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-8 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
        />
        {term && (
          <button
            onClick={() => setTerm("")}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700"
            aria-label="Limpar busca"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {selects.map((s) => (
        <select
          key={s.key}
          value={params.get(s.key) ?? ""}
          onChange={(e) => setParam(s.key, e.target.value)}
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
        >
          <option value="">{s.label}: todos</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {hasFilters && (
        <button
          onClick={() => {
            setTerm("");
            startTransition(() => router.replace(pathname, { scroll: false }));
          }}
          className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
