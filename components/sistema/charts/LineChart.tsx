export interface LinePoint {
  label: string;
  value: number;
}

/** Gráfico de linha em SVG puro. `meta` desenha uma linha tracejada de referência. */
export default function LineChart({
  points,
  meta,
  format,
}: {
  points: LinePoint[];
  meta?: (number | null)[];
  format: (n: number) => string;
}) {
  if (points.length < 2) {
    return <p className="py-10 text-center text-sm text-neutral-400">Dados insuficientes.</p>;
  }

  const W = 640;
  const H = 200;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 26;

  const values = points.map((p) => p.value);
  const metaVals = (meta ?? []).filter((v): v is number => v != null);
  const maxRaw = Math.max(...values, ...metaVals, 1);
  const max = maxRaw * 1.15;

  const x = (i: number) => padL + (i / (points.length - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);

  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const area = `${x(0)},${H - padB} ${line} ${x(points.length - 1)},${H - padB}`;

  const metaLine =
    meta && meta.length === points.length
      ? meta
          .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
          .filter(Boolean)
          .join(" ")
      : "";

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={padL}
            x2={W - padR}
            y1={padT + g * (H - padT - padB)}
            y2={padT + g * (H - padT - padB)}
            stroke="#f1f1f1"
            strokeWidth={1}
          />
        ))}
        <polygon points={area} fill="#dc2626" fillOpacity={0.08} />
        <polyline
          points={line}
          fill="none"
          stroke="#dc2626"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {metaLine && (
          <polyline
            points={metaLine}
            fill="none"
            stroke="#9ca3af"
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.value)} r={2.5} fill="#dc2626" />
        ))}
        {points.map((p, i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            {p.label}
          </text>
        ))}
      </svg>
      <div className="mt-1 flex items-center justify-between text-xs text-neutral-400">
        <span>
          <span className="inline-block h-1 w-3 rounded bg-brand align-middle" /> Realizado
        </span>
        {metaLine && (
          <span>
            <span className="inline-block h-0 w-3 border-t border-dashed border-neutral-400 align-middle" />{" "}
            Meta
          </span>
        )}
        <span>Máx: {format(Math.max(...values))}</span>
      </div>
    </div>
  );
}
