"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X, ArrowDown, ArrowUp, RotateCcw, Pencil } from "lucide-react";
import { formatBRL } from "@/lib/sistema/format";
import { calcItem, parseCascata } from "@/lib/sistema/pedido-calc";
import { Button } from "@/components/sistema/ui/Button";

export interface ItemModalValue {
  quantidade: number;
  tabela_preco_id: string | null;
  desconto_cascata: number[];
  acrescimo_cascata: number[];
  preco_liquido_manual: number | null;
  observacao: string | null;
}

export interface ItemModalTabela {
  id: string;
  nome: string;
  ativa: boolean;
}

function toStrN(nums: number[] | null | undefined, n: number): string[] {
  const a = Array.isArray(nums) ? nums : [];
  return Array.from({ length: n }, (_, i) => (a[i] != null ? String(a[i]).replace(".", ",") : ""));
}

const num5 = (n: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 5 }).format(
    Number(n) || 0
  );

export default function ItemModal({
  modo,
  titulo,
  sku,
  unidade,
  produtoId,
  pesoKg,
  volumeM3,
  dimensoes,
  tabelas,
  defaultTabelaId,
  precoBaseFor,
  initial,
  onConfirm,
  onCancel,
}: {
  modo: "novo" | "editar";
  titulo: string;
  sku: string;
  unidade: string;
  produtoId: string;
  pesoKg: number | null;
  volumeM3: number | null;
  dimensoes: string | null;
  tabelas: ItemModalTabela[];
  defaultTabelaId: string | null;
  precoBaseFor: (tabelaId: string | null) => number;
  initial?: ItemModalValue;
  onConfirm: (v: ItemModalValue) => void;
  onCancel: () => void;
}) {
  const [qtd, setQtd] = useState(String(initial?.quantidade ?? 1));
  const [tabelaId, setTabelaId] = useState<string>(initial?.tabela_preco_id ?? "");
  const [desc, setDesc] = useState<string[]>(toStrN(initial?.desconto_cascata, 3));
  const [acr, setAcr] = useState<string[]>(toStrN(initial?.acrescimo_cascata, 2));
  const [obs, setObs] = useState(initial?.observacao ?? "");
  const [manualLiq, setManualLiq] = useState(initial?.preco_liquido_manual != null);
  const [liqStr, setLiqStr] = useState(
    initial?.preco_liquido_manual != null ? num5(initial.preco_liquido_manual) : ""
  );
  const qtyRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    qtyRef.current?.select();
  }, []);

  const descNums = parseCascata(desc, 100);
  const acrNums = parseCascata(acr, 1000);
  const manual =
    manualLiq && liqStr.trim() !== ""
      ? Number(liqStr.replace(/\s|\./g, "").replace(",", "."))
      : null;
  const temManual = manual != null && Number.isFinite(manual) && manual >= 0;

  const base = precoBaseFor(tabelaId || defaultTabelaId || null);
  const ci = calcItem({
    quantidade: Number(String(qtd).replace(",", ".")) || 0,
    preco_tabela: base,
    desconto_item_percentual: 0,
    desconto_cascata: temManual ? [] : descNums,
    acrescimo_cascata: temManual ? [] : acrNums,
    preco_liquido_manual: temManual ? manual : null,
  });
  const descUnit = Math.round((base - ci.preco_unitario_final) * 1e5) / 1e5;

  function setDescAt(i: number, v: string) {
    setDesc((prev) => {
      const n = [prev[0] ?? "", prev[1] ?? "", prev[2] ?? ""];
      n[i] = v;
      return n;
    });
  }
  function setAcrAt(i: number, v: string) {
    setAcr((prev) => {
      const n = [prev[0] ?? "", prev[1] ?? ""];
      n[i] = v;
      return n;
    });
  }

  function confirmar() {
    const q = Math.max(Number(String(qtd).replace(",", ".")) || 0, 0);
    if (q <= 0) return;
    onConfirm({
      quantidade: q,
      tabela_preco_id: tabelaId || null,
      desconto_cascata: temManual ? [] : descNums,
      acrescimo_cascata: temManual ? [] : acrNums,
      preco_liquido_manual: temManual ? Math.round(manual * 1e5) / 1e5 : null,
      observacao: obs.trim() || null,
    });
  }

  const pctField =
    "w-full rounded-md border border-neutral-300 px-2 py-1.5 text-right text-sm tabular-nums focus:border-brand/40 focus:outline-none focus:ring-1 focus:ring-brand/20";

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
          confirmar();
        }
      }}
    >
      <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
        <h2 className="text-base font-semibold text-neutral-900">
          {modo === "novo" ? "Adicionar Produto ao Pedido" : "Editar Produto do Pedido"}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Fechar"
          className="rounded p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="mx-auto max-w-3xl space-y-5">
          {/* Produto */}
          <div className="flex gap-4">
            <div className="h-16 w-16 shrink-0 rounded border border-neutral-200 bg-neutral-100" />
            <div className="min-w-0 flex-1 border-l-2 border-brand pl-3">
              <div className="font-semibold text-neutral-900">
                {titulo} <span className="font-normal text-neutral-400">— {sku}</span>
              </div>
              {dimensoes && <div className="mt-0.5 text-xs text-neutral-500">{dimensoes}</div>}
            </div>
            <div className="hidden shrink-0 text-xs text-neutral-400 sm:block">
              <Link
                href={`/sistema/produtos/${produtoId}/editar`}
                target="_blank"
                className="inline-flex items-center gap-1 text-brand hover:underline"
              >
                <Pencil size={12} /> Alterar cadastro do produto
              </Link>
              <div className="mt-2 space-y-0.5">
                <div>Último preço: ---</div>
                <div>Último pedido: ---</div>
                <div>Comprado: ---</div>
              </div>
            </div>
          </div>

          {/* Tabela + Quantidade */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Tabela de preço</span>
              <select
                value={tabelaId}
                onChange={(e) => setTabelaId(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
              >
                <option value="">
                  {formatBRL(precoBaseFor(defaultTabelaId))} — tabela do pedido
                </option>
                {tabelas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatBRL(precoBaseFor(t.id))} — {t.nome}
                    {t.ativa ? "" : " (inativa)"}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-neutral-700">Quantidade</span>
              <div className="flex">
                <input
                  ref={qtyRef}
                  value={qtd}
                  onChange={(e) => setQtd(e.target.value)}
                  inputMode="numeric"
                  className="w-full rounded-l-lg border border-neutral-300 px-3 py-2 text-right text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
                />
                <span className="inline-flex items-center rounded-r-lg border border-l-0 border-neutral-300 bg-neutral-50 px-3 text-xs font-medium text-neutral-500">
                  {unidade || "UN"}
                </span>
              </div>
            </label>
          </div>

          {(pesoKg != null || volumeM3 != null) && (
            <div className="flex gap-6 text-xs text-neutral-500">
              {pesoKg != null && (
                <span>
                  Peso bruto:{" "}
                  <strong>
                    {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
                      pesoKg * (Number(String(qtd).replace(",", ".")) || 0)
                    )}{" "}
                    kg
                  </strong>
                </span>
              )}
              {volumeM3 != null && (
                <span>
                  Volume:{" "}
                  <strong>
                    {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(
                      volumeM3 * (Number(String(qtd).replace(",", ".")) || 0)
                    )}{" "}
                    m³
                  </strong>
                </span>
              )}
            </div>
          )}

          {/* Descontos e acréscimos */}
          <div>
            <div className="mb-2 text-sm font-medium text-neutral-700">
              Descontos e acréscimos do vendedor
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[0, 1, 2].map((i) => (
                <label key={`d${i}`} className="text-xs">
                  <span className="mb-1 flex items-center gap-1 font-medium text-red-600">
                    <ArrowDown size={12} /> Desconto %
                  </span>
                  <input
                    value={desc[i] ?? ""}
                    onChange={(e) => setDescAt(i, e.target.value)}
                    inputMode="decimal"
                    disabled={temManual}
                    className={pctField + (temManual ? " bg-neutral-100" : "")}
                  />
                </label>
              ))}
              {[0, 1].map((i) => (
                <label key={`a${i}`} className="text-xs">
                  <span className="mb-1 flex items-center gap-1 font-medium text-emerald-600">
                    <ArrowUp size={12} /> Acréscimo %
                  </span>
                  <input
                    value={acr[i] ?? ""}
                    onChange={(e) => setAcrAt(i, e.target.value)}
                    inputMode="decimal"
                    disabled={temManual}
                    className={pctField + (temManual ? " bg-neutral-100" : "")}
                  />
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-neutral-400">
              Aplicados um sobre o outro (descontos e depois acréscimos), não somados.
            </p>
          </div>

          {/* Preço líquido + subtotal */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block text-center font-medium text-neutral-700">
                Preço Líquido (unidade)
              </span>
              <div className="flex">
                <span className="inline-flex items-center rounded-l-lg border border-r-0 border-neutral-300 bg-neutral-50 px-3 text-xs font-medium text-neutral-500">
                  R$
                </span>
                <input
                  value={manualLiq ? liqStr : num5(ci.preco_unitario_final)}
                  onChange={(e) => {
                    setManualLiq(true);
                    setLiqStr(e.target.value);
                  }}
                  inputMode="decimal"
                  className="w-full border border-neutral-300 px-3 py-2 text-right text-sm tabular-nums focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
                />
                <button
                  type="button"
                  onClick={() => {
                    setManualLiq(false);
                    setLiqStr("");
                  }}
                  title="Voltar ao preço calculado pelos descontos"
                  className={`inline-flex items-center rounded-r-lg border border-l-0 border-neutral-300 px-2 ${
                    manualLiq
                      ? "bg-white text-neutral-500 hover:text-neutral-800"
                      : "bg-neutral-50 text-neutral-300"
                  }`}
                  disabled={!manualLiq}
                >
                  <RotateCcw size={14} />
                </button>
              </div>
              {manualLiq && (
                <span className="mt-1 block text-center text-[11px] text-neutral-400">
                  preço manual — descontos ignorados
                </span>
              )}
            </label>
            <div className="text-sm">
              <span className="mb-1 block text-center font-medium text-neutral-700">Subtotal</span>
              <div className="rounded-lg bg-neutral-50 px-3 py-2 text-right text-base font-semibold tabular-nums">
                {formatBRL(ci.valor_total)}
              </div>
            </div>
          </div>

          {/* Por unidade */}
          <div className="rounded-lg border border-neutral-200 text-sm">
            <div className="border-b border-neutral-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
              Por unidade
            </div>
            <div className="space-y-1 px-3 py-2 tabular-nums">
              <div className="flex justify-between">
                <span className="text-neutral-500">Preço de tabela</span>
                <span>{formatBRL(base)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">
                  {descUnit >= 0 ? "Desconto" : "Acréscimo"}
                </span>
                <span className={descUnit >= 0 ? "text-red-600" : "text-emerald-600"}>
                  {descUnit >= 0 ? "− " : "+ "}
                  {formatBRL(Math.abs(descUnit))}
                  {ci.desconto_item_percentual !== 0 && (
                    <span className="ml-1 text-xs text-neutral-400">
                      ({ci.desconto_item_percentual > 0 ? "−" : "+"}
                      {Math.abs(ci.desconto_item_percentual).toFixed(2)}%)
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between border-t border-neutral-100 pt-1 font-semibold text-neutral-900">
                <span>Preço líquido</span>
                <span>R$ {num5(ci.preco_unitario_final)}</span>
              </div>
            </div>
          </div>

          {/* Infos adicionais */}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-neutral-700">Infos. adicionais</span>
            <textarea
              value={obs}
              onChange={(e) => setObs(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
            />
          </label>
        </div>
      </div>

      <footer className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar (Esc)
        </Button>
        <Button size="sm" onClick={confirmar}>
          {modo === "novo" ? "Adicionar" : "Confirmar"} (Enter)
        </Button>
      </footer>
    </div>
  );
}
