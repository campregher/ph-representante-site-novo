/** Assinatura visual: a cadeia fornecedor → PH → seller → comprador, desenhada
 *  como uma linha de manifesto. Só decorativo — não representa status real de
 *  pedido (isso continua em components/sistema/ui/Badge.tsx). */
export default function RouteRail({
  nodes = ["Fornecedor", "PH", "Seller", "Comprador"],
  className = "",
}: {
  nodes?: string[];
  className?: string;
}) {
  return (
    <div className={`flex items-center ${className}`}>
      {nodes.map((label, i) => (
        <div key={label} className="flex items-center" style={{ flex: i < nodes.length - 1 ? "0 1 auto" : "0 0 auto" }}>
          <div className="flex flex-col items-center gap-1.5">
            <span className="relative block h-2.5 w-2.5 flex-shrink-0 rounded-[2px] bg-brand">
              <span className="absolute inset-[2px] rounded-[1px] border border-white/55" />
            </span>
            <span className="max-w-[72px] text-center text-[9px] font-mono uppercase leading-tight tracking-wide text-gray-400">
              {label}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <span
              aria-hidden
              className="mx-1.5 mb-4 h-[2px] w-5 sm:w-8 flex-shrink-0"
              style={{
                backgroundImage: "linear-gradient(to right, var(--color-brand) 0 5px, transparent 5px 9px)",
                backgroundSize: "9px 2px",
                backgroundRepeat: "repeat-x",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}
