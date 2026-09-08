"use client";

import { useMemo } from "react";
import { Plus, Trash2, Wand2, X } from "lucide-react";
import type { VariacaoEixo } from "@/lib/sistema/types";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Checkbox } from "@/components/sistema/ui/Field";
import {
  TableScroll,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  TableEmpty,
} from "@/components/sistema/ui/Table";

/** Linha de variação editável no formulário (preço/peso como texto). */
export interface VariacaoRow {
  id?: string;
  sku: string;
  atributos: Record<string, string>;
  preco_bruto: string;
  imagem_url: string;
  codigo_fabrica: string;
  ean: string;
  ativo: boolean;
}

export interface VariacoesState {
  temVariacoes: boolean;
  eixos: VariacaoEixo[];
  variacoes: VariacaoRow[];
}

export function emptyVariacoesState(): VariacoesState {
  return { temVariacoes: false, eixos: [], variacoes: [] };
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    // remove marcas de acento (faixa de combining diacritical marks)
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}

function skuSugerido(skuPai: string, atributos: Record<string, string>): string {
  const base = skuPai.trim() || "VAR";
  const sufixo = Object.values(atributos).map(slug).filter(Boolean).join("-");
  return sufixo ? `${slug(base)}-${sufixo}` : slug(base);
}

function chaveAtributos(a: Record<string, string>): string {
  return Object.keys(a)
    .sort()
    .map((k) => `${k}=${a[k]}`)
    .join("|");
}

/** Produto cartesiano dos valores de cada eixo válido. */
function combinacoes(eixos: VariacaoEixo[]): Record<string, string>[] {
  const validos = eixos.filter((e) => e.nome.trim() && e.valores.length > 0);
  if (validos.length === 0) return [];
  return validos.reduce<Record<string, string>[]>(
    (acc, eixo) => {
      const out: Record<string, string>[] = [];
      for (const base of acc) {
        for (const v of eixo.valores) out.push({ ...base, [eixo.nome.trim()]: v });
      }
      return out;
    },
    [{}]
  );
}

export default function VariacoesEditor({
  skuPai,
  precoBrutoPai,
  value,
  onChange,
}: {
  skuPai: string;
  precoBrutoPai: number | null;
  value: VariacoesState;
  onChange: (next: VariacoesState) => void;
}) {
  const { temVariacoes, eixos, variacoes } = value;
  const set = (patch: Partial<VariacoesState>) => onChange({ ...value, ...patch });

  const nomesEixos = useMemo(
    () => eixos.map((e) => e.nome.trim()).filter(Boolean),
    [eixos]
  );

  // ---- eixos ----
  const addEixo = () => set({ eixos: [...eixos, { nome: "", valores: [] }] });
  const updEixo = (i: number, patch: Partial<VariacaoEixo>) =>
    set({ eixos: eixos.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) });
  const rmEixo = (i: number) => set({ eixos: eixos.filter((_, idx) => idx !== i) });
  const addValor = (i: number, valor: string) => {
    const v = valor.trim();
    if (!v || eixos[i].valores.includes(v)) return;
    updEixo(i, { valores: [...eixos[i].valores, v] });
  };
  const rmValor = (i: number, valor: string) =>
    updEixo(i, { valores: eixos[i].valores.filter((x) => x !== valor) });

  // ---- variações ----
  const updVar = (i: number, patch: Partial<VariacaoRow>) =>
    set({ variacoes: variacoes.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) });
  const rmVar = (i: number) =>
    set({ variacoes: variacoes.filter((_, idx) => idx !== i) });

  function gerarCombinacoes() {
    const combos = combinacoes(eixos);
    if (combos.length === 0) return;
    const existentes = new Set(variacoes.map((r) => chaveAtributos(r.atributos)));
    const novas: VariacaoRow[] = combos
      .filter((c) => !existentes.has(chaveAtributos(c)))
      .map((atributos) => ({
        sku: skuSugerido(skuPai, atributos),
        atributos,
        preco_bruto: "",
        imagem_url: "",
        codigo_fabrica: "",
        ean: "",
        ativo: true,
      }));
    set({ variacoes: [...variacoes, ...novas] });
  }

  function addVariacaoVazia() {
    const atributos: Record<string, string> = {};
    for (const n of nomesEixos) atributos[n] = eixos.find((e) => e.nome.trim() === n)?.valores[0] ?? "";
    set({
      variacoes: [
        ...variacoes,
        {
          sku: skuSugerido(skuPai, atributos),
          atributos,
          preco_bruto: "",
          imagem_url: "",
          codigo_fabrica: "",
          ean: "",
          ativo: true,
        },
      ],
    });
  }

  const precoPaiLabel =
    precoBrutoPai != null ? precoBrutoPai.toFixed(2).replace(".", ",") : "sem preço";

  return (
    <Card>
      <CardHeader
        title="Variações"
        description="Ex.: mesmo item em tipos de estofado e costura, cada um com SKU e preço próprios."
      />
      <CardBody className="space-y-5">
        <Checkbox
          checked={temVariacoes}
          onChange={(e) => set({ temVariacoes: e.target.checked })}
          label="Este produto é vendido por variações"
        />

        {temVariacoes && (
          <>
            {/* Eixos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Eixos
                </p>
                <Button type="button" variant="outline" size="sm" onClick={addEixo}>
                  <Plus size={14} /> Eixo
                </Button>
              </div>

              {eixos.length === 0 && (
                <p className="text-xs text-neutral-400">
                  Adicione um eixo (ex.: “Estofado”, “Costura”) e seus valores.
                </p>
              )}

              {eixos.map((eixo, i) => (
                <div key={i} className="rounded-lg border border-neutral-200 p-3">
                  <div className="flex gap-2">
                    <Input
                      value={eixo.nome}
                      onChange={(e) => updEixo(i, { nome: e.target.value })}
                      placeholder="Nome do eixo (ex.: Estofado)"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="md"
                      onClick={() => rmEixo(i)}
                      title="Remover eixo"
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {eixo.valores.map((v) => (
                      <span
                        key={v}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700"
                      >
                        {v}
                        <button
                          type="button"
                          onClick={() => rmValor(i, v)}
                          className="text-neutral-400 hover:text-red-600"
                          aria-label={`Remover ${v}`}
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    <input
                      placeholder="+ valor e Enter"
                      className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-xs focus:border-brand/40 focus:outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addValor(i, (e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = "";
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Tabela de variações */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Variações ({variacoes.length})
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={gerarCombinacoes}
                    disabled={combinacoes(eixos).length === 0}
                  >
                    <Wand2 size={14} /> Gerar todas as combinações
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={addVariacaoVazia}>
                    <Plus size={14} /> Variação
                  </Button>
                </div>
              </div>

              <TableScroll>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>SKU</Th>
                      {nomesEixos.map((n) => (
                        <Th key={n}>{n}</Th>
                      ))}
                      <Th className="text-right">Preço bruto</Th>
                      <Th>Foto (link)</Th>
                      <Th>Cód. fábrica</Th>
                      <Th>EAN</Th>
                      <Th className="text-center">Ativo</Th>
                      <Th />
                    </Tr>
                  </Thead>
                  <Tbody>
                    {variacoes.length === 0 ? (
                      <TableEmpty colSpan={6 + nomesEixos.length}>
                        Nenhuma variação. Use “Gerar todas as combinações”.
                      </TableEmpty>
                    ) : (
                      variacoes.map((r, i) => (
                        <Tr key={i}>
                          <Td>
                            <input
                              value={r.sku}
                              onChange={(e) => updVar(i, { sku: e.target.value })}
                              className="w-40 rounded-md border border-neutral-300 px-2 py-1 font-mono text-xs"
                            />
                          </Td>
                          {nomesEixos.map((n) => {
                            const eixo = eixos.find((e) => e.nome.trim() === n);
                            return (
                              <Td key={n}>
                                <select
                                  value={r.atributos[n] ?? ""}
                                  onChange={(e) =>
                                    updVar(i, {
                                      atributos: { ...r.atributos, [n]: e.target.value },
                                    })
                                  }
                                  className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                                >
                                  <option value="">—</option>
                                  {(eixo?.valores ?? []).map((v) => (
                                    <option key={v} value={v}>
                                      {v}
                                    </option>
                                  ))}
                                </select>
                              </Td>
                            );
                          })}
                          <Td className="text-right">
                            <input
                              value={r.preco_bruto}
                              onChange={(e) => updVar(i, { preco_bruto: e.target.value })}
                              inputMode="decimal"
                              placeholder={precoPaiLabel}
                              className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
                            />
                          </Td>
                          <Td>
                            <input
                              value={r.imagem_url}
                              onChange={(e) => updVar(i, { imagem_url: e.target.value })}
                              placeholder="https://…"
                              className="w-40 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            />
                          </Td>
                          <Td>
                            <input
                              value={r.codigo_fabrica}
                              onChange={(e) => updVar(i, { codigo_fabrica: e.target.value })}
                              className="w-28 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            />
                          </Td>
                          <Td>
                            <input
                              value={r.ean}
                              onChange={(e) => updVar(i, { ean: e.target.value })}
                              inputMode="numeric"
                              className="w-32 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                            />
                          </Td>
                          <Td className="text-center">
                            <input
                              type="checkbox"
                              checked={r.ativo}
                              onChange={(e) => updVar(i, { ativo: e.target.checked })}
                              className="h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand/30"
                            />
                          </Td>
                          <Td className="text-right">
                            <button
                              type="button"
                              onClick={() => rmVar(i)}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableScroll>
              <p className="text-xs text-neutral-400">
                Preço em branco = usa o preço bruto do produto ({precoPaiLabel}).
              </p>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}
