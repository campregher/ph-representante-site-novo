"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { formatBRL } from "@/lib/sistema/format";
import { calcItem, parseCascata } from "@/lib/sistema/pedido-calc";
import { Button } from "@/components/sistema/ui/Button";
import CascataFields from "@/components/sistema/pedidos/CascataFields";

export interface ItemModalValue {
  quantidade: number;
  tabela_preco_id: string | null;
  desconto_cascata: number[];
  preco_liquido_manual: number | null;
}

function toStr4(nums?: number[] | null): string[] {
  const a = Array.isArray(nums) ? nums : [];
  return [0, 1, 2, 3].map((i) => (a[i] != null ? String(a[i]).replace(".", ",") : ""));
}

export default function ItemModal({
  titulo,
  sku,
  tabelas,
  defaultTabelaId,
  precoBaseFor,
  initial,
  onConfirm,
  onCancel,
}: {
  titulo: string;
  sku: string;
  tabelas: { id: string; nome: string; ativa: boolean }[];
  defaultTabelaId: string | null;
  /** preço de tabela desta linha para uma tabela (null = tabela do pedido) */
  precoBaseFor: (tabelaId: string | null) => number;
  initial?: ItemModalValue;
  onConfirm: (v: ItemModalValue) => void;
  onCancel: () => void;
}) {
  const [qtd, setQtd] = useState(String(initial?.quantidade ?? 1));
  const [tabelaId, setTabelaId] = useState<string>(initial?.tabela_preco_id ?? "");
  const [casc, setCasc] = useState<string[]>(toStr4(initial?.desconto_cascata));
  const [liq, setLiq] = useState(
    initial?.preco_liquido_manual != null
      ? String(initial.preco_liquido_manual).replace(".", ",")
      : ""
  );
  const qtyRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    qtyRef.current?.select();
  }, []);

  const cascNums = parseCascata(casc);
  const manual = liq.trim() !== "" ? Number(liq.replace(",", ".")) : null;
  const temManual = manual != null && Number.isFinite(manual) && manual >= 0;
  const base = precoBaseFor(tabelaId || defaultTabelaId || null);
  const ci = calcItem({
    quantidade: Number(String(qtd).replace(",", ".")) || 0,
    preco_tabela: base,
    desconto_item_percentual: 0,
    desconto_cascata: temManual ? [] : cascNums,
    preco_liquido_manual: temManual ? manual : null,
  });

  function confirm() {
    const q = Math.max(Number(String(qtd).replace(",", ".")) || 0, 0);
    if (q <= 0) return;
    onConfirm({
      quantidade: q,
      tabela_preco_id: tabelaId || null,
      desconto_cascata: temManual ? [] : cascNums,
      preco_liquido_manual: temManual ? Math.round(manual * 100) / 100 : null,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "TEXTAREA") {
          e.preventDefault();
          confirm();
        }
      }}
    >
      <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-neutral-500">{sku}</div>
          <div className="truncate font-semibold text-neutral-900">{titulo}</div>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="shrink-0 rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-xl space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Quantidade</span>
              <input
                ref={qtyRef}
                value={qtd}
                onChange={(e) => setQtd(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-right text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Tabela de preço</span>
              <select
                value={tabelaId}
                onChange={(e) => setTabelaId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
              >
                <option value="">Tabela do pedido</option>
                {tabelas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                    {t.ativa ? "" : " (inativa)"}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-between rounded-lg bg-neutral-50 px-3 py-2 text-sm">
            <span className="text-neutral-500">Preço de tabela</span>
            <span className="font-medium tabular-nums">{formatBRL(base)}</span>
          </div>

          <div>
            <span className="mb-1 block text-sm font-medium text-neutral-700">
              Descontos % (cascata)
            </span>
            <div className="max-w-xs">
              <CascataFields value={casc} onChange={setCasc} disabled={temManual} />
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              {temManual
                ? "Ignorado — preço líquido informado à mão."
                : "Aplicados um sobre o outro (não somados)."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Preço líquido (R$)</span>
              <input
                value={liq}
                onChange={(e) => setLiq(e.target.value)}
                inputMode="decimal"
                placeholder={formatBRL(ci.preco_unitario_final)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-right text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
              />
            </label>
            <div className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Subtotal</span>
              <div className="rounded-lg bg-neutral-50 px-3 py-2 text-right font-semibold tabular-nums">
                {formatBRL(ci.valor_total)}
              </div>
            </div>
          </div>

          <p className="text-xs text-neutral-500">
            Unitário líquido <strong>{formatBRL(ci.preco_unitario_final)}</strong>
            {ci.desconto_item_percentual > 0 && (
              <> · desconto efetivo {ci.desconto_item_percentual.toFixed(2)}%</>
            )}
          </p>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar (Esc)
        </Button>
        <Button size="sm" onClick={confirm}>
          Confirmar (Enter)
        </Button>
      </footer>
    </div>
  );
}
