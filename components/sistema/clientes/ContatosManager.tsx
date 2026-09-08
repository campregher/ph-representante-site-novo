"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { saveContato, deleteContato } from "@/lib/sistema/actions/clientes";
import { formatPhone } from "@/lib/sistema/format";
import type { ClienteContato } from "@/lib/sistema/types";
import { Button } from "@/components/sistema/ui/Button";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Field, Input, Checkbox, FormGrid } from "@/components/sistema/ui/Field";
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

type Draft = {
  id?: string;
  nome: string;
  cargo: string;
  telefone: string;
  whatsapp: string;
  email: string;
  principal: boolean;
};

const empty: Draft = {
  nome: "",
  cargo: "",
  telefone: "",
  whatsapp: "",
  email: "",
  principal: false,
};

export default function ContatosManager({
  clienteId,
  contatos,
  readOnly,
}: {
  clienteId: string;
  contatos: ClienteContato[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [delId, setDelId] = useState<string | null>(null);

  function openNew() {
    setDraft(empty);
    setOpen(true);
  }
  function openEdit(c: ClienteContato) {
    setDraft({
      id: c.id,
      nome: c.nome,
      cargo: c.cargo ?? "",
      telefone: c.telefone ?? "",
      whatsapp: c.whatsapp ?? "",
      email: c.email ?? "",
      principal: c.principal,
    });
    setOpen(true);
  }

  function save() {
    startTransition(async () => {
      const res = await saveContato(draft.id ?? null, { ...draft, cliente_id: clienteId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Contato salvo.");
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteContato(id, clienteId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Contato removido.");
        setDelId(null);
        router.refresh();
      }
    });
  }

  return (
    <div>
      {!readOnly && (
        <div className="mb-3 flex justify-end">
          <Button size="sm" onClick={openNew}>
            <Plus size={14} /> Novo contato
          </Button>
        </div>
      )}

      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>Nome</Th>
              <Th>Cargo</Th>
              <Th>Telefone</Th>
              <Th>E-mail</Th>
              {!readOnly && <Th className="text-right">Ações</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {contatos.length === 0 ? (
              <TableEmpty colSpan={readOnly ? 4 : 5}>Nenhum contato cadastrado.</TableEmpty>
            ) : (
              contatos.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    <span className="font-medium text-neutral-900">{c.nome}</span>
                    {c.principal && (
                      <Star size={12} className="ml-1 inline text-amber-500" fill="currentColor" />
                    )}
                  </Td>
                  <Td>{c.cargo || "—"}</Td>
                  <Td>{c.telefone ? formatPhone(c.telefone) : c.whatsapp ? formatPhone(c.whatsapp) : "—"}</Td>
                  <Td>{c.email || "—"}</Td>
                  {!readOnly && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDelId(c.id)}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </Td>
                  )}
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </TableScroll>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={draft.id ? "Editar contato" : "Novo contato"}
        size="lg"
        footer={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={save} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        <FormGrid>
          <Field label="Nome" required className="sm:col-span-2">
            <Input value={draft.nome} onChange={(e) => setDraft({ ...draft, nome: e.target.value })} autoFocus />
          </Field>
          <Field label="Cargo">
            <Input value={draft.cargo} onChange={(e) => setDraft({ ...draft, cargo: e.target.value })} />
          </Field>
          <Field label="Telefone">
            <Input value={draft.telefone} onChange={(e) => setDraft({ ...draft, telefone: e.target.value })} />
          </Field>
          <Field label="WhatsApp">
            <Input value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} />
          </Field>
          <Field label="E-mail">
            <Input
              type="email"
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            />
          </Field>
        </FormGrid>
        <div className="mt-3">
          <Checkbox
            checked={draft.principal}
            onChange={(e) => setDraft({ ...draft, principal: e.target.checked })}
            label="Contato principal"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && remove(delId)}
        title="Remover contato"
        message="Remover este contato do cliente?"
        confirmLabel="Remover"
        danger
        loading={pending}
      />
    </div>
  );
}
