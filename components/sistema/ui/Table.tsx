import type { ReactNode } from "react";

export function TableScroll({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto overscroll-x-contain rounded-xl border border-neutral-200 bg-white [scrollbar-gutter:stable]">
      {children}
    </div>
  );
}

export function Table({
  children,
  fixed = false,
}: {
  children: ReactNode;
  fixed?: boolean;
  minWidth?: number;
}) {
  // fixed: w-full + table-fixed (cabe na tela, colunas por <colgroup>, texto trunca).
  // padrão: w-max (colunas do tamanho do conteúdo).
  // border-separate permite position: sticky nas células (coluna de ações fixa).
  return (
    <table
      className={`w-full min-w-full border-separate border-spacing-0 text-sm ${
        fixed ? "table-fixed" : ""
      }`}
    >
      {children}
    </table>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
      {children}
    </thead>
  );
}

export function Th({
  children,
  className = "",
}: {
  children?: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`whitespace-nowrap border-b-2 border-neutral-200 px-3 py-2.5 font-semibold ${className}`}
    >
      {children}
    </th>
  );
}

export function Tbody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function Tr({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <tr className={`group ${className}`}>{children}</tr>;
}

export function Td({
  children,
  className = "",
  title,
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  title?: string;
  colSpan?: number;
}) {
  return (
    <td
      title={title}
      colSpan={colSpan}
      className={`border-b border-neutral-100 bg-white px-3 py-2.5 align-middle text-neutral-700 group-hover:bg-neutral-50 ${className}`}
    >
      {children}
    </td>
  );
}

export function TableEmpty({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-neutral-400">
        {children}
      </td>
    </tr>
  );
}
