"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { DropProdutoRow } from "@/lib/sistema/types";
import {
  salvarDropProduto,
  excluirDropProduto,
  salvarDropProdutosEmMassa,
  type PatchDropProdutosEmMassa,
} from "@/lib/sistema/actions/dropshipping";
import { SELLER_INTERESSE_OPTIONS, SELLER_METODO_ENVIO_OPTIONS } from "@/lib/sistema/schemas";
import { formatBRL } from "@/lib/sistema/format";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

const SEM_FORNECEDOR = "__sem_fornecedor__";

interface CategoriaMlSugestao { id: string; nome: string; caminho: string[] }

const empty = {
  id: null as string | null,
  sku: "", nome: "", descricao: "", imagens: "", marca: "", fornecedor_id: "",
  ml_category_id: "", ml_category_nome: "", categoria_interna: "",
  transporte_aceito: [] as string[],
  estoque_atual: "0", estoque_minimo: "0", ativo: true,
  custoCnpj: "", precoSugeridoCnpj: "",
};

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-neutral-300 text-neutral-700 hover:border-brand/50"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProdutosView({
  produtos,
  fornecedores,
  podeEditar,
}: {
  produtos: DropProdutoRow[];
  fornecedores: { id: string; label: string }[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [del, setDel] = useState<DropProdutoRow | null>(null);
  const [buscandoMl, setBuscandoMl] = useState(false);
  const [sugestoesMl, setSugestoesMl] = useState<CategoriaMlSugestao[] | null>(null);
  const set = (k: keyof typeof empty, v: string | boolean | string[]) => setF((s) => ({ ...s, [k]: v }));

  // ───────────────────── Seleção múltipla / edição em massa ─────────────────────
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [massaCategoria, setMassaCategoria] = useState("");
  const [massaTransporte, setMassaTransporte] = useState<string[]>([]);
  const [massaBuscaMl, setMassaBuscaMl] = useState("");
  const [massaSugestoesMl, setMassaSugestoesMl] = useState<CategoriaMlSugestao[] | null>(null);
  const [buscandoMassaMl, setBuscandoMassaMl] = useState(false);

  function toggleSelecionado(id: string) {
    setSelecionados((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleGrupoInteiro(ids: string[]) {
    setSelecionados((s) => {
      const todosNoGrupoJaSelecionados = ids.every((id) => s.has(id));
      const next = new Set(s);
      for (const id of ids) {
        if (todosNoGrupoJaSelecionados) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }
  function limparSelecao() {
    setSelecionados(new Set());
    setMassaCategoria("");
    setMassaTransporte([]);
    setMassaBuscaMl("");
    setMassaSugestoesMl(null);
  }
  function toggleMassaTransporte(valor: string) {
    setMassaTransporte((s) => (s.includes(valor) ? s.filter((t) => t !== valor) : [...s, valor]));
  }
  function aplicarEmMassa(patch: PatchDropProdutosEmMassa) {
    start(async () => {
      const res = await salvarDropProdutosEmMassa([...selecionados], patch);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.atualizados} produto(s) atualizado(s).`);
      limparSelecao();
      router.refresh();
    });
  }
  async function buscarCategoriaMlMassa() {
    if (!massaBuscaMl.trim()) return toast.error("Digite um termo pra buscar a categoria.");
    setBuscandoMassaMl(true);
    setMassaSugestoesMl(null);
    try {
      const res = await fetch(`/api/sistema/ml/categoria-preditor?q=${encodeURIComponent(massaBuscaMl.trim())}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Falha ao buscar categorias do Mercado Livre."); return; }
      setMassaSugestoesMl(json as CategoriaMlSugestao[]);
    } catch {
      toast.error("Erro de rede ao buscar categorias.");
    } finally {
      setBuscandoMassaMl(false);
    }
  }

  const grupos = useMemo(() => {
    const porFornecedor = new Map<string, DropProdutoRow[]>();
    for (const p of produtos) {
      const chave = p.fornecedor_id ?? SEM_FORNECEDOR;
      if (!porFornecedor.has(chave)) porFornecedor.set(chave, []);
      porFornecedor.get(chave)!.push(p);
    }
    const grupos = fornecedores
      .map((fo) => ({ id: fo.id, label: fo.label, itens: porFornecedor.get(fo.id) ?? [] }))
      .filter((g) => g.itens.length > 0);
    const semFornecedor = porFornecedor.get(SEM_FORNECEDOR);
    if (semFornecedor?.length) grupos.push({ id: SEM_FORNECEDOR, label: "Sem fornecedor", itens: semFornecedor });
    return grupos;
  }, [produtos, fornecedores]);

  function novoProdutoPara(fornecedorId?: string) {
    setF({ ...empty, fornecedor_id: fornecedorId && fornecedorId !== SEM_FORNECEDOR ? fornecedorId : "" });
    setSugestoesMl(null);
    setOpen(true);
  }

  async function buscarCategoriaMl() {
    setBuscandoMl(true);
    setSugestoesMl(null);
    try {
      const res = await fetch(`/api/sistema/ml/categoria-preditor?q=${encodeURIComponent(f.nome.trim())}`);
      const json = await res.json();
      if (!res.ok) { toast.error(json.error ?? "Falha ao buscar categorias do Mercado Livre."); return; }
      setSugestoesMl(json as CategoriaMlSugestao[]);
    } catch {
      toast.error("Erro de rede ao buscar categorias.");
    } finally {
      setBuscandoMl(false);
    }
  }

  function escolherCategoriaMl(s: CategoriaMlSugestao) {
    set("ml_category_id", s.id);
    set("ml_category_nome", [...s.caminho, s.nome].join(" > "));
    setSugestoesMl(null);
  }

  function editar(x: DropProdutoRow) {
    setF({
      id: x.id, sku: x.sku, nome: x.nome, descricao: x.descricao ?? "",
      imagens: (x.imagens?.length ? x.imagens : x.imagem_url ? [x.imagem_url] : []).join("\n"),
      marca: x.marca ?? "", fornecedor_id: x.fornecedor_id ?? "",
      ml_category_id: x.ml_category_id ?? "", ml_category_nome: x.ml_category_nome ?? "",
      categoria_interna: x.categoria_interna ?? "", transporte_aceito: x.transporte_aceito ?? [],
      estoque_atual: String(x.estoque_atual), estoque_minimo: String(x.estoque_minimo),
      ativo: x.ativo,
      custoCnpj: x.custoCnpj != null ? String(x.custoCnpj) : "",
      precoSugeridoCnpj: x.precoSugeridoCnpj != null ? String(x.precoSugeridoCnpj) : "",
    });
    setSugestoesMl(null);
    setOpen(true);
  }
  function salvar() {
    if (f.sku.trim().length < 1) return toast.error("Informe o SKU.");
    if (f.nome.trim().length < 2) return toast.error("Informe o nome.");
    start(async () => {
      const res = await salvarDropProduto(f.id, {
        ...f,
        imagens: f.imagens.split("\n").map((u) => u.trim()).filter(Boolean),
        estoque_atual: Number(f.estoque_atual) || 0,
        estoque_minimo: Number(f.estoque_minimo) || 0,
        custoCnpj: f.custoCnpj ? Number(f.custoCnpj) : null,
        precoSugeridoCnpj: f.precoSugeridoCnpj ? Number(f.precoSugeridoCnpj) : null,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Produto salvo.");
      setOpen(false);
      router.refresh();
    });
  }
  function remover() {
    const x = del;
    setDel(null);
    if (!x) return;
    start(async () => {
      const res = await excluirDropProduto(x.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Excluído.");
      router.refresh();
    });
  }

  return (
    <div>
      {podeEditar && (
        <div className="mb-4 flex justify-end">
          <Button onClick={() => novoProdutoPara()}>
            <Plus size={15} /> Novo produto
          </Button>
        </div>
      )}

      {podeEditar && selecionados.size > 0 && (
        <Card className="mb-4 border-brand/40">
          <CardHeader
            title={`${selecionados.size} produto(s) selecionado(s)`}
            description="Aplica a mesma alteração pra todos de uma vez."
            action={
              <button onClick={limparSelecao} className="text-xs font-medium text-neutral-500 hover:text-neutral-800">
                Limpar seleção
              </button>
            }
          />
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Categoria interna" className="min-w-[220px]">
                <Select value={massaCategoria} onChange={(e) => setMassaCategoria(e.target.value)}>
                  <option value="">Selecione...</option>
                  {SELLER_INTERESSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Button
                variant="outline"
                size="sm"
                disabled={!massaCategoria}
                loading={pending}
                onClick={() => aplicarEmMassa({ categoria_interna: massaCategoria })}
              >
                Aplicar categoria
              </Button>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                Transporte aceito <span className="font-normal normal-case text-neutral-400">(pode marcar mais de um)</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {SELLER_METODO_ENVIO_OPTIONS.map((o) => (
                  <Chip key={o.value} active={massaTransporte.includes(o.value)} onClick={() => toggleMassaTransporte(o.value)}>
                    {o.label}
                  </Chip>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={massaTransporte.length === 0}
                  loading={pending}
                  onClick={() => aplicarEmMassa({ transporte_aceito: massaTransporte })}
                >
                  Aplicar transporte
                </Button>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
                Categoria no Mercado Livre — liga a categoria interna com a externa pra todos de uma vez
              </p>
              <div className="flex items-center gap-2">
                <Input
                  value={massaBuscaMl}
                  onChange={(e) => setMassaBuscaMl(e.target.value)}
                  placeholder="Ex.: apoio de braço"
                  className="max-w-xs"
                />
                <Button type="button" variant="outline" size="sm" onClick={buscarCategoriaMlMassa} loading={buscandoMassaMl}>
                  <Search size={14} /> Buscar
                </Button>
              </div>
              {massaSugestoesMl && (
                <div className="mt-2 max-w-md overflow-hidden rounded-lg border border-neutral-200">
                  {massaSugestoesMl.length === 0 ? (
                    <p className="p-3 text-sm text-neutral-400">Nenhuma sugestão encontrada.</p>
                  ) : (
                    massaSugestoesMl.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          aplicarEmMassa({ ml_category_id: s.id, ml_category_nome: [...s.caminho, s.nome].join(" > ") });
                          setMassaSugestoesMl(null);
                        }}
                        className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50"
                      >
                        <span className="text-neutral-900">{s.nome}</span>
                        {s.caminho.length > 0 && <span className="block text-xs text-neutral-400">{s.caminho.join(" > ")}</span>}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {produtos.length === 0 ? (
        <EmptyState title="Nenhum produto" description="Cadastre um produto ou importe pelo CSV de fornecedores." />
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => {
            const idsDoGrupo = g.itens.map((p) => p.id);
            const grupoTodoSelecionado = idsDoGrupo.every((id) => selecionados.has(id));
            return (
              <Card key={g.id}>
                <CardHeader
                  title={g.label}
                  description={`${g.itens.length} produto${g.itens.length !== 1 ? "s" : ""}`}
                  action={
                    podeEditar && (
                      <button
                        onClick={() => novoProdutoPara(g.id)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                      >
                        <Plus size={13} /> Produto
                      </button>
                    )
                  }
                />
                <CardBody className="p-0">
                  <TableScroll>
                    <Table>
                      <Thead>
                        <Tr>
                          {podeEditar && (
                            <Th>
                              <input
                                type="checkbox"
                                checked={grupoTodoSelecionado}
                                onChange={() => toggleGrupoInteiro(idsDoGrupo)}
                                className="h-4 w-4 rounded border-neutral-300 text-brand"
                              />
                            </Th>
                          )}
                          <Th>SKU</Th>
                          <Th>Produto</Th>
                          <Th>Categoria</Th>
                          <Th className="text-right">Custo</Th>
                          <Th className="text-right">Sugerido</Th>
                          <Th className="text-right">Estoque</Th>
                          <Th>Status</Th>
                          {podeEditar && <Th className="text-right">Ações</Th>}
                        </Tr>
                      </Thead>
                      <Tbody>
                        {g.itens.map((p) => (
                          <Tr key={p.id}>
                            {podeEditar && (
                              <Td>
                                <input
                                  type="checkbox"
                                  checked={selecionados.has(p.id)}
                                  onChange={() => toggleSelecionado(p.id)}
                                  className="h-4 w-4 rounded border-neutral-300 text-brand"
                                />
                              </Td>
                            )}
                            <Td className="font-mono text-xs">{p.sku}</Td>
                            <Td className="font-medium text-neutral-900">{p.nome}</Td>
                            <Td className="text-xs text-neutral-500">{p.categoria_interna ?? "—"}</Td>
                            <Td className="text-right">{p.custoCnpj != null ? formatBRL(p.custoCnpj) : "—"}</Td>
                            <Td className="text-right">{p.precoSugeridoCnpj != null ? formatBRL(p.precoSugeridoCnpj) : "—"}</Td>
                            <Td className="text-right">{p.estoque_atual}</Td>
                            <Td><Badge tone={p.ativo ? "green" : "neutral"}>{p.ativo ? "Ativo" : "Inativo"}</Badge></Td>
                            {podeEditar && (
                              <Td className="text-right">
                                <div className="flex justify-end gap-1">
                                  <button onClick={() => editar(p)} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Pencil size={14} /></button>
                                  <button onClick={() => setDel(p)} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                                </div>
                              </Td>
                            )}
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableScroll>
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={f.id ? "Editar produto" : "Novo produto"}
        size="lg"
        footer={<Button onClick={salvar} loading={pending}>Salvar</Button>}
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="SKU" required><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
            <Field label="Nome" required><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
            <Field label="Fornecedor">
              <Select value={f.fornecedor_id} onChange={(e) => set("fornecedor_id", e.target.value)}>
                <option value="">Selecione...</option>
                {fornecedores.map((fo) => <option key={fo.id} value={fo.id}>{fo.label}</option>)}
              </Select>
            </Field>
            <Field label="Marca"><Input value={f.marca} onChange={(e) => set("marca", e.target.value)} /></Field>
            <Field label="Categoria interna">
              <Select value={f.categoria_interna} onChange={(e) => set("categoria_interna", e.target.value)}>
                <option value="">Selecione...</option>
                {SELLER_INTERESSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </Select>
            </Field>
            <Field label="Estoque atual"><Input value={f.estoque_atual} onChange={(e) => set("estoque_atual", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Estoque mínimo"><Input value={f.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} inputMode="numeric" /></Field>
          </FormGrid>
          <Field label="Descrição"><Textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></Field>
          <Field label="Fotos" hint="Uma URL por linha — a primeira vira a capa mostrada pro seller e enviada ao Mercado Livre.">
            <Textarea
              value={f.imagens}
              onChange={(e) => set("imagens", e.target.value)}
              rows={3}
              placeholder={"https://exemplo.com/foto1.jpg\nhttps://exemplo.com/foto2.jpg"}
            />
          </Field>

          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Categoria no Mercado Livre</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
                {f.ml_category_nome || <span className="text-neutral-400">Nenhuma categoria definida</span>}
              </div>
              <Button type="button" variant="outline" size="sm" onClick={buscarCategoriaMl} loading={buscandoMl}>
                <Search size={14} /> Buscar categoria
              </Button>
            </div>
            {sugestoesMl && (
              <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200">
                {sugestoesMl.length === 0 ? (
                  <p className="p-3 text-sm text-neutral-400">Nenhuma sugestão encontrada.</p>
                ) : (
                  sugestoesMl.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => escolherCategoriaMl(s)}
                      className="block w-full border-b border-neutral-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-neutral-50"
                    >
                      <span className="text-neutral-900">{s.nome}</span>
                      {s.caminho.length > 0 && (
                        <span className="block text-xs text-neutral-400">{s.caminho.join(" > ")}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">
              Transporte aceito <span className="font-normal normal-case text-neutral-400">(pode marcar mais de um)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SELLER_METODO_ENVIO_OPTIONS.map((o) => (
                <Chip
                  key={o.value}
                  active={f.transporte_aceito.includes(o.value)}
                  onClick={() =>
                    setF((s) => ({
                      ...s,
                      transporte_aceito: s.transporte_aceito.includes(o.value)
                        ? s.transporte_aceito.filter((t) => t !== o.value)
                        : [...s.transporte_aceito, o.value],
                    }))
                  }
                >
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Preço</p>
            <FormGrid>
              <Field label="Custo real de fábrica"><Input value={f.custoCnpj} onChange={(e) => set("custoCnpj", e.target.value)} inputMode="decimal" /></Field>
              <Field label="Preço sugerido de revenda"><Input value={f.precoSugeridoCnpj} onChange={(e) => set("precoSugeridoCnpj", e.target.value)} inputMode="decimal" /></Field>
            </FormGrid>
          </div>

          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" checked={f.ativo} onChange={(e) => set("ativo", e.target.checked)} className="h-4 w-4 rounded border-neutral-300 text-brand" />
            Ativo
          </label>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!del}
        onClose={() => setDel(null)}
        onConfirm={remover}
        title="Excluir produto?"
        message={del ? `"${del.nome}" será removido.` : ""}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
