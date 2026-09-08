import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Preferências de e-mail | PH Representante",
  robots: { index: false, follow: false },
};

export default function DescadastroLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sistema className="min-h-screen bg-neutral-100 text-neutral-900">
      {children}
    </div>
  );
}
