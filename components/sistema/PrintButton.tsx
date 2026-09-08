"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";

export default function PrintButton({ auto = false }: { auto?: boolean }) {
  useEffect(() => {
    if (!auto) return;
    const t = setTimeout(() => window.print(), 500);
    return () => clearTimeout(t);
  }, [auto]);

  return (
    <button
      onClick={() => window.print()}
      className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-hover print:hidden"
    >
      <Printer size={15} /> Imprimir
    </button>
  );
}
