import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

const vitrine = [
  { label: "Calotas", img: "/images/products/tiger/1.jpg" },
  { label: "Tapetes", img: "/images/products/attis/1.jpeg" },
  { label: "Engates", img: "/images/products/mega/1.jpeg" },
];

function PainelVisual() {
  return (
    <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-dark-950 p-10 text-white lg:flex">
      <div className="absolute inset-0 bg-grid opacity-20" />
      <div className="absolute top-0 right-0 h-80 w-80 rounded-full bg-brand/20 blur-3xl" />

      <Link href="/" className="relative z-10">
        <Image
          src="/images/ph.png"
          alt="PH Representante"
          width={150}
          height={36}
          className="h-9 w-auto object-contain"
          priority
        />
      </Link>

      <div className="relative z-10">
        <div className="mb-6 grid grid-cols-2 gap-3">
          {vitrine.map((v) => (
            <div key={v.label} className="relative aspect-square overflow-hidden rounded-xl border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.img}
                alt={v.label}
                className="absolute inset-0 h-full w-full scale-125 object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent pb-1.5 pt-8">
                <p className="px-2.5 text-[11px] font-semibold text-white">{v.label}</p>
              </div>
            </div>
          ))}
          <div className="flex aspect-square flex-col items-center justify-center gap-0.5 rounded-xl bg-brand text-center">
            <span className="text-2xl font-black">+8</span>
            <span className="px-2 text-[11px] font-semibold text-red-100">marcas representadas</span>
          </div>
        </div>
        <h2 className="text-xl font-bold leading-snug">
          Acessórios automotivos para atacado e dropshipping
        </h2>
        <p className="mt-2 text-sm text-gray-400">
          Catálogo de +1.000 produtos, condições diferenciadas e suporte comercial dedicado.
        </p>
      </div>

      <div className="relative z-10 flex gap-6 text-sm text-gray-400">
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
  );
}

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
  maxWidthClassName = "max-w-sm",
  visual = false,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** largura do card — telas com formulário maior (ex.: cadastro de seller) usam mais que max-w-sm */
  maxWidthClassName?: string;
  /** painel com fotos reais de produto + marca ao lado do formulário (telas de entrada: login e cadastro) */
  visual?: boolean;
}) {
  if (visual) {
    return (
      <div data-sistema className="flex min-h-screen bg-neutral-100 text-neutral-900">
        <PainelVisual />
        <div className="flex flex-1 flex-col items-center justify-center p-4 sm:p-10">
          <div className={`w-full ${maxWidthClassName}`}>
            <Link
              href="/"
              className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-brand lg:hidden"
            >
              <ArrowLeft size={15} /> Voltar para o site
            </Link>
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
              <h1 className="text-xl font-bold text-neutral-900">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
              <div className="mt-6">{children}</div>
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
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
          <div className="flex items-center justify-center bg-dark-700 px-6 py-5">
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
  "w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/15";
