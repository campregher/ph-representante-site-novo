/** Envio de WhatsApp via Z-API Omni (canal "PH Representante" — WhatsApp Web).
 *  Server-only: a Secret Key nunca pode chegar no client (ver
 *  developer.omni.z-api.io/authentication). */
export async function enviarWhatsapp(numeroE164: string, mensagem: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const channelId = process.env.ZAPI_OMNI_CHANNEL_ID;
  const secretKey = process.env.ZAPI_OMNI_SECRET_KEY;
  if (!channelId || !secretKey) return { ok: false, error: "Z-API Omni não configurada." };

  try {
    const res = await fetch(`https://api.omni.z-api.io/v1/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secretKey}`,
      },
      body: JSON.stringify({
        recipient: { identifier: numeroE164 },
        content: { type: "TEXT", body: { message: mensagem } },
      }),
    });
    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      return { ok: false, error: `Falha ao enviar WhatsApp (${res.status}): ${texto}` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Erro de rede ao enviar WhatsApp." };
  }
}
