"use client";

import { useEffect, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ShoppingBag, Unlink } from "lucide-react";
import { desconectarMlPortal } from "@/lib/sistema/actions/seller-portal";
import { Button } from "@/components/sistema/ui/Button";

export default function SellerPortalMl({
  token,
  conectado,
  nickname,
}: {
  token: string;
  conectado: boolean;
  nickname: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  useEffect(() => {
    const ml = sp.get("ml");
    if (ml === "conectado") toast.success("Conta do Mercado Livre conectada!");
    if (ml === "erro") toast.error(sp.get("detalhe") || "Falha ao conectar o Mercado Livre.");
    if (ml) router.replace(`/drop/portal/${token}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function desconectar() {
    start(async () => {
      const res = await desconectarMlPortal(token);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Conta do Mercado Livre desconectada.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
          <ShoppingBag size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold text-neutral-900">Mercado Livre</p>
          <p className="text-xs text-neutral-500">
            {conectado ? `Conectado${nickname ? ` como ${nickname}` : ""}` : "Não conectado"}
          </p>
        </div>
      </div>
      {conectado ? (
        <Button variant="outline" size="sm" onClick={desconectar} loading={pending}>
          <Unlink size={14} /> Desconectar
        </Button>
      ) : (
        <a href={`/api/drop/ml/connect?token=${token}`}>
          <Button size="sm" type="button">
            Conectar
          </Button>
        </a>
      )}
    </div>
  );
}
