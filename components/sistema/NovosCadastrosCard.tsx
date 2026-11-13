"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { UserPlus, Check, X, PartyPopper } from "lucide-react";
import type { NovoCadastroRow } from "@/lib/sistema/queries";
import { aprovarCliente, recusarCliente } from "@/lib/sistema/actions/clientes";
import { formatCNPJ, formatCPF } from "@/utils/cnpj";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";

function tempoRel(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h atrás`;
  const d = Math.floor(h / 24);
  return `${d} d atrás`;
}

function formatarDocumento(doc: string | null): string | null {
  if (!doc) return null;
  return doc.length > 11 ? formatCNPJ(doc) : formatCPF(doc);
}

export default function NovosCadastrosCard({ itens, total }: { itens: NovoCadastroRow[]; total: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function aprovar(id: string, nome: string) {
    start(async () => {
      const res = await aprovarCliente(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${nome} aprovado.`);
      router.refresh();
    });
  }

  function recusar(id: string, nome: string) {
    start(async () => {
      const res = await recusarCliente(id);
      if (!res.ok) { toast.error(res.error); return; }
      toast.success(`${nome} recusado.`);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader
        title="Novos cadastros"
        description="Aguardando sua aprovação"
        action={
          total > 0 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-white">
              <UserPlus size={12} /> {total}
            </span>
          ) : undefined
        }
      />
      <CardBody className="p-0">
        {itens.length === 0 ? (
          <p className="flex items-center justify-center gap-2 px-5 py-6 text-center text-sm text-neutral-400">
            <PartyPopper size={16} /> Nenhum cadastro pendente.
          </p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {itens.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <Link href={`/sistema/clientes/${c.id}`} className="min-w-0 flex-1 hover:text-brand">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-neutral-800">{c.nome}</span>
                    {c.isSeller && (
                      <span className="shrink-0 rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                        Seller
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-neutral-400">
                    {formatarDocumento(c.documento) ?? c.email ?? "—"} · {tempoRel(c.createdAt)}
                  </p>
                </Link>
                <div className="flex shrink-0 gap-1">
                  <button
                    onClick={() => aprovar(c.id, c.nome)}
                    disabled={pending}
                    title="Aprovar"
                    className="rounded-md p-1.5 text-green-600 hover:bg-green-50 disabled:opacity-50"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => recusar(c.id, c.nome)}
                    disabled={pending}
                    title="Recusar"
                    className="rounded-md p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  >
                    <X size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {total > itens.length && (
          <Link
            href="/sistema/clientes?status=prospect"
            className="block border-t border-neutral-100 px-5 py-2.5 text-center text-xs font-medium text-brand hover:underline"
          >
            Ver todos os {total} pendentes
          </Link>
        )}
      </CardBody>
    </Card>
  );
}
