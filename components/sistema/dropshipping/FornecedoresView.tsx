"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload, Download } from "lucide-react";
import Link from "next/link";
import type { DropFornecedor } from "@/lib/sistema/types";
import { salvarDropFornecedor, excluirDropFornecedor, importarFornecedoresRepresentadas } from "@/lib/sistema/actions/dropshipping";
import { formatCNPJ, formatPhone } from "@/lib/sistema/format";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Field, Input, Textarea, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

const empty = {
  id: null as string | null,
  nome: "", razao_social: "", cnpj: "", telefone: "", whatsapp: "", email: "",
  observacoes: "", ativo: true,
};

export default function FornecedoresView({
  fornecedores,
  podeEditar,
}: {
  fornecedores: DropFornecedor[];
  podeEditar: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(empty);
  const [del, setDel] = useState<DropFornecedor | null>(null);
  const set = (k: keyof typeof empty, v: string | boolean) => setF((s) => ({ ...s, [k]: v }));

  function editar(x: DropFornecedor) {
    setF({
      id: x.id, nome: x.nome, razao_social: x.razao_social ?? "", cnpj: x.cnpj ?? "",
      telefone: x.telefone ?? "", whatsapp: x.whatsapp ?? "", email: x.email ?? "",
      observacoes: x.observacoes ?? "", ativo: x.ativo,
    });
    setOpen(true);
  }
  function salvar() {
    if (f.nome.trim().length < 2) return toast.error("Informe o nome.");
    start(async () => {
      const res = await salvarDropFornecedor(f.id, f);
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
      const res = await excluirDropFornecedor(x.id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Excluído.");
      router.refresh();
    });
  }
  function importarRepresentadas() {
    start(async () => {
      const res = await importarFornecedoresRepresentadas();
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${res.criados} fornecedor(es) importado(s)${res.ignorados ? `, ${res.ignorados} já existia(m)` : ""}.`);
      router.refresh();
    });
  }

  return (
    <div>
      {podeEditar && (
        <div className="mb-4 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={importarRepresentadas} loading={pending}>
            <Download size={15} /> Importar fornecedores do sistema
          </Button>
          <Link href="/sistema/dropshipping/fornecedores/importar" className={buttonClass({ variant: "outline", size: "sm" })}>
            <Upload size={15} /> Importar CSV
          </Link>
          <Button onClick={() => { setF(empty); setOpen(true); }}>
            <Plus size={15} /> Novo fornecedor
          </Button>
        </div>
      )}

      {fornecedores.length === 0 ? (
        <EmptyState title="Nenhum fornecedor" description="Cadastre de quem você compra ou importe por CSV." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Nome</Th>
                <Th>CNPJ</Th>
                <Th>Contato</Th>
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
