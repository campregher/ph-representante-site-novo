"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Search } from "lucide-react";
import type { CnpjData } from "@/lib/sistema/cnpj";
import { Button } from "./ui/Button";

export default function CnpjLookup({
  cnpj,
  onData,
  size = "md",
}: {
  cnpj: string;
  onData: (data: CnpjData) => void;
  size?: "sm" | "md";
}) {
  const [loading, setLoading] = useState(false);

  async function run() {
    const clean = String(cnpj ?? "").replace(/\D/g, "");
    if (clean.length !== 14) {
      toast.error("Digite um CNPJ com 14 dígitos primeiro.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sistema/cnpj/${clean}`);
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Falha na consulta.");
        return;
      }
      const data = json as CnpjData;
      onData(data);
      toast.success(
        data.inscricao_estadual
          ? "Dados preenchidos (inclui inscrição estadual)."
          : "Dados preenchidos — inscrição estadual não disponível nesta fonte."
      );
    } catch {
      toast.error("Erro de rede ao consultar o CNPJ.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" size={size} onClick={run} loading={loading}>
      <Search size={14} /> Puxar da Receita
    </Button>
  );
}
