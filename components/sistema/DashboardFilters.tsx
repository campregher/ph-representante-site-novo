"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface DashOption {
  value: string;
  label: string;
}

export default function DashboardFilters({
  meses,
  representadas,
  vendedores,
}: {
  meses: DashOption[];
  representadas: DashOption[];
  vendedores: DashOption[];
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
  const hasFilters = params.get("representada") || params.get("vendedor") || params.get("mes");

  return (
    <div
      className={`mb-5 flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}
    >
      <select
        value={params.get("mes") ?? meses[0]?.value ?? ""}
        onChange={(e) => setParam("mes", e.target.value)}
        className={cls}
      >
        {meses.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        value={params.get("representada") ?? ""}
        onChange={(e) => setParam("representada", e.target.value)}
        className={cls}
      >
        <option value="">Todas as representadas</option>
        {representadas.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>

      {vendedores.length > 0 && (
        <select
          value={params.get("vendedor") ?? ""}
          onChange={(e) => setParam("vendedor", e.target.value)}
          className={cls}
        >
          <option value="">Todos os vendedores</option>
          {vendedores.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
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
