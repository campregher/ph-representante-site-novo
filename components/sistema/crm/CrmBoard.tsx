"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import { CRM_ETAPA_OPTIONS } from "@/lib/sistema/types";
import { salvarOportunidade, moverEtapa, excluirOportunidade } from "@/lib/sistema/actions/crm";
import { formatBRL, formatDate } from "@/lib/sistema/format";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";

export interface OportItem {
  id: string;
  cliente_id: string;
  cliente: string;
  responsavel_id: string | null;
  responsavel: string | null;
  etapa: string;
  representada_id: string | null;
  valor_estimado: number;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  observacoes: string | null;
}
interface Opt {
  id: string;
  label: string;
}

const ETAPAS: string[] = CRM_ETAPA_OPTIONS.map((e) => e.value);

const emptyForm = {
  id: null as string | null,
  cliente_id: "",
  responsavel_id: "",
  etapa: "prospect",
  representada_id: "",
  valor_estimado: "",
  proxima_acao: "",
  data_proxima_acao: "",
  observacoes: "",
};

export default function CrmBoard({
  oportunidades,
  clientes,
  representadas,
  responsaveis,
  podeAtribuir,
}: {
  oportunidades: OportItem[];
  clientes: Opt[];
  representadas: Opt[];
  responsaveis: Opt[];
  podeAtribuir: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const set = (k: keyof typeof emptyForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  function novo() {
    setForm({ ...emptyForm });
    setOpen(true);
  }
  function editar(o: OportItem) {
    setForm({
      id: o.id,
      cliente_id: o.cliente_id,
      responsavel_id: o.responsavel_id ?? "",
      etapa: o.etapa,
      representada_id: o.representada_id ?? "",
      valor_estimado: o.valor_estimado ? String(o.valor_estimado) : "",
      proxima_acao: o.proxima_acao ?? "",
      data_proxima_acao: o.data_proxima_acao ?? "",
      observacoes: o.observacoes ?? "",
    });
    setOpen(true);
  }

  function salvar() {
    if (!form.cliente_id) {
      toast.error("Selecione o cliente.");
      return;
    }
    start(async () => {
      const res = await salvarOportunidade(form.id, {
        cliente_id: form.cliente_id,
        responsavel_id: form.responsavel_id,
        etapa: form.etapa,
        representada_id: form.representada_id,
        valor_estimado: form.valor_estimado,
        proxima_acao: form.proxima_acao,
        data_proxima_acao: form.data_proxima_acao,
        observacoes: form.observacoes,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Oportunidade salva.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  function mover(o: OportItem, dir: -1 | 1) {
    const i = ETAPAS.indexOf(o.etapa);
    const next = ETAPAS[i + dir];
    if (!next) return;
    start(async () => {
      const res = await moverEtapa(o.id, next);
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }
  function remover(o: OportItem) {
    if (!confirm(`Excluir a oportunidade de "${o.cliente}"?`)) return;
    start(async () => {
      const res = await excluirOportunidade(o.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Oportunidade excluída.");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={novo}>
          <Plus size={15} /> Nova oportunidade
        </Button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-3 [scrollbar-gutter:stable]">
        {CRM_ETAPA_OPTIONS.map((et) => {
          const itens = oportunidades.filter((o) => o.etapa === et.value);
          const total = itens.reduce((s, o) => s + o.valor_estimado, 0);
          return (
            <div key={et.value} className="w-64 shrink-0">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wide text-neutral-500">
                  {et.label}
                </span>
                <span className="text-xs text-neutral-400">{itens.length}</span>
              </div>
              {total > 0 && (
                <div className="mb-2 px-1 text-xs text-neutral-400">{formatBRL(total)}</div>
              )}
              <div className="space-y-2">
                {itens.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-xl border border-neutral-200 bg-white p-3 text-sm shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/sistema/clientes/${o.cliente_id}`}
                        className="min-w-0 flex-1 truncate font-medium text-neutral-800 hover:text-brand hover:underline"
                      >
                        {o.cliente}
                      </Link>
                      <div className="flex shrink-0 gap-0.5">
                        <button
                          onClick={() => editar(o)}
                          className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                          aria-label="Editar"
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => remover(o)}
                          className="rounded p-1 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          aria-label="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    {o.valor_estimado > 0 && (
                      <div className="mt-1 text-xs font-medium text-neutral-600">
                        {formatBRL(o.valor_estimado)}
                      </div>
                    )}
                    {o.proxima_acao && (
                      <div className="mt-1 text-xs text-neutral-500">{o.proxima_acao}</div>
                    )}
                    {o.data_proxima_acao && (
                      <div className="text-xs text-neutral-400">{formatDate(o.data_proxima_acao)}</div>
                    )}
                    {podeAtribuir && o.responsavel && (
                      <div className="mt-1 text-xs text-neutral-400">{o.responsavel}</div>
                    )}
                    <div className="mt-2 flex items-center justify-between border-t border-neutral-100 pt-1.5">
                      <button
                        onClick={() => mover(o, -1)}
                        disabled={pending || ETAPAS.indexOf(o.etapa) === 0}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                        aria-label="Etapa anterior"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <button
                        onClick={() => mover(o, 1)}
                        disabled={pending || ETAPAS.indexOf(o.etapa) === ETAPAS.length - 1}
                        className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30"
                        aria-label="Próxima etapa"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {itens.length === 0 && (
                  <div className="rounded-xl border border-dashed border-neutral-200 py-6 text-center text-xs text-neutral-300">
                    —
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar oportunidade" : "Nova oportunidade"}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
            >
              <X size={14} /> Cancelar
            </button>
            <Button onClick={salvar} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Cliente" required>
              <Select value={form.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}>
                <option value="">Selecione…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Etapa">
              <Select value={form.etapa} onChange={(e) => set("etapa", e.target.value)}>
                {CRM_ETAPA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Representada">
              <Select
                value={form.representada_id}
                onChange={(e) => set("representada_id", e.target.value)}
              >
                <option value="">—</option>
                {representadas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Valor estimado (R$)">
              <Input
                value={form.valor_estimado}
                onChange={(e) => set("valor_estimado", e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Próxima ação">
              <Input value={form.proxima_acao} onChange={(e) => set("proxima_acao", e.target.value)} />
            </Field>
            <Field label="Data da próxima ação">
              <Input
                type="date"
                value={form.data_proxima_acao}
                onChange={(e) => set("data_proxima_acao", e.target.value)}
              />
            </Field>
            {podeAtribuir && (
              <Field label="Responsável">
                <Select
                  value={form.responsavel_id}
                  onChange={(e) => set("responsavel_id", e.target.value)}
                >
                  <option value="">Eu</option>
                  {responsaveis.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
          </FormGrid>
          <Field label="Observações">
            <Textarea
              value={form.observacoes}
              onChange={(e) => set("observacoes", e.target.value)}
              rows={3}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
