"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import type { Fornecedor } from "@/lib/sistema/types";
import { salvarFornecedor, excluirFornecedor } from "@/lib/sistema/actions/linha-propria";
import { formatCNPJ, formatPhone } from "@/lib/sistema/format";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

const empty = {
  id: null as string | null,
  nome: "", razao_social: "", cnpj: "", telefone: "", whatsapp: "", email: "",
  cidade: "", estado: "", observacoes: "", ativo: true,
};

export default function FornecedoresView({
  fornecedores,
  podeEditar,
}: {
  fornecedores: Fornecedor[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [del, setDel] = useState<Fornecedor | null>(null);
  const set = (k: keyof typeof empty, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function editar(x: Fornecedor) {
    setF({
      id: x.id, nome: x.nome, razao_social: x.razao_social ?? "", cnpj: x.cnpj ?? "",
      telefone: x.telefone ?? "", whatsapp: x.whatsapp ?? "", email: x.email ?? "",
      cidade: x.cidade ?? "", estado: x.estado ?? "", observacoes: x.observacoes ?? "", ativo: x.ativo,
    });
    setOpen(true);
  }
  function salvar() {
    if (f.nome.trim().length < 2) return toast.error("Informe o nome.");
    start(async () => {
      const res = await salvarFornecedor(f.id, f);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Fornecedor salvo.");
      setOpen(false);
      router.refresh();
    });
  }
  function remover() {
    const x = del;
    setDel(null);
    if (!x) return;
    start(async () => {
      const res = await excluirFornecedor(x.id);
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
            <Plus size={15} /> Novo fornecedor
          </Button>
        </div>
      )}

      {fornecedores.length === 0 ? (
        <EmptyState title="Nenhum fornecedor" description="Cadastre de quem você compra." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>CNPJ</Th>
                <Th>Contato</Th>
                <Th>Cidade/UF</Th>
                <Th>Status</Th>
                {podeEditar && <Th className="text-right">Ações</Th>}
              </Tr>
            </Thead>
            <Tbody>
              {fornecedores.map((x) => (
                <Tr key={x.id}>
                  <Td className="font-medium text-neutral-900">{x.nome}</Td>
                  <Td>{x.cnpj ? formatCNPJ(x.cnpj) : "—"}</Td>
                  <Td>
                    {x.telefone || x.whatsapp ? formatPhone(x.telefone || x.whatsapp || "") : ""}
                    {x.email ? <div className="text-xs text-neutral-400">{x.email}</div> : null}
                  </Td>
                  <Td>{[x.cidade, x.estado].filter(Boolean).join(" / ") || "—"}</Td>
                  <Td><Badge tone={x.ativo ? "green" : "neutral"}>{x.ativo ? "Ativo" : "Inativo"}</Badge></Td>
                  {podeEditar && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => editar(x)} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Pencil size={14} /></button>
                        <button onClick={() => setDel(x)} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
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
        title={f.id ? "Editar fornecedor" : "Novo fornecedor"}
        size="lg"
        footer={<Button onClick={salvar} loading={pending}>Salvar</Button>}
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Nome" required><Input value={f.nome} onChange={(e) => set("nome", e.target.value)} /></Field>
            <Field label="Razão social"><Input value={f.razao_social} onChange={(e) => set("razao_social", e.target.value)} /></Field>
            <Field label="CNPJ"><Input value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} inputMode="numeric" /></Field>
            <Field label="E-mail"><Input value={f.email} onChange={(e) => set("email", e.target.value)} type="email" /></Field>
            <Field label="Telefone"><Input value={f.telefone} onChange={(e) => set("telefone", e.target.value)} inputMode="tel" /></Field>
            <Field label="WhatsApp"><Input value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} inputMode="tel" /></Field>
            <Field label="Cidade"><Input value={f.cidade} onChange={(e) => set("cidade", e.target.value)} /></Field>
            <Field label="UF"><Input value={f.estado} onChange={(e) => set("estado", e.target.value)} maxLength={2} /></Field>
          </FormGrid>
          <Field label="Observações"><Textarea value={f.observacoes} onChange={(e) => set("observacoes", e.target.value)} rows={2} /></Field>
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
        title="Excluir fornecedor?"
        message={del ? `"${del.nome}" será removido.` : ""}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
