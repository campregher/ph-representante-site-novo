"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/sistema/ui/Button";

/** Refaz a busca dos anúncios na API do ML (título/preço/foto/categoria/status/envio) — não busca descrição/EAN/dimensões (isso só acontece no momento de importar). */
export default function SincronizarMlButton() {
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <Button variant="outline" size="sm" loading={pending} onClick={() => start(() => router.refresh())}>
      <RefreshCw size={14} /> Sincronizar
    </Button>
  );
}
