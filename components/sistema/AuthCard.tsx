import Image from "next/image";
import type { ReactNode } from "react";

export default function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div
      data-sistema
      className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 text-neutral-900"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        <div className="flex items-center justify-center bg-dark-700 px-6 py-5">
          <Image
            src="/images/ph.png"
            alt="PH Representante"
            width={140}
            height={34}
            className="h-8 w-auto object-contain"
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
  );
}

export const authInputClass =
  "w-full rounded-lg border border-neutral-300 bg-white py-2.5 pl-9 pr-3 text-sm text-neutral-900 placeholder-neutral-400 focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/15";
