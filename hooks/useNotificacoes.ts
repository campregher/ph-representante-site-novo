"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

export interface Notificacao {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string | null;
  link: string | null;
  lida: boolean;
  created_at: string;
}

export function useNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading]           = useState(true);
  // Canal único por instância — evita conflito quando o componente é montado
  // em dois lugares ao mesmo tempo (sidebar desktop + header mobile)
  const channelName = useRef(`notificacoes-${Math.random().toString(36).slice(2)}`);

  const naoLidas = notificacoes.filter((n) => !n.lida).length;

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("notificacoes")
      .select("id, tipo, titulo, mensagem, link, lida, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    setNotificacoes(data ?? []);
    setLoading(false);
  }, []);

  const marcarLida = useCallback(async (id: string) => {
    setNotificacoes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, lida: true } : n))
    );
    const supabase = createClient();
    await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
  }, []);

  const marcarTodasLidas = useCallback(async () => {
    const ids = notificacoes.filter((n) => !n.lida).map((n) => n.id);
    if (!ids.length) return;
    setNotificacoes((prev) => prev.map((n) => ({ ...n, lida: true })));
    const supabase = createClient();
    await supabase.from("notificacoes").update({ lida: true }).in("id", ids);
  }, [notificacoes]);

  useEffect(() => {
    carregar();

    const supabase = createClient();
    const channel  = supabase
      .channel(channelName.current)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes" },
        (payload) => {
          setNotificacoes((prev) => [payload.new as Notificacao, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [carregar]);

  return { notificacoes, naoLidas, loading, marcarLida, marcarTodasLidas };
}
