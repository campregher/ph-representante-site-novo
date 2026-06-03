const base = () =>
  `https://api.z-api.io/instances/${process.env.ZAPI_INSTANCE_ID}/token/${process.env.ZAPI_TOKEN}`;

const headers = () => ({
  "Content-Type": "application/json",
  "Client-Token": process.env.ZAPI_CLIENT_TOKEN ?? "",
});

export async function sendText(to: string, text: string): Promise<void> {
  await fetch(`${base()}/send-text`, {
    method:  "POST",
    headers: headers(),
    body:    JSON.stringify({ phone: to, message: text }),
  }).catch(() => {});
}
