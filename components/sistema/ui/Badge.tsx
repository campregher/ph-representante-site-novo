import type { ReactNode } from "react";

type Tone = "neutral" | "green" | "yellow" | "red" | "blue" | "purple" | "brand";

const TONES: Record<Tone, string> = {
  neutral: "bg-neutral-100 text-neutral-700 ring-neutral-200",
  green: "bg-green-50 text-green-700 ring-green-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  purple: "bg-purple-50 text-purple-700 ring-purple-200",
  brand: "bg-brand/10 text-brand ring-brand/20",
};

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/** Mapa status de pedido → tom + rótulo. */
export const PEDIDO_STATUS: Record<string, { label: string; tone: Tone }> = {
  orcamento: { label: "Orçamento", tone: "neutral" },
  aguardando_aprovacao: { label: "Aguardando aprovação", tone: "yellow" },
  enviado: { label: "Enviado", tone: "blue" },
  confirmado: { label: "Confirmado", tone: "blue" },
  faturado: { label: "Faturado", tone: "purple" },
  em_transporte: { label: "Em transporte", tone: "purple" },
  entregue: { label: "Entregue", tone: "green" },
  pendencia: { label: "Pendência", tone: "red" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  rejeitado: { label: "Rejeitado", tone: "red" },
};

export const CLIENTE_STATUS: Record<string, { label: string; tone: Tone }> = {
  prospect: { label: "Prospect", tone: "blue" },
  ativo: { label: "Ativo", tone: "green" },
  inativo: { label: "Inativo", tone: "neutral" },
  bloqueado: { label: "Bloqueado", tone: "red" },
  reativacao: { label: "Reativação", tone: "yellow" },
};
