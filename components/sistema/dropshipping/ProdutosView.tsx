"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import type { DropProdutoRow } from "@/lib/sistema/types";
import { salvarDropProduto, excluirDropProduto } from "@/lib/sistema/actions/dropshipping";
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
  sku: "", nome: "", descricao: "", imagem_url: "", marca: "", fornecedor_id: "",
  ml_category_id: "", ml_category_nome: "",
  estoque_atual: "0", estoque_minimo: "0", ativo: true,
  custoCnpj: "", precoSugeridoCnpj: "",
};

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
  const set = (k: keyof typeof empty, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

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
      id: x.id, sku: x.sku, nome: x.nome, descricao: x.descricao ?? "", imagem_url: x.imagem_url ?? "",
      marca: x.marca ?? "", fornecedor_id: x.fornecedor_id ?? "",
      ml_category_id: x.ml_category_id ?? "", ml_category_nome: x.ml_category_nome ?? "",
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

      {produtos.length === 0 ? (
        <EmptyState title="Nenhum produto" description="Cadastre um produto ou importe pelo CSV de fornecedores." />
      ) : (
        <div className="space-y-4">
          {grupos.map((g) => (
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
                        <Th>SKU</Th>
                        <Th>Produto</Th>
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
                          <Td className="font-mono text-xs">{p.sku}</Td>
                          <Td className="font-medium text-neutral-900">{p.nome}</Td>
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
          ))}
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
            <Field label="URL da imagem"><Input value={f.imagem_url} onChange={(e) => set("imagem_url", e.target.value)} /></Field>
            <Field label="Estoque atual"><Input value={f.estoque_atual} onChange={(e) => set("estoque_atual", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Estoque mínimo"><Input value={f.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} inputMode="numeric" /></Field>
          </FormGrid>
          <Field label="Descrição"><Textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></Field>

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
