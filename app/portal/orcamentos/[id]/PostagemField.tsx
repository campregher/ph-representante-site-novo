"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Clock, Check, Loader2, AlertTriangle, AlertCircle } from "lucide-react";

interface Props {
  orcamentoId: string;
  initialValue: string | null;
}

function getStatus(value: string | null): "none" | "ok" | "soon" | "overdue" {
  if (!value) return "none";
  const diff = new Date(value).getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff < 48 * 60 * 60 * 1000) return "soon";
  return "ok";
}

function formatBR(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const alertConfig = {
  overdue: {
    banner: "bg-red-500/15 border-red-500/30 text-red-400",
    icon: <AlertCircle size={14} className="flex-shrink-0" />,
    label: "Prazo encerrado! Poste as etiquetas imediatamente.",
  },
  soon: {
    banner: "bg-yellow-400/15 border-yellow-400/30 text-yellow-400",
    icon: <AlertTriangle size={14} className="flex-shrink-0" />,
    label: "Prazo se encerrando em breve. Confirme a postagem.",
  },
  ok: {
    banner: "bg-green-400/10 border-green-400/20 text-green-400",
    icon: <Check size={14} className="flex-shrink-0" />,
    label: "Dentro do prazo.",
  },
  none: null,
};

export default function PostagemField({ orcamentoId, initialValue }: Props) {
  const [value,  setValue]  = useState(initialValue ?? "");
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  const status = getStatus(value || null);
  const alert  = alertConfig[status];

  async function save() {
    if (!value) return;
    setSaving(true); setSaved(false);
    try {
      const res = await fetch(`/api/portal/orcamentos/${orcamentoId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "postagem", horario_postagem: value }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? "Erro ao salvar prazo"); return; }
      toast.success("Horário limite de postagem salvo!");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-dark-800 border border-white/8 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-white/8 flex items-center gap-2">
        <Clock size={14} className="text-gray-500" />
        <p className="text-sm font-bold text-white">Horário Limite de Postagem</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {alert && value && (
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-semibold ${alert.banner}`}>
            {alert.icon}
            <span>{alert.label}</span>
            <span className="ml-auto font-normal opacity-80">{formatBR(value)}</span>
          </div>
        )}

        {!value && (
          <p className="text-xs text-gray-500">
            Defina o prazo limite para postagem das etiquetas. Um alerta será exibido quando o prazo estiver próximo ou encerrado.
          </p>
        )}

        <div className="flex items-center gap-2">
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => { setValue(e.target.value); setSaved(false); }}
            className="flex-1 px-3 py-2 bg-dark-900 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-brand/40 transition-all [color-scheme:dark]"
          />
          <button
            onClick={save}
            disabled={saving || !value}
            className="flex items-center gap-1.5 px-4 py-2 bg-dark-700 border border-white/10 hover:border-white/20 text-gray-300 hover:text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} className="text-green-400" /> : <Clock size={13} />}
            {saved ? "Salvo!" : "Definir prazo"}
          </button>
        </div>
      </div>
    </div>
  );
}
