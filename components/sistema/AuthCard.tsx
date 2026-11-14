import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import ProductWall from "@/components/ProductWall";

const MEI_URL = "https://www.gov.br/empresas-e-negocios/pt-br/empreendedor";

function PainelVisual({ semCnpjCta }: { semCnpjCta?: boolean }) {
  return (
    <div className="relative hidden w-[42%] shrink-0 overflow-hidden lg:block">
      {/* fundo — fotos reais do catálogo em tela cheia, sempre preenchendo a altura real */}
      <ProductWall overlay="none" cols={2} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/88 via-black/80 to-black/90" />
      <div className="absolute top-0 left-0 right-0 h-[3px] bg-brand" />

      <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
        <Link href="/">
          <Image
            src="/images/ph.png"
            alt="PH Representante"
            width={150}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        </Link>

        <div>
          <h2 className="text-2xl font-bold leading-snug">
            Acessórios automotivos para <span className="text-brand">atacado</span> e <span className="text-brand">dropshipping</span>
          </h2>
          <p className="mt-2 text-sm text-gray-300 max-w-xs">
            Catálogo de +1.000 produtos, condições diferenciadas e suporte comercial dedicado.
          </p>

          {semCnpjCta && (
            <div className="mt-5 max-w-xs rounded-md border border-white/15 bg-white/5 p-4">
              <p className="text-sm text-gray-300">Ainda não tem CNPJ?</p>
              <a
                href={MEI_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"
              >
                Abra seu MEI grátis no gov.br <ArrowRight size={14} />
              </a>
            </div>
          )}
        </div>

        <div className="flex gap-6 text-sm text-gray-300 border-t border-white/15 pt-5">
          <span>
            <strong className="text-white">+1.000</strong> produtos
          </span>
          <span>
            <strong className="text-white">+500</strong> sellers
          </span>
          <span>
            <strong className="text-white">Todo</strong> Brasil
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
  maxWidthClassName = "max-w-sm",
  visual = false,
  semCnpjCta = false,
}: {
  title?: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** largura do card — telas com formulário maior (ex.: cadastro de seller) usam mais que max-w-sm */
  maxWidthClassName?: string;
  /** painel com fotos reais de produto + marca ao lado do formulário (telas de entrada: login e cadastro) */
  visual?: boolean;
  /** mostra no painel visual a chamada pra quem não tem CNPJ abrir um MEI (só faz sentido no cadastro de seller) */
  semCnpjCta?: boolean;
}) {
  if (visual) {
    return (
      <div data-sistema className="flex min-h-screen bg-neutral-100 text-neutral-900">
        <PainelVisual semCnpjCta={semCnpjCta} />
        <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-10">
          <div className={`w-full ${maxWidthClassName}`}>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand"
            >
              <ArrowLeft size={15} /> Voltar para o site
            </Link>
            <div className="rounded-md border border-gray-900 bg-white p-6 sm:p-8">
              {title && <h1 className="text-xl font-bold text-neutral-900">{title}</h1>}
              {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
              <div className={title ? "mt-6" : ""}>{children}</div>
              {footer && <div className="mt-5 text-center text-sm text-neutral-500">{footer}</div>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      data-sistema
      className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 text-neutral-900"
    >
      <div className={`w-full ${maxWidthClassName}`}>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand"
        >
          <ArrowLeft size={15} /> Voltar para o site
        </Link>
        <div className="overflow-hidden rounded-md border border-gray-900 bg-white">
          <div className="h-[3px] bg-brand" />
          <div className="flex items-center justify-center bg-dark-950 px-6 py-5">
            <Image
              src="/images/ph.png"
              alt="PH Representante"
              width={140}
              height={34}
              className="h-8 w-auto object-contain"
              style={{ width: "auto" }}
              priority
            />
          </div>
          <div className="p-6">
            <h1 className="text-base font-bold text-neutral-900">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
            <div className="mt-5">{children}</div>
            {footer && <div className="mt-5 text-center text-sm text-neutral-500">{footer}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export const authInputClass =
  "w-full rounded-md border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/15";
