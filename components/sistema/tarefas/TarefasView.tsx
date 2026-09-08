"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Check, Pencil, Trash2, X } from "lucide-react";
import {
  TAREFA_TIPO_OPTIONS,
  TAREFA_PRIORIDADE_OPTIONS,
  TAREFA_STATUS_OPTIONS,
} from "@/lib/sistema/types";
import { salvarTarefa, alterarStatusTarefa, excluirTarefa } from "@/lib/sistema/actions/tarefas";
import { formatDate, daysSince } from "@/lib/sistema/format";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";

export interface TarefaItem {
  id: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  cliente_id: string | null;
  representada_id: string | null;
  responsavel_id: string | null;
  responsavel: string | null;
  cliente: string | null;
  data_prevista: string | null;
  prioridade: string;
  status: string;
}
interface Opt {
  id: string;
  label: string;
}

const TIPO_LABEL = new Map<string, string>(
  TAREFA_TIPO_OPTIONS.map((o) => [o.value, o.label])
);
const PRIO_TONE: Record<string, "neutral" | "yellow" | "red"> = {
  baixa: "neutral",
  media: "yellow",
  alta: "red",
};

const emptyForm = {
  id: null as string | null,
  titulo: "",
  descricao: "",
  tipo: "followup",
  cliente_id: "",
  representada_id: "",
  responsavel_id: "",
  data_prevista: "",
  prioridade: "media",
  status: "pendente",
};

export default function TarefasView({
  tarefas,
  clientes,
  representadas,
  responsaveis,
  podeAtribuir,
}: {
  tarefas: TarefaItem[];
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
  function editar(t: TarefaItem) {
    setForm({
      id: t.id,
      titulo: t.titulo,
      descricao: t.descricao ?? "",
      tipo: t.tipo,
      cliente_id: t.cliente_id ?? "",
      representada_id: t.representada_id ?? "",
      responsavel_id: t.responsavel_id ?? "",
      data_prevista: t.data_prevista ?? "",
      prioridade: t.prioridade,
      status: t.status,
    });
    setOpen(true);
  }

  function salvar() {
    if (form.titulo.trim().length < 2) {
      toast.error("Informe um título.");
      return;
    }
    start(async () => {
      const res = await salvarTarefa(form.id, {
        titulo: form.titulo,
        descricao: form.descricao,
        tipo: form.tipo,
        cliente_id: form.cliente_id,
        representada_id: form.representada_id,
        responsavel_id: form.responsavel_id,
        data_prevista: form.data_prevista,
        prioridade: form.prioridade,
        status: form.status,
      });
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Tarefa salva.");
        setOpen(false);
        router.refresh();
      }
    });
  }

  function concluir(t: TarefaItem) {
    start(async () => {
      const res = await alterarStatusTarefa(t.id, t.status === "concluida" ? "pendente" : "concluida");
      if (!res.ok) toast.error(res.error);
      else router.refresh();
    });
  }
  function remover(t: TarefaItem) {
    if (!confirm(`Excluir a tarefa "${t.titulo}"?`)) return;
    start(async () => {
      const res = await excluirTarefa(t.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Tarefa excluída.");
        router.refresh();
      }
    });
  }

  const grupos = useMemo(() => {
    const abertas = tarefas.filter((t) => t.status !== "concluida" && t.status !== "cancelada");
    const atrasadas = abertas.filter(
      (t) => t.data_prevista && (daysSince(t.data_prevista) ?? 0) > 0
    );
    const hoje = abertas.filter(
      (t) => t.data_prevista && daysSince(t.data_prevista) === 0
    );
    const proximas = abertas.filter(
      (t) => !t.data_prevista || (daysSince(t.data_prevista) ?? -1) < 0
    );
    const feitas = tarefas.filter((t) => t.status === "concluida" || t.status === "cancelada");
    return { atrasadas, hoje, proximas, feitas };
  }, [tarefas]);

  const linha = (t: TarefaItem) => (
    <div
      key={t.id}
      className="flex items-start gap-3 border-b border-neutral-100 px-4 py-3 last:border-0"
    >
      <button
        onClick={() => concluir(t)}
        disabled={pending}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          t.status === "concluida"
            ? "border-green-500 bg-green-500 text-white"
            : "border-neutral-300 text-transparent hover:border-green-500"
        }`}
        aria-label="Concluir"
      >
        <Check size={12} />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm font-medium ${
              t.status === "concluida" ? "text-neutral-400 line-through" : "text-neutral-800"
            }`}
          >
            {t.titulo}
          </span>
          <Badge tone={PRIO_TONE[t.prioridade] ?? "neutral"}>{t.prioridade}</Badge>
          <span className="text-xs text-neutral-400">{TIPO_LABEL.get(t.tipo) ?? t.tipo}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-neutral-500">
          {t.data_prevista && <span>{formatDate(t.data_prevista)}</span>}
          {t.cliente && (
            <Link href={`/sistema/clientes/${t.cliente_id}`} className="hover:text-brand hover:underline">
              {t.cliente}
            </Link>
          )}
          {podeAtribuir && t.responsavel && <span>· {t.responsavel}</span>}
        </div>
        {t.descricao && <p className="mt-1 text-xs text-neutral-500">{t.descricao}</p>}
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => editar(t)}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          aria-label="Editar"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={() => remover(t)}
          className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
          aria-label="Excluir"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );

  const secao = (titulo: string, itens: TarefaItem[], tone?: string) =>
    itens.length === 0 ? null : (
      <div
        key={titulo}
        className="mb-4 overflow-hidden rounded-xl border border-neutral-200 bg-white"
      >
        <div className="flex items-center justify-between border-b border-neutral-200 bg-neutral-50 px-4 py-2.5">
          <h3 className={`text-sm font-bold ${tone ?? "text-neutral-800"}`}>{titulo}</h3>
          <span className="text-xs text-neutral-400">{itens.length}</span>
        </div>
        <div>{itens.map(linha)}</div>
      </div>
    );

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={novo}>
          <Plus size={15} /> Nova tarefa
        </Button>
      </div>

      {tarefas.length === 0 && (
        <EmptyState title="Nenhuma tarefa" description="Crie a primeira tarefa comercial." />
      )}

      {secao("Atrasadas", grupos.atrasadas, "text-red-600")}
      {secao("Hoje", grupos.hoje, "text-brand")}
      {secao("Em aberto", grupos.proximas)}
      {secao("Concluídas / canceladas", grupos.feitas, "text-neutral-400")}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={form.id ? "Editar tarefa" : "Nova tarefa"}
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
          <Field label="Título" required>
            <Input value={form.titulo} onChange={(e) => set("titulo", e.target.value)} />
          </Field>
          <FormGrid>
            <Field label="Tipo">
              <Select value={form.tipo} onChange={(e) => set("tipo", e.target.value)}>
                {TAREFA_TIPO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prioridade">
              <Select value={form.prioridade} onChange={(e) => set("prioridade", e.target.value)}>
                {TAREFA_PRIORIDADE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Data prevista">
              <Input
                type="date"
                value={form.data_prevista}
                onChange={(e) => set("data_prevista", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select value={form.status} onChange={(e) => set("status", e.target.value)}>
                {TAREFA_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Cliente">
              <Select value={form.cliente_id} onChange={(e) => set("cliente_id", e.target.value)}>
                <option value="">—</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
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
          <Field label="Descrição">
            <Textarea
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
              rows={3}
            />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
