"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { DropProdutoRow } from "@/lib/sistema/types";
import { salvarDropProduto, excluirDropProduto } from "@/lib/sistema/actions/dropshipping";
import { formatBRL } from "@/lib/sistema/format";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

const empty = {
  id: null as string | null,
  sku: "", nome: "", descricao: "", imagem_url: "", fornecedor_id: "",
  estoque_atual: "0", estoque_minimo: "0", ativo: true,
  custoCpf: "", precoSugeridoCpf: "", custoCnpj: "", precoSugeridoCnpj: "",
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
  const set = (k: keyof typeof empty, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function editar(x: DropProdutoRow) {
    setF({
      id: x.id, sku: x.sku, nome: x.nome, descricao: x.descricao ?? "", imagem_url: x.imagem_url ?? "",
      fornecedor_id: x.fornecedor_id ?? "", estoque_atual: String(x.estoque_atual), estoque_minimo: String(x.estoque_minimo),
      ativo: x.ativo,
      custoCpf: x.custoCpf != null ? String(x.custoCpf) : "",
      precoSugeridoCpf: x.precoSugeridoCpf != null ? String(x.precoSugeridoCpf) : "",
      custoCnpj: x.custoCnpj != null ? String(x.custoCnpj) : "",
      precoSugeridoCnpj: x.precoSugeridoCnpj != null ? String(x.precoSugeridoCnpj) : "",
    });
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
        custoCpf: f.custoCpf ? Number(f.custoCpf) : null,
        precoSugeridoCpf: f.precoSugeridoCpf ? Number(f.precoSugeridoCpf) : null,
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
          <Button onClick={() => { setF(empty); setOpen(true); }}>
            <Plus size={15} /> Novo produto
          </Button>
        </div>
      )}

      {produtos.length === 0 ? (
        <EmptyState title="Nenhum produto" description="Cadastre um produto ou importe pelo CSV de fornecedores." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>SKU</Th>
                <Th>Produto</Th>
                <Th>Fornecedor</Th>
                <Th className="text-right">Custo CPF</Th>
                <Th className="text-right">Sugerido CPF</Th>
                <Th className="text-right">Custo CNPJ</Th>
                <Th className="text-right">Sugerido CNPJ</Th>
                <Th className="text-right">Estoque</Th>
                <Th>Status</Th>
                {podeEditar && <Th className="text-right">Ações</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {produtos.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-mono text-xs">{p.sku}</Td>
                  <Td className="font-medium text-neutral-900">{p.nome}</Td>
                  <Td>{p.fornecedor ?? "—"}</Td>
                  <Td className="text-right">{p.custoCpf != null ? formatBRL(p.custoCpf) : "—"}</Td>
                  <Td className="text-right">{p.precoSugeridoCpf != null ? formatBRL(p.precoSugeridoCpf) : "—"}</Td>
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
            <Field label="URL da imagem"><Input value={f.imagem_url} onChange={(e) => set("imagem_url", e.target.value)} /></Field>
            <Field label="Estoque atual"><Input value={f.estoque_atual} onChange={(e) => set("estoque_atual", e.target.value)} inputMode="numeric" /></Field>
            <Field label="Estoque mínimo"><Input value={f.estoque_minimo} onChange={(e) => set("estoque_minimo", e.target.value)} inputMode="numeric" /></Field>
          </FormGrid>
          <Field label="Descrição"><Textarea value={f.descricao} onChange={(e) => set("descricao", e.target.value)} rows={2} /></Field>

          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Tabela CPF</p>
            <FormGrid>
              <Field label="Custo (preço que o CPF paga à PH)"><Input value={f.custoCpf} onChange={(e) => set("custoCpf", e.target.value)} inputMode="decimal" /></Field>
              <Field label="Preço sugerido de revenda"><Input value={f.precoSugeridoCpf} onChange={(e) => set("precoSugeridoCpf", e.target.value)} inputMode="decimal" /></Field>
            </FormGrid>
          </div>

          <div className="rounded-lg border border-neutral-200 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-neutral-500">Tabela CNPJ</p>
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
