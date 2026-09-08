"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X, Copy } from "lucide-react";
import { ROLE_OPTIONS } from "@/lib/sistema/roles";
import { criarUsuario, atualizarUsuario } from "@/lib/sistema/actions/usuarios";
import { Modal } from "@/components/sistema/ui/Modal";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Input, Select, FormGrid } from "@/components/sistema/ui/Field";

interface Usuario {
  id: string;
  nome: string;
  email: string;
  role: string;
  ativo: boolean;
}

export default function UsuariosManager({
  usuarios,
  selfId,
}: {
  usuarios: Usuario[];
  selfId: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", nome: "", role: "vendedor" });
  const [senha, setSenha] = useState<string | null>(null);

  function patch(id: string, p: { role?: string; ativo?: boolean }) {
    start(async () => {
      const res = await atualizarUsuario(id, p);
      if (!res.ok) toast.error(res.error);
      else {
        toast.success("Usuário atualizado.");
        router.refresh();
      }
    });
  }

  function convidar() {
    start(async () => {
      const res = await criarUsuario(form);
      if (!res.ok) toast.error(res.error);
      else {
        setSenha(res.senha ?? null);
        setForm({ email: "", nome: "", role: "vendedor" });
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button
          onClick={() => {
            setSenha(null);
            setOpen(true);
          }}
        >
          <Plus size={15} /> Convidar usuário
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase text-neutral-500">
            <tr>
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Papel</th>
              <th className="px-3 py-2 text-center">Ativo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {usuarios.map((u) => (
              <tr key={u.id}>
                <td className="px-3 py-2 font-medium text-neutral-800">
                  {u.nome}
                  {u.id === selfId && <span className="ml-1 text-xs text-neutral-400">(você)</span>}
                </td>
                <td className="px-3 py-2 text-neutral-500">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    disabled={pending || (u.id === selfId)}
                    onChange={(e) => patch(u.id, { role: e.target.value })}
                    className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs disabled:opacity-60"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-center">
                  <button
                    disabled={pending || u.id === selfId}
                    onClick={() => patch(u.id, { ativo: !u.ativo })}
                    className={`inline-flex h-5 w-9 items-center rounded-full p-0.5 transition ${
                      u.ativo ? "bg-green-500" : "bg-neutral-300"
                    } disabled:opacity-50`}
                    aria-label={u.ativo ? "Desativar" : "Ativar"}
                  >
                    <span
                      className={`h-4 w-4 rounded-full bg-white transition ${
                        u.ativo ? "translate-x-4" : ""
                      }`}
                    />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Convidar usuário"
        footer={
          senha ? (
            <Button onClick={() => setOpen(false)}>Concluir</Button>
          ) : (
            <>
              <button
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-neutral-500 hover:bg-neutral-100"
              >
                <X size={14} /> Cancelar
              </button>
              <Button onClick={convidar} loading={pending}>
                Criar acesso
              </Button>
            </>
          )
        }
      >
        {senha ? (
          <div className="space-y-3 text-sm">
            <p className="text-neutral-700">
              Usuário criado. Envie estes dados — a pessoa deve trocar a senha no primeiro acesso
              (link “Esqueci minha senha” na tela de login).
            </p>
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
              <div className="font-mono text-sm text-neutral-800">Senha provisória: {senha}</div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(senha);
                  toast.success("Senha copiada.");
                }}
                className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"
              >
                <Copy size={12} /> Copiar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <FormGrid>
              <Field label="Nome" required>
                <Input
                  value={form.nome}
                  onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
                />
              </Field>
              <Field label="E-mail" required>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </Field>
              <Field label="Papel">
                <Select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </FormGrid>
          </div>
        )}
      </Modal>
    </div>
  );
}
