const API_URL = "https://graph.facebook.com/v19.0";

function phoneId() { return process.env.META_PHONE_NUMBER_ID ?? ""; }
function token()   { return process.env.META_ACCESS_TOKEN ?? ""; }

export async function sendText(to: string, text: string): Promise<void> {
  await fetch(`${API_URL}/${phoneId()}/messages`, {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token()}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  }).catch(() => {});
}

export async function getMediaUrl(mediaId: string): Promise<string | null> {
  try {
    const res  = await fetch(`${API_URL}/${mediaId}`, {
      headers: { "Authorization": `Bearer ${token()}` },
    });
    const data = await res.json() as { url?: string };
    return data.url ?? null;
  } catch { return null; }
}

export async function downloadMedia(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${token()}` },
    });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch { return null; }
}
