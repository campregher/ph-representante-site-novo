"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const pages = Math.max(1, Math.ceil(total / pageSize));

  if (total <= pageSize) {
    return (
      <p className="mt-3 text-xs text-neutral-400">
        {total} registro{total === 1 ? "" : "s"}
      </p>
    );
  }

  function go(p: number) {
    const next = new URLSearchParams(params.toString());
    if (p <= 1) next.delete("page");
    else next.set("page", String(p));
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="mt-3 flex items-center justify-between text-xs text-neutral-500">
      <span>
        {from}–{to} de {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => go(page - 1)}
          disabled={page <= 1}
          className="rounded-md border border-neutral-300 bg-white p-1.5 hover:bg-neutral-50 disabled:opacity-40"
          aria-label="Página anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="px-2">
          {page} / {pages}
        </span>
        <button
          onClick={() => go(page + 1)}
          disabled={page >= pages}
          className="rounded-md border border-neutral-300 bg-white p-1.5 hover:bg-neutral-50 disabled:opacity-40"
          aria-label="Próxima página"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
