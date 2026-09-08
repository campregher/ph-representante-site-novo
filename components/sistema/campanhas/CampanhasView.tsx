"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Send, Pencil, Trash2, X, Users, MailCheck, MailX } from "lucide-react";
import {
  FAIXA_OPCOES,
  type CampanhaModelo,
  type CampanhaResumo,
} from "@/lib/sistema/campanhas-types";
import {
  salvarModelo,
  excluirModelo,
  previsualizarCampanha,
  enviarCampanha,
} from "@/lib/sistema/actions/campanhas";
import { Card, CardHeader, CardBody, StatCard } from "@/components/sistema/ui/Card";
import { Modal, ConfirmDialog } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Textarea, Select } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";
import { formatDateTime } from "@/lib/sistema/format";

interface Opt {
  id: string;
  label: string;
}
interface Preview {
  total: number;
  enviaveis: number;
  pulados: number;
  amostra: { nome: string; email: string; dias: number | null }[];
}

export default function CampanhasView({
  modelos,
  campanhas,
  representadas,
}: {
  modelos: CampanhaModelo[];
  campanhas: CampanhaResumo[];
  representadas: Opt[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // ── nova campanha ──
  const [faixa, setFaixa] = useState("30");
  const [representada, setRepresentada] = useState("");
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");
  const [assunto, setAssunto] = useState(modelos[0]?.assunto ?? "");
  const [corpo, setCorpo] = useState(modelos[0]?.corpo ?? "");
  const [nome, setNome] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirmar, setConfirmar] = useState(false);

  function aplicarModelo(id: string) {
    setModeloId(id);
    const m = modelos.find((x) => x.id === id);
    if (m) {
      setAssunto(m.assunto);
      setCorpo(m.corpo);
    }
    setPreview(null);
  }

  function verDestinatarios() {
    start(async () => {
      const res = await previsualizarCampanha(faixa, representada);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview({
        total: res.total ?? 0,
        enviaveis: res.enviaveis ?? 0,
        pulados: res.pulados ?? 0,
        amostra: res.amostra ?? [],
      });
    });
  }

  function disparar() {
    setConfirmar(false);
    start(async () => {
      const res = await enviarCampanha({ nome, assunto, corpo, faixa, representadaId: representada });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        `Campanha enviada: ${res.enviado} enviado(s), ${res.pulado} pulado(s), ${res.erro} erro(s).`
      );
      setPreview(null);
      setNome("");
      router.refresh();
    });
  }

  // ── modelos ──
  const [modalModelo, setModalModelo] = useState(false);
  const [mEdit, setMEdit] = useState<CampanhaModelo | null>(null);
  const [mNome, setMNome] = useState("");
  const [mAssunto, setMAssunto] = useState("");
  const [mCorpo, setMCorpo] = useState("");
  const [delModelo, setDelModelo] = useState<CampanhaModelo | null>(null);

  function abrirModelo(m: CampanhaModelo | null) {
    setMEdit(m);
    setMNome(m?.nome ?? "");
    setMAssunto(m?.assunto ?? "");
    setMCorpo(m?.corpo ?? "");
    setModalModelo(true);
  }
  function salvarM() {
    start(async () => {
      const res = await salvarModelo(mEdit?.id ?? null, {
        nome: mNome,
        assunto: mAssunto,
        corpo: mCorpo,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Modelo salvo.");
      setModalModelo(false);
      router.refresh();
    });
  }
  function removerM() {
    const m = delModelo;
    setDelModelo(null);
    if (!m) return;
    start(async () => {
      const res = await excluirModelo(m.id);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Modelo excluído.");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* NOVA CAMPANHA */}
      <Card>
        <CardHeader
          title="Nova campanha de reativação"
          description="Envia e-mail para os seus clientes inativos. Variáveis: {{nome}}, {{vendedor}}, {{dias}}, {{empresa}}, {{link_catalogo}}."
        />
        <CardBody className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Clientes">
              <Select
                value={faixa}
                onChange={(e) => {
                  setFaixa(e.target.value);
                  setPreview(null);
                }}
              >
                {FAIXA_OPCOES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Representada (opcional)">
              <Select
                value={representada}
                onChange={(e) => {
                  setRepresentada(e.target.value);
                  setPreview(null);
                }}
              >
                <option value="">Todas</option>
                {representadas.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Modelo">
              <Select value={modeloId} onChange={(e) => aplicarModelo(e.target.value)}>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome interno da campanha">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Reativação março"
              />
            </Field>
          </div>

          <Field label="Assunto">
            <Input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
          </Field>
          <Field label="Mensagem">
            <Textarea value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={8} />
          </Field>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={verDestinatarios} loading={pending}>
              <Users size={15} /> Ver destinatários
            </Button>
            {preview && (
              <Button
                onClick={() => setConfirmar(true)}
                disabled={pending || preview.enviaveis === 0}
              >
                <Send size={15} /> Enviar para {preview.enviaveis}
              </Button>
            )}
          </div>

          {preview && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4">
              <div className="mb-3 grid grid-cols-3 gap-3">
                <StatCard label="Na faixa" value={String(preview.total)} icon={<Users size={15} />} />
                <StatCard
                  label="Vão receber"
                  value={String(preview.enviaveis)}
                  icon={<MailCheck size={15} />}
                />
                <StatCard
                  label="Pulados (30d)"
                  value={String(preview.pulados)}
                  icon={<MailX size={15} />}
                />
              </div>
              {preview.amostra.length > 0 && (
                <ul className="space-y-1 text-xs text-neutral-500">
                  {preview.amostra.map((a, i) => (
                    <li key={i}>
                      {a.nome} · {a.email} · {a.dias != null ? `${a.dias} dias` : "nunca comprou"}
                    </li>
                  ))}
                  {preview.enviaveis > preview.amostra.length && (
                    <li>+ {preview.enviaveis - preview.amostra.length} outros…</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* MODELOS */}
      <Card>
        <CardHeader
          title="Modelos"
          action={
            <button
              onClick={() => abrirModelo(null)}
              className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline"
            >
              <Plus size={14} /> Novo modelo
            </button>
          }
        />
        <CardBody className="p-0">
          <ul className="divide-y divide-neutral-100">
            {modelos.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-5 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-neutral-800">{m.nome}</div>
                  <div className="truncate text-xs text-neutral-400">{m.assunto}</div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => abrirModelo(m)}
                    className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                    aria-label="Editar"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDelModelo(m)}
                    className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </li>
            ))}
            {modelos.length === 0 && (
              <li className="px-5 py-6 text-center text-sm text-neutral-400">Nenhum modelo.</li>
            )}
          </ul>
        </CardBody>
      </Card>

      {/* HISTÓRICO */}
      <Card>
        <CardHeader title="Campanhas enviadas" />
        <CardBody className="p-0">
          {campanhas.length === 0 ? (
            <EmptyState title="Nenhuma campanha ainda" description="Crie a primeira acima." />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {campanhas.map((c) => (
                <li key={c.id} className="px-5 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800">{c.nome}</span>
                    <Badge tone="green">{c.total_enviado} enviados</Badge>
                    {c.total_pulado > 0 && <Badge>{c.total_pulado} pulados</Badge>}
                    {c.total_erro > 0 && <Badge tone="red">{c.total_erro} erros</Badge>}
                  </div>
                  <div className="mt-0.5 text-xs text-neutral-400">
                    {c.assunto} · {c.enviado_em ? formatDateTime(c.enviado_em) : "—"}
                    {c.criadoNome ? ` · ${c.criadoNome}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* modal modelo */}
      <Modal
        open={modalModelo}
        onClose={() => setModalModelo(false)}
        title={mEdit ? "Editar modelo" : "Novo modelo"}
        size="lg"
        footer={
          <>
            <button
              onClick={() => setModalModelo(false)}
              className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
            >
              <X size={14} /> Cancelar
            </button>
            <Button onClick={salvarM} loading={pending}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Nome" required>
            <Input value={mNome} onChange={(e) => setMNome(e.target.value)} />
          </Field>
          <Field label="Assunto" required>
            <Input value={mAssunto} onChange={(e) => setMAssunto(e.target.value)} />
          </Field>
          <Field
            label="Mensagem"
            required
            hint="Use {{nome}}, {{vendedor}}, {{dias}}, {{empresa}}, {{link_catalogo}}. Linha em branco = novo parágrafo."
          >
            <Textarea value={mCorpo} onChange={(e) => setMCorpo(e.target.value)} rows={10} />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        onConfirm={disparar}
        title="Enviar campanha?"
        message={
          preview
            ? `${preview.enviaveis} e-mail(s) serão enviados agora. Esta ação não pode ser desfeita.`
            : ""
        }
        confirmLabel="Enviar agora"
      />

      <ConfirmDialog
        open={!!delModelo}
        onClose={() => setDelModelo(null)}
        onConfirm={removerM}
        title="Excluir modelo?"
        message={delModelo ? `"${delModelo.nome}" será removido.` : ""}
        confirmLabel="Excluir"
        danger
      />
    </div>
  );
}
