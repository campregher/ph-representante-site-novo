"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check, RotateCcw, Ban } from "lucide-react";
import type { ContaRow } from "@/lib/sistema/cobranca";
import { FORMA_RECEBIMENTO_OPTIONS } from "@/lib/sistema/types";
import { marcarContaPaga, reabrirConta, cancelarConta, criarContaAvulsa } from "@/lib/sistema/actions/cobranca";
import { formatBRL, formatDate } from "@/lib/sistema/format";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { EmptyState } from "@/components/sistema/ui/State";
import { TableScroll, Table, Thead, Tbody, Tr, Th, Td } from "@/components/sistema/ui/Table";

const TONE: Record<string, "green" | "red" | "yellow" | "neutral"> = {
  aberto: "yellow", vencido: "red", pago: "green", cancelado: "neutral",
};
const LABEL: Record<string, string> = {
  aberto: "Em aberto", vencido: "Vencido", pago: "Pago", cancelado: "Cancelado",
};

export default function CobrancaView({
  contas,
  clientes,
}: {
  contas: ContaRow[];
  clientes: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [pagar, setPagar] = useState<ContaRow | null>(null);
  const [valorPago, setValorPago] = useState("");
  const [forma, setForma] = useState("pix");
  const [pagoEm, setPagoEm] = useState(new Date().toISOString().slice(0, 10));

  const [nova, setNova] = useState(false);
  const [nf, setNf] = useState({ cliente_id: "", descricao: "", valor: "", vencimento: "", forma: "" });
  const setNfK = (k: keyof typeof nf, v: string) => setNf((s) => ({ ...s, [k]: v }));

  function confirmarPago() {
    const c = pagar;
    if (!c) return;
    start(async () => {
      const res = await marcarContaPaga({ id: c.id, valor_pago: valorPago || String(c.valor), pago_em: pagoEm, forma });
      setPagar(null);
      if (!res.ok) toast.error(res.error);
      else { toast.success("Baixa registrada."); router.refresh(); }
    });
  }
  function acao(fn: () => Promise<{ ok: boolean; error?: string }>, msg: string) {
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error(res.error);
      else { toast.success(msg); router.refresh(); }
    });
  }
  function salvarNova() {
    if (nf.descricao.trim().length < 2 || !(Number(nf.valor.replace(",", ".")) > 0))
      return toast.error("Preencha descrição e valor.");
    start(async () => {
      const res = await criarContaAvulsa(nf);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Conta criada.");
      setNova(false);
      setNf({ cliente_id: "", descricao: "", valor: "", vencimento: "", forma: "" });
      router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setNova(true)}><Plus size={15} /> Nova cobrança</Button>
      </div>

      {contas.length === 0 ? (
        <EmptyState title="Nada a cobrar" description="Contas a receber aparecem ao faturar pedidos drop." />
      ) : (
        <TableScroll>
          <Table>
            <Thead>
              <Tr>
                <Th>Descrição</Th>
                <Th>Cliente</Th>
                <Th>Vencimento</Th>
                <Th className="text-right">Valor</Th>
                <Th>Status</Th>
                <Th className="text-right">Ações</Th>
              </Tr>
            </Thead>
            <Tbody>
              {contas.map((c) => (
                <Tr key={c.id}>
                  <Td>
                    {c.descricao}
                    {c.pedido_numero ? <span className="ml-1 text-xs text-neutral-400">#{c.pedido_numero}</span> : null}
                  </Td>
                  <Td>{c.cliente ?? "—"}</Td>
                  <Td>{c.vencimento ? formatDate(c.vencimento) : "—"}</Td>
                  <Td className="text-right font-medium">{formatBRL(c.valor)}</Td>
                  <Td>
                    <Badge tone={TONE[c.status] ?? "neutral"}>{LABEL[c.status] ?? c.status}</Badge>
                    {c.pago_em && <div className="text-xs text-neutral-400">{formatDate(c.pago_em)}</div>}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-1">
                      {c.status !== "pago" && c.status !== "cancelado" && (
                        <button onClick={() => { setPagar(c); setValorPago(String(c.valor)); }} disabled={pending}
                          className="inline-flex items-center gap-1 rounded-md border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50">
                          <Check size={13} /> Baixar
                        </button>
                      )}
                      {c.status === "pago" && (
                        <button onClick={() => acao(() => reabrirConta(c.id), "Reaberta.")} disabled={pending}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-neutral-50">
                          <RotateCcw size={13} /> Reabrir
                        </button>
                      )}
                      {c.status !== "cancelado" && (
                        <button onClick={() => acao(() => cancelarConta(c.id), "Cancelada.")} disabled={pending}
                          className="inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 hover:bg-red-50 hover:text-red-600">
                          <Ban size={13} />
                        </button>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableScroll>
      )}

      <Modal
        open={!!pagar}
        onClose={() => setPagar(null)}
        title={`Baixar — ${pagar?.descricao ?? ""}`}
        footer={<Button onClick={confirmarPago} loading={pending}>Confirmar recebimento</Button>}
      >
        <div className="space-y-4">
          <FormGrid>
            <Field label="Valor recebido"><Input value={valorPago} onChange={(e) => setValorPago(e.target.value)} inputMode="decimal" /></Field>
            <Field label="Data"><Input type="date" value={pagoEm} onChange={(e) => setPagoEm(e.target.value)} /></Field>
            <Field label="Forma">
              <Select value={forma} onChange={(e) => setForma(e.target.value)}>
                {FORMA_RECEBIMENTO_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </Field>
          </FormGrid>
        </div>
      </Modal>

      <Modal
        open={nova}
        onClose={() => setNova(false)}
        title="Nova cobrança"
        footer={<Button onClick={salvarNova} loading={pending}>Criar</Button>}
      >
        <div className="space-y-4">
          <Field label="Descrição" required><Input value={nf.descricao} onChange={(e) => setNfK("descricao", e.target.value)} /></Field>
          <FormGrid>
            <Field label="Cliente">
              <Select value={nf.cliente_id} onChange={(e) => setNfK("cliente_id", e.target.value)}>
                <option value="">—</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field label="Valor (R$)" required><Input value={nf.valor} onChange={(e) => setNfK("valor", e.target.value)} inputMode="decimal" /></Field>
            <Field label="Vencimento"><Input type="date" value={nf.vencimento} onChange={(e) => setNfK("vencimento", e.target.value)} /></Field>
            <Field label="Forma">
              <Select value={nf.forma} onChange={(e) => setNfK("forma", e.target.value)}>
                <option value="">—</option>
                {FORMA_RECEBIMENTO_OPTIONS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </Field>
          </FormGrid>
        </div>
      </Modal>
    </div>
  );
}
