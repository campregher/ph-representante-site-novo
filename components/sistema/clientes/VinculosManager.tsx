"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { saveVinculo, deleteVinculo } from "@/lib/sistema/actions/clientes";
import { formatPercent, formatBRL } from "@/lib/sistema/format";
import { CONDICAO_PAGAMENTO_OPTIONS } from "@/lib/sistema/types";
import { Button } from "@/components/sistema/ui/Button";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
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

export interface VinculoRow {
  id: string;
  representada_id: string;
  representada_label: string;
  tabela_preco_id: string | null;
  tabela_label: string | null;
  condicao_pagamento: string | null;
  desconto_padrao: number | null;
  limite_credito: number | null;
  observacoes: string | null;
}

type Draft = {
  id?: string;
  representada_id: string;
  tabela_preco_id: string;
  condicao_pagamento: string;
  desconto_padrao: string;
  limite_credito: string;
  observacoes: string;
};

const empty: Draft = {
  representada_id: "",
  tabela_preco_id: "",
  condicao_pagamento: "",
  desconto_padrao: "",
  limite_credito: "",
  observacoes: "",
};

export default function VinculosManager({
  clienteId,
  vinculos,
  representadaOptions,
  tabelas,
  readOnly,
}: {
  clienteId: string;
  vinculos: VinculoRow[];
  representadaOptions: { id: string; label: string }[];
  tabelas: { id: string; nome: string; representada_id: string }[];
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(empty);
  const [delId, setDelId] = useState<string | null>(null);

  const tabelasDaRep = useMemo(
    () => tabelas.filter((t) => t.representada_id === draft.representada_id),
    [tabelas, draft.representada_id]
  );

  function openNew() {
    setDraft(empty);
    setOpen(true);
  }
  function openEdit(v: VinculoRow) {
    setDraft({
      id: v.id,
      representada_id: v.representada_id,
      tabela_preco_id: v.tabela_preco_id ?? "",
      condicao_pagamento: v.condicao_pagamento ?? "",
      desconto_padrao: v.desconto_padrao != null ? String(v.desconto_padrao).replace(".", ",") : "",
      limite_credito: v.limite_credito != null ? String(v.limite_credito) : "",
      observacoes: v.observacoes ?? "",
    });
    setOpen(true);
  }

  function save() {
    if (!draft.representada_id) {
      toast.error("Selecione a representada.");
      return;
    }
    startTransition(async () => {
      const res = await saveVinculo(draft.id ?? null, {
        cliente_id: clienteId,
        representada_id: draft.representada_id,
        tabela_preco_id: draft.tabela_preco_id,
        condicao_pagamento: draft.condicao_pagamento,
        desconto_padrao: draft.desconto_padrao,
        limite_credito: draft.limite_credito,
        observacoes: draft.observacoes,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Vínculo salvo.");
      setOpen(false);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const res = await deleteVinculo(id, clienteId);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Vínculo removido.");
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
            <Plus size={14} /> Vincular representada
          </Button>
        </div>
      )}

      <TableScroll>
        <Table>
          <Thead>
            <Tr>
              <Th>Representada</Th>
              <Th>Tabela de preço</Th>
              <Th>Condição</Th>
              <Th className="text-right">Desc. padrão</Th>
              <Th className="text-right">Limite</Th>
              {!readOnly && <Th className="text-right">Ações</Th>}
            </Tr>
          </Thead>
          <Tbody>
            {vinculos.length === 0 ? (
              <TableEmpty colSpan={readOnly ? 5 : 6}>
                Nenhuma representada vinculada. Vincule para definir tabela e condições próprias.
              </TableEmpty>
            ) : (
              vinculos.map((v) => (
                <Tr key={v.id}>
                  <Td className="font-medium text-neutral-900">{v.representada_label}</Td>
                  <Td>{v.tabela_label ?? "—"}</Td>
                  <Td>{v.condicao_pagamento ?? "—"}</Td>
                  <Td className="text-right">
                    {v.desconto_padrao ? formatPercent(v.desconto_padrao) : "—"}
                  </Td>
                  <Td className="text-right">
                    {v.limite_credito ? formatBRL(v.limite_credito) : "—"}
                  </Td>
                  {!readOnly && (
                    <Td className="text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(v)}
                          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() => setDelId(v.id)}
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
        title={draft.id ? "Editar vínculo" : "Vincular representada"}
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
          <Field label="Representada" required>
            <Select
              value={draft.representada_id}
              disabled={!!draft.id}
              onChange={(e) =>
                setDraft({ ...draft, representada_id: e.target.value, tabela_preco_id: "" })
              }
            >
              <option value="">Selecione…</option>
              {representadaOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tabela de preço">
            <Select
              value={draft.tabela_preco_id}
              disabled={!draft.representada_id}
              onChange={(e) => setDraft({ ...draft, tabela_preco_id: e.target.value })}
            >
              <option value="">— padrão / a definir —</option>
              {tabelasDaRep.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Condição de pagamento">
            <Select
              value={draft.condicao_pagamento}
              onChange={(e) => setDraft({ ...draft, condicao_pagamento: e.target.value })}
            >
              <option value="">—</option>
              {CONDICAO_PAGAMENTO_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Desconto padrão (%)">
            <Input
              type="text"
              inputMode="decimal"
              placeholder="ex.: 5 ou 5,5"
              value={draft.desconto_padrao}
              onChange={(e) => setDraft({ ...draft, desconto_padrao: e.target.value })}
            />
          </Field>
          <Field label="Limite de crédito (R$)">
            <Input
              type="number"
              step="0.01"
              min="0"
              value={draft.limite_credito}
              onChange={(e) => setDraft({ ...draft, limite_credito: e.target.value })}
            />
          </Field>
        </FormGrid>
        <Field label="Observações" className="mt-3">
          <Textarea
            value={draft.observacoes}
            onChange={(e) => setDraft({ ...draft, observacoes: e.target.value })}
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={!!delId}
        onClose={() => setDelId(null)}
        onConfirm={() => delId && remove(delId)}
        title="Remover vínculo"
        message="Remover o vínculo com esta representada?"
        confirmLabel="Remover"
        danger
        loading={pending}
      />
    </div>
  );
}
