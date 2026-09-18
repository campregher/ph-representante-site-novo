"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { salvarCategoriaLinhaPropria } from "@/lib/sistema/actions/linha-propria";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";

interface Categoria {
  id: string;
  nome: string;
  margem_minima_percentual: number | null;
  ativa: boolean;
}

const vazio = { nome: "", margem_minima_percentual: "", ativa: true };

export default function CategoriasLinhaPropriaManager({ categorias }: { categorias: Categoria[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(vazio);

  function abrirNova() {
    setEditId(null);
    setForm(vazio);
    setOpen(true);
  }

  function abrirEditar(c: Categoria) {
    setEditId(c.id);
    setForm({
      nome: c.nome,
      margem_minima_percentual: c.margem_minima_percentual != null ? String(c.margem_minima_percentual) : "",
      ativa: c.ativa,
    });
    setOpen(true);
  }

  function salvar() {
    if (form.nome.trim().length < 2) return toast.error("Informe o nome.");
    start(async () => {
      const res = await salvarCategoriaLinhaPropria(editId, form);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Categoria salva.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={abrirNova}>
          <Plus size={15} /> Nova categoria
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-3 py-2">Categoria</th>
              <th className="px-3 py-2">Margem mínima</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {categorias.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-400">
                  Nenhuma categoria da linha própria cadastrada.
                </td>
              </tr>
            ) : (
              categorias.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium text-neutral-800">{c.nome}</td>
                  <td className="px-3 py-2 text-neutral-600">
                    {c.margem_minima_percentual != null ? `${c.margem_minima_percentual}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={c.ativa ? "green" : "neutral"}>{c.ativa ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => abrirEditar(c)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                    >
                      <Pencil size={13} /> Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editId ? "Editar categoria" : "Nova categoria"}
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
            >
              Cancelar
            </button>
            <Button onClick={salvar} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome" required>
            <Input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
          </Field>
          <FormGrid>
            <Field
              label="Margem mínima (%)"
              hint="Preço mínimo de revenda do seller = custo ÷ (1 − margem)"
            >
              <Input
                value={form.margem_minima_percentual}
                onChange={(e) => setForm((f) => ({ ...f, margem_minima_percentual: e.target.value }))}
                inputMode="decimal"
              />
            </Field>
          </FormGrid>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.ativa}
              onChange={(e) => setForm((f) => ({ ...f, ativa: e.target.checked }))}
              className="h-4 w-4 rounded border-neutral-300 text-brand"
            />
            Ativa (aparece pra escolher nos produtos)
          </label>
        </div>
      </Modal>
    </div>
  );
}
