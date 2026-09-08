import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Impressão | Sistema Comercial",
  robots: { index: false, follow: false },
};

/**
 * Sobrescreve o @media print global (que fixa #print-doc em uma página só)
 * para permitir conteúdo que flui por várias páginas.
 */
const printCss = `
@media print {
  body * { visibility: visible !important; }
  #print-doc {
    position: static !important;
    inset: auto !important;
    overflow: visible !important;
  }
  #print-doc table { width: 100%; border-collapse: collapse; }
  #print-doc thead { display: table-header-group; }
  #print-doc tr, #print-doc td, #print-doc th { break-inside: avoid; }
  .no-print, .no-print * { display: none !important; }
}
`;

export default function ImprimirLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sistema className="min-h-screen bg-white text-neutral-900">
      <style dangerouslySetInnerHTML={{ __html: printCss }} />
      {children}
    </div>
  );
}
