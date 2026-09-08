"use client";

import { useState, useTransition } from "react";
import { definirAceitaEmail } from "@/lib/sistema/actions/descadastro";

export default function DescadastroForm({
  token,
  nome,
  aceitaInicial,
}: {
  token: string;
  nome: string;
  aceitaInicial: boolean;
}) {
  const [aceita, setAceita] = useState(aceitaInicial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function alternar(valor: boolean) {
    start(async () => {
      const res = await definirAceitaEmail(token, valor);
      if (!res.ok) {
        setMsg(res.error ?? "Não foi possível atualizar.");
        return;
      }
      setAceita(valor);
      setMsg(
        valor
          ? "Pronto! Você voltou a receber nossos e-mails."
          : "Pronto! Você não receberá mais e-mails de campanha."
      );
    });
  }

  return (
    <div>
      <h1 className="text-lg font-bold text-neutral-900">Preferências de e-mail</h1>
      {nome && <p className="mt-1 text-sm text-neutral-500">{nome}</p>}

      <p className="mt-4 text-sm text-neutral-600">
        {aceita
          ? "Você está recebendo e-mails da PH Representante."
          : "Você optou por não receber e-mails de campanha da PH Representante."}
      </p>

      <button
        onClick={() => alternar(!aceita)}
        disabled={pending}
        className={`mt-5 inline-flex h-10 items-center justify-center rounded-lg px-5 text-sm font-semibold disabled:opacity-50 ${
          aceita
            ? "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
            : "bg-brand text-white hover:bg-brand/90"
        }`}
      >
        {pending ? "Salvando…" : aceita ? "Descadastrar" : "Voltar a receber"}
      </button>

      {msg && <p className="mt-4 text-sm font-medium text-green-700">{msg}</p>}
    </div>
  );
}
