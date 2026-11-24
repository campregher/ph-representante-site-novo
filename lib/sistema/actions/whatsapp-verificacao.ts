"use server";

import { createHash } from "node:crypto";
import { createDropshippingAdminClient } from "@/lib/supabase/server";
import { normalizarWhatsappBR } from "@/lib/sistema/format";
import { enviarWhatsapp } from "@/lib/sistema/zapi-omni";
import type { ActionResult } from "@/lib/sistema/types";

const CODIGO_VALIDADE_MIN = 5;
const REENVIO_INTERVALO_SEG = 45;
const MAX_TENTATIVAS = 5;

function hashCodigo(codigo: string, whatsapp: string): string {
  return createHash("sha256").update(`${whatsapp}:${codigo}`).digest("hex");
}

export async function enviarCodigoWhatsapp(whatsappRaw: string): Promise<ActionResult> {
  const whatsapp = normalizarWhatsappBR(whatsappRaw);
  if (!whatsapp) return { ok: false, error: "WhatsApp inválido — informe DDD + número." };

  const db = await createDropshippingAdminClient();

  const { data: ultimo } = await db
    .from("whatsapp_verificacoes")
    .select("created_at")
    .eq("whatsapp", whatsapp)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (ultimo) {
    const segsDesde = (Date.now() - new Date(ultimo.created_at as string).getTime()) / 1000;
    if (segsDesde < REENVIO_INTERVALO_SEG) {
      return { ok: false, error: `Aguarde ${Math.ceil(REENVIO_INTERVALO_SEG - segsDesde)}s para pedir outro código.` };
    }
  }

  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expiraEm = new Date(Date.now() + CODIGO_VALIDADE_MIN * 60_000).toISOString();

  const envio = await enviarWhatsapp(
    whatsapp,
    `Seu código de verificação PH Representante: ${codigo}\n\nVale por ${CODIGO_VALIDADE_MIN} minutos. Se não foi você, ignore esta mensagem.`
  );
  if (!envio.ok) return { ok: false, error: envio.error };

  const { error } = await db.from("whatsapp_verificacoes").insert({
    whatsapp,
    codigo_hash: hashCodigo(codigo, whatsapp),
    expira_em: expiraEm,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

export async function confirmarCodigoWhatsapp(whatsappRaw: string, codigo: string): Promise<ActionResult> {
  const whatsapp = normalizarWhatsappBR(whatsappRaw);
  if (!whatsapp) return { ok: false, error: "WhatsApp inválido." };
  if (!/^\d{6}$/.test(codigo.trim())) return { ok: false, error: "Código inválido — são 6 dígitos." };

  const db = await createDropshippingAdminClient();
  const { data: pendente } = await db
    .from("whatsapp_verificacoes")
    .select("id, codigo_hash, tentativas, expira_em, verificado")
    .eq("whatsapp", whatsapp)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendente) return { ok: false, error: "Peça um código antes de confirmar." };
  if (pendente.verificado) return { ok: true };
  if (new Date(pendente.expira_em as string).getTime() < Date.now()) {
    return { ok: false, error: "Código expirado — peça um novo." };
  }
  if ((pendente.tentativas as number) >= MAX_TENTATIVAS) {
    return { ok: false, error: "Muitas tentativas — peça um novo código." };
  }

  if (hashCodigo(codigo.trim(), whatsapp) !== pendente.codigo_hash) {
    await db
      .from("whatsapp_verificacoes")
      .update({ tentativas: (pendente.tentativas as number) + 1 })
      .eq("id", pendente.id as string);
    return { ok: false, error: "Código incorreto." };
  }

  const { error } = await db
    .from("whatsapp_verificacoes")
    .update({ verificado: true, verificado_em: new Date().toISOString() })
    .eq("id", pendente.id as string);
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

/** Usado no submit final do cadastro (server-side, não confia só no client) —
 *  considera válido só se verificado nos últimos 60min (evita reaproveitar
 *  uma verificação velha de outra sessão/pessoa no mesmo número). */
export async function whatsappFoiVerificado(whatsappRaw: string): Promise<boolean> {
  const whatsapp = normalizarWhatsappBR(whatsappRaw);
  if (!whatsapp) return false;
  const db = await createDropshippingAdminClient();
  const { data } = await db
    .from("whatsapp_verificacoes")
    .select("verificado_em")
    .eq("whatsapp", whatsapp)
    .eq("verificado", true)
    .order("verificado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data?.verificado_em) return false;
  return Date.now() - new Date(data.verificado_em as string).getTime() < 60 * 60_000;
}
