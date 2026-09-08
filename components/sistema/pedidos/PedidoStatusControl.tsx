"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PEDIDO_STATUS } from "@/components/sistema/ui/Badge";
import { alterarStatusPedido } from "@/lib/sistema/actions/pedidos";
import { Button } from "@/components/sistema/ui/Button";

const OPTS = [
  { value: "orcamento", label: "Orçamento" },
  { value: "confirmado", label: "Confirmado" },
];

export default function PedidoStatusControl({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [pending, startTransition] = useTransition();

  const opts = OPTS.some((o) => o.value === status)
    ? OPTS
    : [{ value: status, label: PEDIDO_STATUS[status]?.label ?? status }, ...OPTS];

  return (
    <div className="flex items-center gap-2">
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
      >
        {opts.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="outline"
        loading={pending}
        disabled={value === status}
        onClick={() =>
          startTransition(async () => {
            const res = await alterarStatusPedido(id, value, "Status alterado manualmente");
            if (!res.ok) toast.error(res.error);
            else {
              toast.success("Status atualizado.");
              router.refresh();
            }
          })
        }
      >
        Aplicar
      </Button>
    </div>
  );
}
