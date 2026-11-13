"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, Megaphone, Package, MessageCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { salvarOnboardingSeller } from "@/lib/sistema/actions/seller-onboarding";
import {
  SELLER_INTERESSE_OPTIONS,
  SELLER_CANAL_OPTIONS,
  SELLER_VOLUME_OPTIONS,
} from "@/lib/sistema/schemas";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Select } from "@/components/sistema/ui/Field";
import { WHATSAPP_URL } from "@/lib/constants";

export default function OnboardingFlow({
  portalToken,
}: {
  portalToken: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [etapa, setEtapa] = useState<"questionario" | "tutorial">("questionario");
  const [interesses, setInteresses] = useState<string[]>([]);
  const [canal, setCanal] = useState("");
  const [volumeMensal, setVolumeMensal] = useState("");

  function toggleInteresse(item: string) {
    setInteresses((s) => (s.includes(item) ? s.filter((i) => i !== item) : [...s, item]));
  }

  function avancar() {
    if (interesses.length === 0) return toast.error("Selecione pelo menos uma categoria.");
    if (!canal) return toast.error("Selecione em quais marketplaces você vende.");
    if (!volumeMensal) return toast.error("Selecione o volume pretendido.");
    setEtapa("tutorial");
  }

  function concluir() {
    start(async () => {
      const res = await salvarOnboardingSeller(portalToken, { interesses, canal, volumeMensal });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Tudo pronto! Bem-vindo ao portal.");
      router.push("/drop/dashboard");
      router.refresh();
    });
  }

  if (etapa === "tutorial") {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-neutral-900">Como funciona o portal</h1>
          <p className="mt-1 text-sm text-neutral-500">Um resumo rápido antes de começar a vender.</p>
        </div>

        <div className="space-y-3">
          <div className="flex gap-3 rounded-lg border border-neutral-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Truck size={18} /></div>
            <div>
              <p className="font-semibold text-neutral-900">Fornecedores e produtos</p>
              <p className="text-sm text-neutral-500">Em &ldquo;Produtos&rdquo;, escolha um fornecedor e veja os produtos disponíveis com o preço de revenda.</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-neutral-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Megaphone size={18} /></div>
            <div>
              <p className="font-semibold text-neutral-900">Anuncie em massa</p>
              <p className="text-sm text-neutral-500">Selecione vários produtos de um fornecedor e publique todos de uma vez no Mercado Livre.</p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-neutral-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><Package size={18} /></div>
            <div>
              <p className="font-semibold text-neutral-900">Quando você vender</p>
              <p className="text-sm text-neutral-500">
                Um pedido é criado automaticamente e você combina o pagamento direto com o fornecedor, nas condições negociadas.
              </p>
            </div>
          </div>

          <div className="flex gap-3 rounded-lg border border-neutral-200 p-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><MessageCircle size={18} /></div>
            <div>
              <p className="font-semibold text-neutral-900">Precisa de ajuda?</p>
              <p className="text-sm text-neutral-500">
                Fale com a gente pelo{" "}
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="text-brand hover:underline">WhatsApp</a>.
              </p>
            </div>
          </div>
        </div>

        <Button onClick={concluir} loading={pending} className="w-full">
          <CheckCircle2 size={16} /> Entendi, vamos começar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-neutral-900">Bem-vindo! Só mais uma etapa</h1>
        <p className="mt-1 text-sm text-neutral-500">Responda rapidinho pra gente te mostrar os produtos certos.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-700">Quais categorias você tem mais interesse?</p>
        <div className="flex flex-wrap gap-2">
          {SELLER_INTERESSE_OPTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => toggleInteresse(item)}
              className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                interesses.includes(item)
                  ? "border-brand bg-brand text-white"
                  : "border-neutral-300 text-neutral-700 hover:border-brand/50"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <Field label="Em quais marketplaces você vende?">
        <Select value={canal} onChange={(e) => setCanal(e.target.value)}>
          <option value="">Selecione...</option>
          {SELLER_CANAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>

      <Field label="Quanto pretende vender por mês?">
        <Select value={volumeMensal} onChange={(e) => setVolumeMensal(e.target.value)}>
          <option value="">Selecione...</option>
          {SELLER_VOLUME_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Field>

      <Button onClick={avancar} className="w-full">
        Continuar <ArrowRight size={16} />
      </Button>
    </div>
  );
}
