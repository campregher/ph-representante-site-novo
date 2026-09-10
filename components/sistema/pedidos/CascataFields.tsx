"use client";

/**
 * Campos de desconto em cascata (sucessivos, em %).
 * `value` e `onChange` trabalham com string[] de tamanho 4 (um por etapa).
 * Vazio numa etapa = ignorada. Aplicados um sobre o outro, não somados.
 */
export default function CascataFields({
  value,
  onChange,
  disabled,
  compact,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const set = (i: number, raw: string) => {
    const next = [0, 1, 2, 3].map((k) => value[k] ?? "");
    next[i] = raw;
    onChange(next);
  };
  const cell = compact
    ? "w-14 rounded-md border border-neutral-300 px-1.5 py-1 text-right text-xs tabular-nums focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20 disabled:bg-neutral-100"
    : "w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10 disabled:bg-neutral-100";
  return (
    <div className={compact ? "grid grid-cols-2 gap-1" : "grid grid-cols-2 gap-2"}>
      {[0, 1, 2, 3].map((i) => (
        <input
          key={i}
          type="number"
          min="0"
          max="100"
          step="0.01"
          inputMode="decimal"
          disabled={disabled}
          value={value[i] ?? ""}
          onChange={(e) => set(i, e.target.value)}
          placeholder={i === 0 ? "%" : "+ %"}
          aria-label={`Desconto ${i + 1} (%)`}
          className={cell}
        />
      ))}
    </div>
  );
}
