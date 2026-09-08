"use client";

import { useState } from "react";
import { Link2, Check, MessageCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";

function buildUrl(token: string) {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_SITE_URL ?? "";
  return `${origin}/p/${token}`;
}

function waHref(numero: number, url: string, phone?: string | null) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const to = digits.length >= 10 ? (digits.length <= 11 ? `55${digits}` : digits) : "";
  const text = encodeURIComponent(`Segue o pedido #${numero}:\n${url}`);
  return `https://wa.me/${to}?text=${text}`;
}

export default function EnviarLinkPedido({
  token,
  numero,
  whatsapp,
  variant = "full",
}: {
  token: string;
  numero: number;
  whatsapp?: string | null;
  variant?: "icon" | "full";
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    const url = buildUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      toast.success("Link do pedido copiado.");
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  if (variant === "icon") {
    return (
      <button
        onClick={copiar}
        title="Copiar link do pedido"
        className="rounded-md p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
      >
        {copiado ? <Check size={15} className="text-green-600" /> : <Link2 size={15} />}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={copiar}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        {copiado ? <Check size={13} className="text-green-600" /> : <Link2 size={13} />} Copiar link
      </button>
      <a
        href={waHref(numero, buildUrl(token), whatsapp)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <MessageCircle size={13} className="text-[#25d366]" /> WhatsApp
      </a>
      <a
        href={buildUrl(token)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
      >
        <ExternalLink size={13} /> Abrir
      </a>
    </div>
  );
}
