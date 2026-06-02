function base() { return (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, ""); }
function key()  { return process.env.EVOLUTION_API_KEY ?? ""; }
function inst() { return process.env.EVOLUTION_INSTANCE ?? ""; }

export async function sendText(to: string, text: string): Promise<void> {
  await fetch(`${base()}/message/sendText/${inst()}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json", apikey: key() },
    body:    JSON.stringify({ number: to, text }),
  }).catch(() => {});
}

export interface MediaResult { base64: string; mimetype: string; fileName?: string }

export async function getMediaBase64(
  msgKey:     Record<string, unknown>,
  msgContent: Record<string, unknown>,
): Promise<MediaResult | null> {
  try {
    const res = await fetch(`${base()}/chat/getBase64FromMediaMessage/${inst()}`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", apikey: key() },
      body:    JSON.stringify({ message: { key: msgKey, message: msgContent } }),
    });
    if (!res.ok) return null;
    return await res.json() as MediaResult;
  } catch { return null; }
}
