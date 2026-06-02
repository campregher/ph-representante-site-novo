"use client";
import { Printer } from "lucide-react";

export default function PrintButton({ orderId }: { orderId: string }) {
  return (
    <button
      onClick={() => window.open(`/api/portal/imprimir?ids=${orderId}`, "_blank")}
      className="print:hidden flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-all"
    >
      <Printer size={13} />
      Imprimir pedido
    </button>
  );
}
