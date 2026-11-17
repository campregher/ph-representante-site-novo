"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Recarrega os dados da página (Server Component) em intervalos, sem
 *  recarregar a tela inteira — usado em telas que dependem de status
 *  atualizado por webhook/cron em segundo plano (ex.: Pedidos), pra não
 *  depender do usuário apertar F5 pra ver uma mudança que já aconteceu no
 *  banco. Não renderiza nada. */
export default function AutoRefresh({ intervalMs = 20000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
