import type { ReactNode } from "react";

type Tone = "info" | "success" | "danger";

const TONES: Record<Tone, string> = {
  info: "border-info/20 bg-info/5 text-neutral-700 [&_svg]:text-info",
  success: "border-success/20 bg-success/5 text-neutral-700 [&_svg]:text-success",
  danger: "border-red-200 bg-red-50 text-red-700 [&_svg]:text-red-600",
};

/** Aviso inline com ícone — usado pra validações/checkpoints de formulário
 *  (ex.: CNAE, CNPJ duplicado, WhatsApp). Um só tratamento visual pros três
 *  tons em vez de cada chamada reinventar padding/borda. */
export function Note({
  tone = "info",
  icon,
  children,
  className = "",
}: {
  tone?: Tone;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${TONES[tone]} ${className}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}
