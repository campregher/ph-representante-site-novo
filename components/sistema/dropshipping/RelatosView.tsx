"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, MapPin, Clock, RotateCcw, User } from "lucide-react";
import type { DropRelatoProblema } from "@/lib/sistema/dropshipping";
import { resolverRelatoProblema, reabrirRelatoProblema } from "@/lib/sistema/actions/relatos-problema";
import { Button } from "@/components/sistema/ui/Button";
import { Textarea } from "@/components/sistema/ui/Field";
import { Badge } from "@/components/sistema/ui/Badge";
import { formatDateTime } from "@/lib/sistema/format";

function RelatoCard({ relato }: { relato: DropRelatoProblema }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [respondendo, setRespondendo] = useState(false);
  const [resposta, setResposta] = useState("");

  function resolver() {
    start(async () => {
      const res = await resolverRelatoProblema(relato.id, resposta);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Relato marcado como resolvido.");
      setRespondendo(false);
      router.refresh();
    });
  }

  function reabrir() {
    start(async () => {
      const res = await reabrirRelatoProblema(relato.id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Relato reaberto.");
      router.refresh();
    });
  }

  const aberto = relato.status === "aberto";

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {aberto ? (
              <AlertTriangle size={15} className="shrink-0 text-amber-500" />
            ) : (
              <CheckCircle2 size={15} className="shrink-0 text-green-600" />
            )}
            <p className="font-semibold text-neutral-900">{relato.titulo}</p>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <User size={12} /> {relato.sellerNome}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock size={12} /> {formatDateTime(relato.createdAt)}
            </span>
            {relato.pagina && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {relato.pagina}
              </span>
            )}
          </p>
        </div>
        <Badge tone={aberto ? "yellow" : "green"}>{aberto ? "Aberto" : "Resolvido"}</Badge>
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-neutral-700">{relato.descricao}</p>

      {relato.respostaAdmin && (
        <div className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-400">Resposta</p>
          {relato.respostaAdmin}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {aberto && !respondendo && (
          <Button variant="outline" size="sm" onClick={() => setRespondendo(true)}>
            <CheckCircle2 size={13} /> Marcar como resolvido
          </Button>
        )}
        {!aberto && (
          <Button variant="ghost" size="sm" onClick={reabrir} loading={pending}>
            <RotateCcw size={13} /> Reabrir
          </Button>
        )}
      </div>

      {respondendo && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={resposta}
            onChange={(e) => setResposta(e.target.value)}
            rows={2}
            placeholder="Resposta para o seller (opcional)"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={resolver} loading={pending}>
              Confirmar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRespondendo(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RelatosView({ relatos }: { relatos: DropRelatoProblema[] }) {
  if (relatos.length === 0) {
    return <p className="rounded-xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">Nenhum relato ainda.</p>;
  }
  return (
    <div className="space-y-3">
      {relatos.map((r) => (
        <RelatoCard key={r.id} relato={r} />
      ))}
    </div>
  );
}
