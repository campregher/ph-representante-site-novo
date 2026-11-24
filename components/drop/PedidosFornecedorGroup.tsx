"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Send, Package } from "lucide-react";
import { buttonClass } from "@/components/sistema/ui/buttonClass";
import { Badge } from "@/components/sistema/ui/Badge";

export interface PedidoCombinavel {
  id: string;
  numero: number;
  resumo: string;
  totalCaixas: number;
  /** Status real do Mercado Livre já formatado pro seller (ver ML_SHIPPING_LABEL
   *  em page.tsx) — null quando ainda não há nada pra mostrar. Calculado no
   *  Server Component pra esse componente cliente não precisar da regra de
   *  rótulo/tom. */
  envioMl: { label: string; tone: "blue" | "green" | "red" | "neutral" } | null;
}

interface Props {
  fornecedorNome: string;
  pedidos: PedidoCombinavel[];
}

export default function PedidosFornecedorGroup({ fornecedorNome, pedidos }: Props) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(pedidos.map((p) => p.id)));
  const [baixando, setBaixando] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [baixado, setBaixado] = useState(false);

  const todosSelecionados = selecionados.size === pedidos.length;

  function toggle(id: string) {
    setErro(null);
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setErro(null);
    setSelecionados(todosSelecionados ? new Set() : new Set(pedidos.map((p) => p.id)));
  }

  async function baixar() {
    setErro(null);
    setBaixando(true);
    try {
      const res = await fetch("/api/drop/pedidos/combinado/baixar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoIds: [...selecionados] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setErro(body.error ?? "Falha ao gerar o pacote combinado.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fornecedorNome.toLowerCase().replace(/\s+/g, "-")}-pacote.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setBaixado(true);
    } catch {
      setErro("Falha ao gerar o pacote combinado.");
    } finally {
      setBaixando(false);
    }
  }

  async function marcarEnviado() {
    if (!confirm(`Marcar ${selecionados.size} pedido(s) como enviado(s) ao fornecedor ${fornecedorNome}?`)) return;
    setErro(null);
    setMarcando(true);
    try {
      const res = await fetch("/api/drop/pedidos/combinado/marcar-enviado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pedidoIds: [...selecionados] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErro(body.error ?? "Falha ao marcar como enviado.");
        return;
      }
      router.refresh();
    } catch {
      setErro("Falha ao marcar como enviado.");
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200">
      <div className="flex items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Package size={15} className="text-neutral-400" />
          <p className="text-sm font-semibold text-neutral-900">{fornecedorNome}</p>
          <span className="text-xs text-neutral-400">
            {selecionados.size}/{pedidos.length} selecionado(s)
          </span>
        </div>
        <button type="button" onClick={toggleTodos} className="text-xs font-medium text-brand hover:underline">
          {todosSelecionados ? "Limpar seleção" : "Selecionar todos"}
        </button>
      </div>

      <div className="divide-y divide-neutral-100">
        {pedidos.map((p) => (
          <label key={p.id} className="flex cursor-pointer items-start gap-3 px-4 py-2.5 hover:bg-neutral-50">
            <input
              type="checkbox"
              checked={selecionados.has(p.id)}
              onChange={() => toggle(p.id)}
              className="mt-0.5 h-4 w-4 rounded border-neutral-300 text-brand focus:ring-brand/40"
            />
            <div className="min-w-0 text-sm">
              <p className="truncate font-medium text-neutral-900">
                #{p.numero} — {p.resumo}
              </p>
              <p className="text-xs text-neutral-400">{p.totalCaixas} caixa(s) a enviar</p>
              {p.envioMl && (
                <div className="mt-1">
                  <Badge tone={p.envioMl.tone}>{p.envioMl.label}</Badge>
                </div>
              )}
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 px-4 py-3">
        <button
          type="button"
          onClick={baixar}
          disabled={selecionados.size === 0 || baixando}
          className={buttonClass({ variant: "outline", size: "sm" })}
        >
          <Download size={13} /> ① {baixando ? "Gerando pacote…" : `Baixar pacote combinado (${selecionados.size})`}
        </button>
        <button
          type="button"
          onClick={marcarEnviado}
          disabled={selecionados.size === 0 || marcando}
          className={buttonClass({ variant: "primary", size: "sm" })}
        >
          <Send size={13} /> ② {marcando ? "Marcando…" : "Marcar como enviado ao fornecedor"}
        </button>
        {!baixado && (
          <p className="w-full text-xs text-neutral-400">Já baixou o pacote e mandou para o fornecedor? Marque como enviado.</p>
        )}
        {erro && <p className="w-full text-xs text-red-600">{erro}</p>}
      </div>
    </div>
  );
}
