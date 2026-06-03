// Re-exporta do cliente Meta Cloud API
export { sendText } from "@/lib/meta-whatsapp";

export interface MediaResult { base64: string; mimetype: string; fileName?: string }
export async function getMediaBase64(): Promise<MediaResult | null> { return null; }
