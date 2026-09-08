// Formatações brasileiras para a área /sistema.

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUM = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** 1234.5 → "R$ 1.234,50" */
export function formatBRL(value: number | null | undefined): string {
  return BRL.format(Number(value ?? 0));
}

/** 1234.5 → "1.234,5" */
export function formatNumber(value: number | null | undefined, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number(value ?? 0)
  );
}

/** 0.125 → "12,5%"  (recebe fração 0..1) */
export function formatPercentFraction(value: number | null | undefined): string {
  return `${NUM.format(Number(value ?? 0) * 100)}%`;
}

/** 12.5 → "12,5%"  (recebe já em pontos percentuais) */
export function formatPercent(value: number | null | undefined, digits = 2): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number(value ?? 0)
  )}%`;
}

/** "2026-09-07" | Date → "07/09/2026" */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value.length <= 10 ? `${value}T00:00:00` : value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

/** ISO → "07/09/2026 14:32" */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCNPJ(value: string | null | undefined): string {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 14);
  if (d.length !== 14) return value ?? "";
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function formatCPF(value: string | null | undefined): string {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length !== 11) return value ?? "";
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCpfCnpj(value: string | null | undefined): string {
  const d = String(value ?? "").replace(/\D/g, "");
  return d.length === 11 ? formatCPF(d) : d.length === 14 ? formatCNPJ(d) : value ?? "";
}

export function formatPhone(value: string | null | undefined): string {
  const d = String(value ?? "").replace(/\D/g, "").slice(0, 11);
  if (d.length < 10) return value ?? "";
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function onlyDigits(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** "1.234,56" | "1234.56" | "R$ 1.234,56" → 1234.56 (ou null se vazio/ inválido) */
export function parseNumeroBR(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  let s = String(value).replace(/[R$\s]/gi, "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    // formato BR: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** dias entre uma data e hoje (positivo = no passado) */
export function daysSince(value: string | Date | null | undefined): number | null {
  if (!value) return null;
  const d = typeof value === "string" ? new Date(value.length <= 10 ? `${value}T00:00:00` : value) : value;
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}
