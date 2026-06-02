"use client";
import { Printer } from "lucide-react";

export default function PrintOrderButton({ orderId }: { orderId: string }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); window.open(`/api/portal/imprimir?ids=${orderId}`, "_blank"); }}
      className="p-1.5 text-gray-600 hover:text-white rounded-lg hover:bg-white/5 transition-all flex-shrink-0"
      title="Imprimir pedido"
    >
      <Printer size={13} />
    </button>
  );
}
