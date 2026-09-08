"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface SelectFilter {
  key: string;
  /** rótulo da opção "todos"; se ausente, o select não tem opção vazia */
  allLabel?: string;
  options: { value: string; label: string }[];
}

export default function SelectFilters({
  filters,
  resettable = true,
}: {
  filters: SelectFilter[];
  resettable?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  const cls =
    "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10";
  const dirty = filters.some((f) => params.get(f.key));

  return (
    <div className={`mb-5 flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      {filters.map((f) => (
        <select
          key={f.key}
          value={params.get(f.key) ?? (f.allLabel ? "" : f.options[0]?.value ?? "")}
          onChange={(e) => setParam(f.key, e.target.value)}
          className={cls}
        >
          {f.allLabel && <option value="">{f.allLabel}</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ))}

      {resettable && dirty && (
        <button
          onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
          className="rounded-lg px-3 py-2 text-sm font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          Limpar
        </button>
      )}
    </div>
  );
}
