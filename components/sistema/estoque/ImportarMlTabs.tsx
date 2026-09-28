"use client";

import { useState, type ReactNode } from "react";

export default function ImportarMlTabs({
  disponiveisLabel,
  importadosLabel,
  disponiveis,
  importados,
}: {
  disponiveisLabel: string;
  importadosLabel: string;
  disponiveis: ReactNode;
  importados: ReactNode;
}) {
  const [aba, setAba] = useState<"disponiveis" | "importados">("disponiveis");

  const tabClass = (ativo: boolean) =>
    `border-b-2 px-1 pb-2 text-sm font-medium ${
      ativo ? "border-brand text-brand" : "border-transparent text-neutral-500 hover:text-neutral-800"
    }`;

  return (
    <div>
      <div className="mb-4 flex gap-6 border-b border-neutral-200">
        <button type="button" className={tabClass(aba === "disponiveis")} onClick={() => setAba("disponiveis")}>
          {disponiveisLabel}
        </button>
        <button type="button" className={tabClass(aba === "importados")} onClick={() => setAba("importados")}>
          {importadosLabel}
        </button>
      </div>
      {aba === "disponiveis" ? disponiveis : importados}
    </div>
  );
}
