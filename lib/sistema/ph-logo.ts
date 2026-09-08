import { readFile } from "node:fs/promises";
import path from "node:path";

let cache: string | null | undefined;

/** Logo da PH como data URI (para embutir em PDFs). */
export async function phLogoDataUri(): Promise<string | null> {
  if (cache !== undefined) return cache;
  try {
    const buf = await readFile(path.join(process.cwd(), "public", "images", "ph.png"));
    cache = `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    cache = null;
  }
  return cache;
}
