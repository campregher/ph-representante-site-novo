"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/sistema/ui/Button";

export default function CopiarPedidoButton({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      toast.success("Pedido copiado.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={copiar}>
      {copiado ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
      Copiar pedido
    </Button>
  );
}
