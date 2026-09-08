"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { SEGMENT_LABELS, isIdSegment } from "@/lib/sistema/nav";

/** Breadcrumb derivado da rota. Ex.: Sistema › Clientes › Detalhe */
export default function Breadcrumb() {
  const pathname = usePathname();
  const segs = pathname.split("/").filter(Boolean);

  const crumbs = segs.map((seg, i) => ({
    href: "/" + segs.slice(0, i + 1).join("/"),
    label: isIdSegment(seg)
      ? "Detalhe"
      : SEGMENT_LABELS[seg] ?? decodeURIComponent(seg).replace(/^\w/, (c) => c.toUpperCase()),
    last: i === segs.length - 1,
  }));

  return (
    <nav aria-label="Trilha" className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1.5">
          {c.last ? (
            <span className="font-medium text-neutral-700">{c.label}</span>
          ) : (
            <Link href={c.href} className="transition-colors hover:text-neutral-800">
              {c.label}
            </Link>
          )}
          {!c.last && <ChevronRight size={12} className="text-neutral-300" />}
        </span>
      ))}
    </nav>
  );
}
