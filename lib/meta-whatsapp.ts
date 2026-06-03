const API_URL = "https://graph.facebook.com/v19.0";

function phoneId() { return process.env.META_PHONE_NUMBER_ID ?? ""; }
function token()   { return process.env.META_ACCESS_TOKEN ?? ""; }

export async function sendText(to: string, text: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/${phoneId()}/messages`, {
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
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[meta-whatsapp] sendText error:", res.status, JSON.stringify(err));
    }
  } catch (e) {
    console.error("[meta-whatsapp] sendText exception:", e);
  }
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

export async function uploadMedia(buffer: Buffer, mimeType: string, filename: string): Promise<string | null> {
  try {
    const form = new FormData();
    form.append("messaging_product", "whatsapp");
    form.append("type", mimeType);
    const arrayBuffer = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(arrayBuffer).set(buffer);

    form.append("file", new Blob([arrayBuffer], { type: mimeType }), filename);

    const res = await fetch(`${API_URL}/${phoneId()}/media`, {
      method:  "POST",
      headers: { "Authorization": `Bearer ${token()}` },
      body:    form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[meta-whatsapp] uploadMedia error:", res.status, JSON.stringify(err));
      return null;
    }
    const data = await res.json() as { id?: string };
    return data.id ?? null;
  } catch (e) {
    console.error("[meta-whatsapp] uploadMedia exception:", e);
    return null;
  }
}

export async function sendImage(to: string, mediaId: string, caption?: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/${phoneId()}/messages`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token()}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "image",
        image: { id: mediaId, ...(caption ? { caption } : {}) },
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error("[meta-whatsapp] sendImage error:", res.status, JSON.stringify(err));
    }
  } catch (e) {
    console.error("[meta-whatsapp] sendImage exception:", e);
  }
}
