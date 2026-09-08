"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

/** <tr> clicável — navega para `href` ao clicar em qualquer parte da linha.
 *  Links/botões internos devem chamar e.stopPropagation() se levarem a outro lugar. */
export default function RowLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        // não intercepta cliques em links/botões dentro da linha
        if ((e.target as HTMLElement).closest("a,button,input,select")) return;
        router.push(href);
      }}
      className={`group cursor-pointer ${className}`}
    >
      {children}
    </tr>
  );
}
