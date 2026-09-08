import Link from "next/link";
import type { ReactNode } from "react";

export interface BarItem {
  label: string;
  value: number;
  href?: string;
  hint?: ReactNode;
  tone?: "brand" | "green" | "neutral";
}

const TONE: Record<string, string> = {
  brand: "bg-brand",
  green: "bg-green-500",
  neutral: "bg-neutral-400",
};

export default function BarList({
  items,
  format,
  empty = "Sem dados no período.",
}: {
  items: BarItem[];
  format: (n: number) => string;
  empty?: string;
}) {
  if (!items.length) {
    return <p className="py-6 text-center text-sm text-neutral-400">{empty}</p>;
  }
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="space-y-2.5">
      {items.map((it, i) => {
        const pct = Math.max((it.value / max) * 100, 1.5);
        const label = it.href ? (
          <Link href={it.href} className="hover:text-brand hover:underline">
            {it.label}
          </Link>
        ) : (
          it.label
        );
        return (
          <div key={i}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-neutral-700">{label}</span>
              <span className="shrink-0 font-medium text-neutral-900">{format(it.value)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
              <div
                className={`h-full rounded-full ${TONE[it.tone ?? "brand"]}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {it.hint && <div className="mt-0.5 text-xs text-neutral-400">{it.hint}</div>}
          </div>
        );
      })}
    </div>
  );
}
