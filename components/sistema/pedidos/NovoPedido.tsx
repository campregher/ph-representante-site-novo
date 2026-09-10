"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Search, AlertTriangle } from "lucide-react";
import { formatBRL } from "@/lib/sistema/format";
import { calcPedido, parseCascata } from "@/lib/sistema/pedido-calc";
import { salvarPedido, alterarStatusPedido } from "@/lib/sistema/actions/pedidos";
import { CONDICAO_PAGAMENTO_OPTIONS } from "@/lib/sistema/types";
import { Card, CardBody, CardHeader } from "@/components/sistema/ui/Card";
import { Button } from "@/components/sistema/ui/Button";
import Combobox from "@/components/sistema/ui/Combobox";
import CascataFields from "@/components/sistema/pedidos/CascataFields";
import ImportarItensPedido, {
  type ResolvedRef,
  type ItemImportado,
} from "@/components/sistema/pedidos/ImportarItensPedido";
import { Field, Input, Select, Textarea, FormGrid } from "@/components/sistema/ui/Field";
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

interface Opt {
  id: string;
  label: string;
  keywords?: string;
}
interface CatProduto {
  id: string;
  sku: string;
  nome: string;
  aplicacao: string | null;
  tem_variacoes: boolean;
}
interface CatVariacao {
  id: string;
  sku: string;
  atributos: Record<string, string>;
  preco_bruto: number | null;
}
interface Catalogo {
  representada: { pedido_minimo: number; desconto_maximo_padrao: number };
  tabelas: { id: string; nome: string; tipo: string | null; data_fim: string | null; ativa: boolean }[];
  produtos: CatProduto[];
  variacoes: Record<string, CatVariacao[]>;
  tabelaPadrao: string | null;
  descontoCascataCliente?: number[];
  precos: Record<string, { preco: number; preco_minimo: number | null; desconto_maximo: number | null }>;
}

interface Item {
  produto_id: string;
  variacao_id: string | null;
  sku: string;
  nome: string;
  quantidade: number;
  preco_tabela: number;
  desconto_item_percentual: number;
  desconto_cascata: number[];
}

/** number[] -> 4 campos de texto ("50", "6,66", "", "") para os inputs. */
function toStr4(nums?: number[] | null): string[] {
  const a = Array.isArray(nums) ? nums : [];
  return [0, 1, 2, 3].map((i) => (a[i] != null ? String(a[i]).replace(".", ",") : ""));
}

/** Entrada "adicionável" na busca: produto sem variação, ou 1 por variação ativa. */
interface PickEntry {
  key: string;
  produto: CatProduto;
  variacao: CatVariacao | null;
  sku: string;
  label: string;
  preco: number | undefined;
}

/** rótulo curto dos atributos de uma variação: "Couro / Dupla vermelha" */
function atributosLabel(atributos: Record<string, string>): string {
  return Object.values(atributos ?? {})
    .filter(Boolean)
    .join(" / ");
}
/** chave estável de uma linha do pedido */
function itemKey(it: { produto_id: string; variacao_id: string | null }): string {
  return it.variacao_id ?? it.produto_id;
}

export interface PedidoInitial {
  id: string;
  status: string;
  cliente_id: string;
  representada_id: string;
  tabela_preco_id: string | null;
  condicao_pagamento: string | null;
  forma_pagamento: string | null;
  previsao_entrega: string | null;
  observacao_cliente: string | null;
  observacao_interna: string | null;
  desconto_percentual: number;
  desconto_cascata: number[];
  itens: Item[];
}

export default function NovoPedido({
  clienteOptions,
  representadaOptions,
  initial,
}: {
  clienteOptions: Opt[];
  representadaOptions: Opt[];
  initial?: PedidoInitial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [clienteId, setClienteId] = useState(initial?.cliente_id ?? "");
  const [representadaId, setRepresentadaId] = useState(initial?.representada_id ?? "");
  const [tabelaId, setTabelaId] = useState(initial?.tabela_preco_id ?? "");
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [loadingCat, setLoadingCat] = useState(false);

  const [itens, setItens] = useState<Item[]>(initial?.itens ?? []);
  const [busca, setBusca] = useState("");
  // atalho de teclado: busca → Enter → (quickPick) → digita qtd → Enter → adiciona
  const [hi, setHi] = useState(0); // linha destacada no dropdown
  const [quickPick, setQuickPick] = useState<PickEntry | null>(null);
  const [quickQty, setQuickQty] = useState("1");
  const buscaRef = useRef<HTMLInputElement>(null);
  const qtyRef = useRef<HTMLInputElement>(null);
  const [descModo, setDescModo] = useState<"percentual" | "valor">("percentual");
  const [descInput, setDescInput] = useState(initial ? String(initial.desconto_percentual) : "0");
  const [cascPedido, setCascPedido] = useState<string[]>(() => {
    if (initial?.desconto_cascata?.length) return toStr4(initial.desconto_cascata);
    if (initial && Number(initial.desconto_percentual) > 0)
      return toStr4([Number(initial.desconto_percentual)]);
    return ["", "", "", ""];
  });
  const cascPedidoTouched = useRef(!!initial);
  const cascPedidoNums = useMemo(() => parseCascata(cascPedido), [cascPedido]);
  function alterarCascPedido(v: string[]) {
    cascPedidoTouched.current = true;
    setCascPedido(v);
  }
  const [cond, setCond] = useState(initial?.condicao_pagamento ?? "");
  const [forma, setForma] = useState(initial?.forma_pagamento ?? "");
  const [previsao, setPrevisao] = useState(initial?.previsao_entrega ?? "");
  const [obsCliente, setObsCliente] = useState(initial?.observacao_cliente ?? "");
  const [obsInterna, setObsInterna] = useState(initial?.observacao_interna ?? "");

  // carrega catálogo ao mudar representada / tabela / cliente
  useEffect(() => {
    if (!representadaId) return;
    let cancelled = false;
    (async () => {
      setLoadingCat(true);
      try {
        const url = new URL("/api/sistema/pedidos/catalogo", window.location.origin);
        url.searchParams.set("representada", representadaId);
        if (clienteId) url.searchParams.set("cliente", clienteId);
        if (tabelaId) url.searchParams.set("tabela", tabelaId);
        const r = await fetch(url);
        const data: Catalogo & { error?: string } = await r.json();
        if (cancelled) return;
        if (data.error) {
          toast.error(data.error);
          return;
        }
        setCat(data);
        if (!tabelaId && data.tabelaPadrao) setTabelaId(data.tabelaPadrao);
        if (
          !cascPedidoTouched.current &&
          Array.isArray(data.descontoCascataCliente) &&
          data.descontoCascataCliente.length > 0
        ) {
          setCascPedido(toStr4(data.descontoCascataCliente));
        }
        setItens((prev) =>
          prev.map((it) => ({
            ...it,
            preco_tabela: data.precos[itemKey(it)]?.preco ?? it.preco_tabela,
          }))
        );
      } finally {
        if (!cancelled) setLoadingCat(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [representadaId, tabelaId, clienteId]);

  const pickEntries = useMemo<PickEntry[]>(() => {
    if (!cat) return [];
    const q = busca.trim().toLowerCase();
    const jaAdd = new Set(itens.map(itemKey));
    const out: PickEntry[] = [];

    for (const p of cat.produtos) {
      const vs = cat.variacoes[p.id] ?? [];
      const matchProduto =
        !q ||
        p.sku.toLowerCase().includes(q) ||
        p.nome.toLowerCase().includes(q) ||
        (p.aplicacao ?? "").toLowerCase().includes(q);

      if (p.tem_variacoes && vs.length > 0) {
        for (const v of vs) {
          if (jaAdd.has(v.id)) continue;
          const attr = atributosLabel(v.atributos);
          if (
            q &&
            !matchProduto &&
            !v.sku.toLowerCase().includes(q) &&
            !attr.toLowerCase().includes(q)
          )
            continue;
          out.push({
            key: v.id,
            produto: p,
            variacao: v,
            sku: v.sku,
            label: `${p.nome} — ${attr}`,
            preco: cat.precos[v.id]?.preco,
          });
        }
      } else {
        if (jaAdd.has(p.id)) continue;
        if (!matchProduto) continue;
        out.push({
          key: p.id,
          produto: p,
          variacao: null,
          sku: p.sku,
          label: p.nome,
          preco: cat.precos[p.id]?.preco,
        });
      }
    }
    return out.slice(0, 50);
  }, [cat, busca, itens]);

  // Índice SKU -> referência do catálogo (para importação de itens por planilha)
  const skuIndex = useMemo<Map<string, ResolvedRef>>(() => {
    const m = new Map<string, ResolvedRef>();
    if (!cat) return m;
    for (const p of cat.produtos) {
      const vs = cat.variacoes[p.id] ?? [];
      if (p.tem_variacoes && vs.length > 0) {
        // SKU do pai fica ambíguo; cada variação entra pelo seu SKU
        if (p.sku) m.set(p.sku.toLowerCase(), { produto_id: p.id, variacao_id: null, sku: p.sku, nome: p.nome, preco: null, ambiguo: true });
        for (const v of vs) {
          m.set(v.sku.toLowerCase(), {
            produto_id: p.id,
            variacao_id: v.id,
            sku: v.sku,
            nome: `${p.nome} — ${atributosLabel(v.atributos)}`,
            preco: cat.precos[v.id]?.preco ?? null,
          });
        }
      } else {
        m.set(p.sku.toLowerCase(), {
          produto_id: p.id,
          variacao_id: null,
          sku: p.sku,
          nome: p.nome,
          preco: cat.precos[p.id]?.preco ?? null,
        });
      }
    }
    return m;
  }, [cat]);

  const skusNoPedido = useMemo(
    () => new Set(itens.map((i) => i.sku.toLowerCase())),
    [itens]
  );

  function importarItens(novos: ItemImportado[]) {
    setItens((prev) => {
      const next = [...prev];
      for (const n of novos) {
        const idx = next.findIndex(
          (it) => itemKey(it) === (n.variacao_id ?? n.produto_id)
        );
        if (idx >= 0) {
          next[idx] = { ...next[idx], quantidade: next[idx].quantidade + n.quantidade };
        } else {
          next.push({
            produto_id: n.produto_id,
            variacao_id: n.variacao_id,
            sku: n.sku,
            nome: n.nome,
            quantidade: n.quantidade > 0 ? n.quantidade : 1,
            preco_tabela: n.preco,
            desconto_item_percentual: 0,
            desconto_cascata: [],
          });
        }
      }
      return next;
    });
  }

  function addEntry(e: PickEntry, qtd = 1) {
    const add = qtd > 0 ? qtd : 1;
    const key = e.variacao?.id ?? e.produto.id;
    setItens((prev) => {
      const idx = prev.findIndex((it) => itemKey(it) === key);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + add };
        return next;
      }
      return [
        ...prev,
        {
          produto_id: e.produto.id,
          variacao_id: e.variacao?.id ?? null,
          sku: e.sku,
          nome: e.label,
          quantidade: add,
          preco_tabela: e.preco ?? 0,
          desconto_item_percentual: 0,
          desconto_cascata: [],
        },
      ];
    });
    setBusca("");
  }

  // ── atalho de teclado ────────────────────────────────────────────────
  // Foca a quantidade assim que um produto é "pré-selecionado" na busca.
  useEffect(() => {
    if (quickPick) qtyRef.current?.select();
  }, [quickPick]);

  /** Enter na busca: pré-seleciona (SKU exato > linha destacada > 1ª) e vai p/ qtd. */
  function pegarBusca() {
    if (pickEntries.length === 0) return;
    const alvo = busca.trim().toLowerCase();
    const exato = pickEntries.find((e) => e.sku.toLowerCase() === alvo);
    const escolha = exato ?? pickEntries[hi] ?? pickEntries[0];
    setQuickPick(escolha);
    setQuickQty("1");
  }

  /** Enter na quantidade: adiciona e volta o foco para a busca. */
  function confirmarQuick() {
    if (!quickPick) return;
    const n = Math.floor(Number(String(quickQty).replace(",", ".")) || 1);
    addEntry(quickPick, n > 0 ? n : 1);
    setQuickPick(null);
    setQuickQty("1");
    setBusca("");
    setHi(0);
    setTimeout(() => buscaRef.current?.focus(), 0);
  }

  function cancelarQuick() {
    setQuickPick(null);
    setQuickQty("1");
    setTimeout(() => buscaRef.current?.focus(), 0);
  }

  function updateItem(key: string, patch: Partial<Item>) {
    setItens((prev) => prev.map((it) => (itemKey(it) === key ? { ...it, ...patch } : it)));
  }
  function removeItem(key: string) {
    setItens((prev) => prev.filter((it) => itemKey(it) !== key));
  }

  const calc = useMemo(
    () =>
      calcPedido({
        itens: itens.map((i) => ({
          quantidade: Number(i.quantidade) || 0,
          preco_tabela: Number(i.preco_tabela) || 0,
          desconto_item_percentual: Number(i.desconto_item_percentual) || 0,
          desconto_cascata: i.desconto_cascata,
        })),
        desconto_modo: descModo,
        desconto_input: Number(descInput.replace(",", ".")) || 0,
        desconto_cascata: descModo === "percentual" ? cascPedidoNums : [],
      }),
    [itens, descModo, descInput, cascPedidoNums]
  );

  const avisos: string[] = [];
  if (cat) {
    if (cat.representada.pedido_minimo > 0 && calc.valor_total > 0 && calc.valor_total < cat.representada.pedido_minimo)
      avisos.push(`Abaixo do pedido mínimo da representada (${formatBRL(cat.representada.pedido_minimo)}).`);
    if (
      cat.representada.desconto_maximo_padrao > 0 &&
      calc.desconto_percentual > cat.representada.desconto_maximo_padrao
    )
      avisos.push(
        `Desconto de ${calc.desconto_percentual.toFixed(1)}% acima do limite recomendado (${cat.representada.desconto_maximo_padrao}%).`
      );
    const tab = cat.tabelas.find((t) => t.id === tabelaId);
    if (tab?.data_fim && new Date(tab.data_fim) < new Date()) avisos.push("A tabela selecionada está vencida.");
  }

  function buildPayload() {
    return {
      cliente_id: clienteId,
      representada_id: representadaId,
      tabela_preco_id: tabelaId || "",
      condicao_pagamento: cond,
      forma_pagamento: forma,
      previsao_entrega: previsao,
      observacao_cliente: obsCliente,
      observacao_interna: obsInterna,
      desconto_modo: descModo,
      desconto_input: Number(descInput.replace(",", ".")) || 0,
      desconto_cascata: descModo === "percentual" ? cascPedidoNums : [],
      itens: itens.map((i) => ({
        produto_id: i.produto_id,
        variacao_id: i.variacao_id,
        sku_snapshot: i.sku,
        descricao_snapshot: i.nome,
        quantidade: Number(i.quantidade) || 0,
        preco_tabela: Number(i.preco_tabela) || 0,
        desconto_item_percentual: Number(i.desconto_item_percentual) || 0,
        desconto_cascata: Array.isArray(i.desconto_cascata) ? i.desconto_cascata : [],
      })),
    };
  }

  function valida() {
    if (!clienteId) {
      toast.error("Selecione o cliente.");
      return false;
    }
    if (!representadaId) {
      toast.error("Selecione a representada.");
      return false;
    }
    if (itens.length === 0) {
      toast.error("Adicione ao menos um produto.");
      return false;
    }
    return true;
  }

  const jaGerado =
    !!initial && !["orcamento", "aguardando_aprovacao"].includes(initial.status);

  function salvar() {
    if (!valida()) return;
    startTransition(async () => {
      const res = await salvarPedido(initial?.id ?? null, buildPayload());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.warning) toast.warning(res.warning);
      toast.success(
        jaGerado
          ? "Pedido atualizado."
          : initial
            ? "Orçamento atualizado."
            : `Orçamento #${res.numero} salvo.`
      );
      router.push(`/sistema/pedidos/${res.id}`);
      router.refresh();
    });
  }

  function gerar() {
    if (!valida()) return;
    startTransition(async () => {
      const res = await salvarPedido(initial?.id ?? null, buildPayload());
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      if (res.warning) {
        toast.warning(`${res.warning} Mantido como orçamento — revise antes de gerar.`);
        router.push(`/sistema/pedidos/${res.id}`);
        router.refresh();
        return;
      }
      const conf = await alterarStatusPedido(res.id!, "confirmado", "Pedido gerado");
      if (!conf.ok) {
        toast.error(conf.error);
        router.push(`/sistema/pedidos/${res.id}`);
      } else {
        toast.success(`Pedido #${res.numero ?? ""} gerado.`);
        router.push("/sistema/pedidos");
      }
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {jaGerado ? (
          <Button size="sm" onClick={salvar} loading={pending}>
            Salvar alterações
          </Button>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={salvar} loading={pending}>
              {initial ? "Salvar orçamento" : "Salvar como orçamento"}
            </Button>
            <Button size="sm" onClick={gerar} loading={pending}>
              Gerar pedido
            </Button>
          </>
        )}
      </div>

      <Card>
        <CardHeader title="Cliente e representada" />
        <CardBody>
          <FormGrid>
            <Field label="Cliente" required>
              <div className="flex gap-2">
                <div className="flex-1">
                  <Combobox
                    value={clienteId}
                    options={clienteOptions}
                    onChange={setClienteId}
                    placeholder="Buscar por nome, razão social ou CNPJ…"
                  />
                </div>
                <Link
                  href="/sistema/clientes/novo"
                  target="_blank"
                  className="inline-flex h-10 shrink-0 items-center rounded-lg border border-neutral-300 bg-white px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
                >
                  <Plus size={14} />
                </Link>
              </div>
            </Field>
            <Field label="Representada" required>
              <Select
                value={representadaId}
                onChange={(e) => {
                  setRepresentadaId(e.target.value);
                  setTabelaId("");
                  setItens([]);
                  setCat(null);
                  setQuickPick(null);
                  setBusca("");
                }}
              >
                <option value="">Selecione…</option>
                {representadaOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tabela de preço" hint={loadingCat ? "carregando…" : undefined}>
              <Select
                value={tabelaId}
                onChange={(e) => setTabelaId(e.target.value)}
                disabled={!cat || cat.tabelas.length === 0}
              >
                <option value="">— sem tabela (preço manual) —</option>
                {cat?.tabelas.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                    {t.ativa ? "" : " (inativa)"}
                  </option>
                ))}
              </Select>
            </Field>
          </FormGrid>
        </CardBody>
      </Card>

      {representadaId && (
        <Card>
          <CardHeader
            title="Produtos"
            description={
              itens.length > 0
                ? `${itens.length} ${itens.length === 1 ? "item" : "itens"} · ${itens.reduce(
                    (s, i) => s + (Number(i.quantidade) || 0),
                    0
                  )} un.`
                : undefined
            }
            action={
              cat ? (
                <ImportarItensPedido
                  skuIndex={skuIndex}
                  skusNoPedido={skusNoPedido}
                  onImport={importarItens}
                />
              ) : null
            }
          />
          <CardBody className="space-y-3">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                ref={buscaRef}
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setHi(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHi((h) => Math.min(h + 1, pickEntries.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHi((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    pegarBusca();
                  } else if (e.key === "Escape") {
                    setBusca("");
                  }
                }}
                placeholder="SKU ou nome — Enter escolhe, digita a qtd, Enter adiciona"
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-9 pr-3 text-sm focus:border-brand/40 focus:outline-none focus:ring-2 focus:ring-brand/10"
              />
              {busca && !quickPick && pickEntries.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg">
                  {pickEntries.map((e, i) => (
                    <button
                      key={e.key}
                      type="button"
                      onClick={() => {
                        setQuickPick(e);
                        setQuickQty("1");
                      }}
                      onMouseEnter={() => setHi(i)}
                      className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm ${
                        i === hi ? "bg-brand/10" : "hover:bg-neutral-50"
                      }`}
                    >
                      <span>
                        <span className="font-mono text-xs text-neutral-500">{e.sku}</span>{" "}
                        <span className="text-neutral-800">{e.label}</span>
                      </span>
                      <span className="text-xs text-neutral-500">
                        {e.preco != null ? formatBRL(e.preco) : "sem preço"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {busca && !quickPick && pickEntries.length === 0 && (
                <p className="mt-1 text-xs text-neutral-400">Nenhum produto para “{busca}”.</p>
              )}
            </div>

            {quickPick && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-brand/5 px-3 py-2 text-sm">
                <span className="font-mono text-xs text-neutral-500">{quickPick.sku}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-800">{quickPick.label}</span>
                <span className="text-neutral-500">Qtd</span>
                <input
                  ref={qtyRef}
                  value={quickQty}
                  onChange={(e) => setQuickQty(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmarQuick();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelarQuick();
                    }
                  }}
                  inputMode="numeric"
                  className="w-20 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
                />
                <Button type="button" size="sm" onClick={confirmarQuick}>
                  <Plus size={14} /> Adicionar
                </Button>
                <button
                  type="button"
                  onClick={cancelarQuick}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="Cancelar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}

            <TableScroll>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Produto</Th>
                    <Th className="text-right">Qtd</Th>
                    <Th className="text-right">Preço tabela</Th>
                    <Th className="text-right">Descontos % (cascata)</Th>
                    <Th className="text-right">Unit. c/ desc.</Th>
                    <Th className="text-right">Total</Th>
                    <Th />
                  </Tr>
                </Thead>
                <Tbody>
                  {itens.length === 0 ? (
                    <TableEmpty colSpan={7}>Use a busca acima para adicionar produtos.</TableEmpty>
                  ) : (
                    itens.map((it, idx) => {
                      const ci = calc.itens[idx];
                      const key = itemKey(it);
                      return (
                        <Tr key={key}>
                          <Td>
                            <span className="font-mono text-xs text-neutral-500">{it.sku}</span>
                            <div className="text-neutral-800">{it.nome}</div>
                          </Td>
                          <Td className="text-right">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={it.quantidade}
                              onChange={(e) => updateItem(key, { quantidade: Number(e.target.value) })}
                              className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
                            />
                          </Td>
                          <Td className="text-right">
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={it.preco_tabela}
                              onChange={(e) => updateItem(key, { preco_tabela: Number(e.target.value) })}
                              className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-right text-sm"
                              disabled={!!tabelaId}
                            />
                          </Td>
                          <Td className="text-right align-top">
                            <div className="inline-flex flex-col items-end gap-0.5">
                              <CascataFields
                                compact
                                value={toStr4(it.desconto_cascata)}
                                onChange={(v) =>
                                  updateItem(key, {
                                    desconto_cascata: parseCascata(v),
                                    desconto_item_percentual: 0,
                                  })
                                }
                              />
                              {ci && ci.desconto_item_percentual > 0 && (
                                <span className="text-[11px] text-neutral-400">
                                  = {ci.desconto_item_percentual.toFixed(2)}%
                                </span>
                              )}
                            </div>
                          </Td>
                          <Td className="text-right tabular-nums">
                            {formatBRL(ci?.preco_unitario_final ?? (Number(it.preco_tabela) || 0))}
                            {ci && ci.desconto_item_percentual > 0 && (
                              <div className="text-[11px] text-neutral-400">
                                de {formatBRL(Number(it.preco_tabela) || 0)}
                              </div>
                            )}
                          </Td>
                          <Td className="text-right font-medium">{formatBRL(ci?.valor_total ?? 0)}</Td>
                          <Td className="text-right">
                            <button
                              type="button"
                              onClick={() => removeItem(key)}
                              className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                            >
                              <Trash2 size={14} />
                            </button>
                          </Td>
                        </Tr>
                      );
                    })
                  )}
                </Tbody>
              </Table>
            </TableScroll>
          </CardBody>
        </Card>
      )}

      {itens.length > 0 && (
        <Card>
          <CardHeader title="Desconto e total" />
          <CardBody>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <Field label="Desconto adicional (sobre o subtotal)">
                  <div className="space-y-2">
                    <Select
                      value={descModo}
                      onChange={(e) => setDescModo(e.target.value as "percentual" | "valor")}
                      className="w-full sm:w-44"
                    >
                      <option value="percentual">Cascata (%)</option>
                      <option value="valor">Valor fixo (R$)</option>
                    </Select>
                    {descModo === "percentual" ? (
                      <>
                        <CascataFields value={cascPedido} onChange={alterarCascPedido} />
                        <p className="text-xs text-neutral-400">
                          Aplicados um sobre o outro (não somados).
                          {cascPedidoNums.length > 0 && (
                            <> Efetivo: <strong>{calc.desconto_percentual.toFixed(2)}%</strong></>
                          )}
                        </p>
                      </>
                    ) : (
                      <Input
                        inputMode="decimal"
                        value={descInput}
                        onChange={(e) => setDescInput(e.target.value)}
                      />
                    )}
                  </div>
                </Field>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm">
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">
                    Itens ({itens.length} {itens.length === 1 ? "linha" : "linhas"})
                  </span>
                  <span className="font-medium">
                    {itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0)} un.
                  </span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">Subtotal</span>
                  <span className="font-medium">{formatBRL(calc.subtotal)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-neutral-500">
                    Desconto adicional (
                    {descModo === "percentual" && cascPedidoNums.length > 1
                      ? `${cascPedidoNums.map((n) => String(n).replace(".", ",")).join("+")} = `
                      : ""}
                    {calc.desconto_percentual.toFixed(2)}%)
                  </span>
                  <span className="font-medium text-red-600">− {formatBRL(calc.desconto_valor)}</span>
                </div>
                <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2 text-base font-bold">
                  <span>Total</span>
                  <span>{formatBRL(calc.valor_total)}</span>
                </div>
              </div>
            </div>

            {avisos.length > 0 && (
              <div className="mt-4 space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
                {avisos.map((a, i) => (
                  <p key={i} className="flex items-start gap-1.5">
                    <AlertTriangle size={13} className="mt-0.5 shrink-0" /> {a}
                  </p>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Condições" />
        <CardBody>
          <FormGrid>
            <Field label="Condição de pagamento">
              <Select value={cond} onChange={(e) => setCond(e.target.value)}>
                <option value="">—</option>
                {CONDICAO_PAGAMENTO_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Forma de pagamento">
              <Input value={forma} onChange={(e) => setForma(e.target.value)} placeholder="Boleto, PIX, cartão…" />
            </Field>
            <Field label="Previsão de entrega">
              <Input type="date" value={previsao} onChange={(e) => setPrevisao(e.target.value)} />
            </Field>
          </FormGrid>
          <Field label="Observação para o cliente" className="mt-4">
            <Textarea value={obsCliente} onChange={(e) => setObsCliente(e.target.value)} />
          </Field>
          <Field label="Observação interna" className="mt-4">
            <Textarea value={obsInterna} onChange={(e) => setObsInterna(e.target.value)} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-200 pt-4">
        {jaGerado ? (
          <Button onClick={salvar} loading={pending}>
            Salvar alterações
          </Button>
        ) : (
          <>
            <Button onClick={gerar} loading={pending}>
              Gerar pedido
            </Button>
            <Button variant="outline" onClick={salvar} loading={pending}>
              {initial ? "Salvar orçamento" : "Salvar como orçamento"}
            </Button>
          </>
        )}
        <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
