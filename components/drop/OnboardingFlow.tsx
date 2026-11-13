"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Truck, Megaphone, Package, MessageCircle, CheckCircle2, ArrowRight, Rocket } from "lucide-react";
import { salvarOnboardingSeller } from "@/lib/sistema/actions/seller-onboarding";
import {
  SELLER_TEMPO_VENDENDO_OPTIONS,
  SELLER_METODO_ENVIO_OPTIONS,
  SELLER_VENDAS_MES_OPTIONS,
} from "@/lib/sistema/schemas";
import { Button } from "@/components/sistema/ui/Button";
import { Field, Select } from "@/components/sistema/ui/Field";
import { WHATSAPP_URL } from "@/lib/constants";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "border-brand bg-brand text-white" : "border-neutral-300 text-neutral-700 hover:border-brand/50"
      }`}
    >
      {children}
    </button>
  );
}

const PASSOS_TUTORIAL = [
  {
    icon: Truck,
    tone: "bg-blue-50 text-blue-600",
    titulo: "Fornecedores e produtos",
    texto: "Em “Produtos”, escolha um fornecedor e veja os produtos disponíveis com o preço de revenda.",
  },
  {
    icon: Megaphone,
    tone: "bg-violet-50 text-violet-600",
    titulo: "Anuncie em massa",
    texto: "Selecione vários produtos de um fornecedor e publique todos de uma vez no Mercado Livre.",
  },
  {
    icon: Package,
    tone: "bg-green-50 text-green-600",
    titulo: "Quando você vender",
    texto: "Um pedido é criado automaticamente e você combina o pagamento direto com o fornecedor, nas condições negociadas.",
  },
] as const;

export default function OnboardingFlow({
  portalToken,
}: {
  portalToken: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [etapa, setEtapa] = useState<"questionario" | "tutorial">("questionario");
  const [jaVende, setJaVende] = useState<boolean | null>(null);
  const [tempoVendendo, setTempoVendendo] = useState("");
  const [metodosEnvio, setMetodosEnvio] = useState<string[]>([]);
  const [vendasMes, setVendasMes] = useState("");

  function toggleMetodoEnvio(valor: string) {
    setMetodosEnvio((s) => (s.includes(valor) ? s.filter((i) => i !== valor) : [...s, valor]));
  }

  function avancar() {
    if (jaVende === null) return toast.error("Diga se você já vende em algum marketplace.");
    if (jaVende) {
      if (!tempoVendendo) return toast.error("Selecione há quanto tempo você vende.");
      if (metodosEnvio.length === 0) return toast.error("Selecione pelo menos um método de envio.");
      if (!vendasMes) return toast.error("Selecione quantas vendas você faz por mês.");
    }
    setEtapa("tutorial");
  }

  function concluir() {
    start(async () => {
      const res = await salvarOnboardingSeller(portalToken, {
        jaVendeMarketplace: !!jaVende,
        tempoVendendo: jaVende ? tempoVendendo : undefined,
        metodosEnvio: jaVende ? metodosEnvio : undefined,
        vendasMes: jaVende ? vendasMes : undefined,
      });
      if (!res.ok) { toast.error(res.error); return; }
      toast.success("Tudo pronto! Bem-vindo ao portal.");
      router.push("/drop/dashboard");
      router.refresh();
    });
  }

  if (etapa === "tutorial") {
    return (
      <div className="space-y-5">
        <div className="overflow-hidden rounded-xl bg-gradient-to-br from-neutral-900 to-neutral-800 p-5 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
              <Rocket size={20} />
            </div>
            <div>
              <h1 className="text-lg font-bold">Como funciona o portal</h1>
              <p className="text-sm text-neutral-300">Um resumo rápido antes de começar a vender.</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {PASSOS_TUTORIAL.map((p) => (
            <div
              key={p.titulo}
              className="flex gap-3 rounded-xl border border-neutral-200 p-4 transition-shadow hover:shadow-sm"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${p.tone}`}>
                <p.icon size={18} />
              </div>
              <div>
                <p className="font-semibold text-neutral-900">{p.titulo}</p>
                <p className="text-sm text-neutral-500">{p.texto}</p>
              </div>
            </div>
          ))}

          <div className="flex gap-3 rounded-xl border border-neutral-200 p-4 transition-shadow hover:shadow-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <MessageCircle size={18} />
            </div>
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
        <p className="mt-1 text-sm text-neutral-500">Responda rapidinho pra gente te conhecer melhor.</p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-700">Você já vende em algum marketplace?</p>
        <div className="flex gap-2">
          <Chip active={jaVende === true} onClick={() => setJaVende(true)}>Sim</Chip>
          <Chip active={jaVende === false} onClick={() => setJaVende(false)}>Ainda não</Chip>
        </div>
      </div>

      {jaVende && (
        <>
          <Field label="Há quanto tempo você vende?">
            <Select value={tempoVendendo} onChange={(e) => setTempoVendendo(e.target.value)}>
              <option value="">Selecione...</option>
              {SELLER_TEMPO_VENDENDO_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-700">
              Quais métodos de envio você usa? <span className="font-normal text-neutral-400">(pode marcar mais de um)</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {SELLER_METODO_ENVIO_OPTIONS.map((o) => (
                <Chip key={o.value} active={metodosEnvio.includes(o.value)} onClick={() => toggleMetodoEnvio(o.value)}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="Quantas vendas você faz por mês, aproximadamente?">
            <Select value={vendasMes} onChange={(e) => setVendasMes(e.target.value)}>
              <option value="">Selecione...</option>
              {SELLER_VENDAS_MES_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
        </>
      )}

      <Button onClick={avancar} className="w-full">
        Continuar <ArrowRight size={16} />
      </Button>
    </div>
  );
}
