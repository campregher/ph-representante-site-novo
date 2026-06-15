import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/* palavras irrelevantes para busca por palavras-chave */
const STOPWORDS = new Set([
  "para", "com", "sem", "por", "dos", "das", "dos", "del",
  "universal", "kit", "peças", "pecas", "conjunto", "par",
  "preto", "preta", "branco", "branca", "cinza", "azul", "vermelho",
  "novo", "nova", "original", "premium", "luxo", "sport",
  "carro", "veiculo", "veículo", "auto", "automotivo",
]);

/* extrai tokens que parecem SKUs do título */
function extractSkuCandidates(title: string): string[] {
  // padrões como: TAP-001, ABC123, SKU-1234, MLM123456 (mas não IDs ML)
  const matches = title.match(/\b[A-Z]{2,}[-.]?\d{2,}[-.]?\w*\b/g) ?? [];
  // exclui padrões ML (MLB/MLA + só dígitos)
  return matches.filter(m => !/^ML[A-Z]\d+$/.test(m));
}

/* extrai palavras-chave relevantes do título */
function extractKeywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length >= 4 && !STOPWORDS.has(w))
    .slice(0, 4);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await request.json();
  const items: { id: string; title: string }[] = body.items ?? [];
  if (!items.length) return NextResponse.json({ suggestions: [] });

  const db = await createAdminClient();

  /* marcas aprovadas para este cliente */
  const { data: cliente } = await db
    .from("clientes")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!cliente) return NextResponse.json({ suggestions: [] });

  const { data: aprovadas } = await db
    .from("marca_clientes")
    .select("marca_slug")
    .eq("cliente_id", cliente.id)
    .eq("status", "aprovado")
    .eq("bloqueado", false);

  const slugs = (aprovadas ?? []).map(a => a.marca_slug as string);
  if (!slugs.length) return NextResponse.json({ suggestions: [] });

  type Suggestion = {
    ml_item_id: string;
    produto_id: string;
    produto_name: string;
    produto_sku: string;
    preco_revenda: number | null;
    confidence: "sku" | "titulo";
  };

  const suggestions: Suggestion[] = [];

  for (const item of items) {
    /* 1) tenta por SKU */
    const skuCandidates = extractSkuCandidates(item.title);
    let found = false;

    for (const sku of skuCandidates) {
      const safe = sku.replace(/[%_]/g, "\\$&");
      const { data } = await db
        .from("produtos")
        .select("id, sku, name, resale_price, price")
        .in("brand", slugs)
        .eq("active", true)
        .ilike("sku", `%${safe}%`)
        .limit(1)
        .maybeSingle();

      if (data) {
        suggestions.push({
          ml_item_id:    item.id,
          produto_id:    data.id,
          produto_name:  data.name,
          produto_sku:   data.sku,
          preco_revenda: data.resale_price ?? data.price ?? null,
          confidence:    "sku",
        });
        found = true;
        break;
      }
    }

    if (found) continue;

    /* 2) fallback: busca por palavras-chave do título */
    const keywords = extractKeywords(item.title);
    if (!keywords.length) continue;

    /* usa a primeira palavra-chave mais específica */
    for (const kw of keywords) {
      const safe = kw.replace(/[%_]/g, "\\$&");
      const { data } = await db
        .from("produtos")
        .select("id, sku, name, resale_price, price")
        .in("brand", slugs)
        .eq("active", true)
        .or(`name.ilike.%${safe}%,sku.ilike.%${safe}%`)
        .limit(1)
        .maybeSingle();

      if (data) {
        suggestions.push({
          ml_item_id:    item.id,
          produto_id:    data.id,
          produto_name:  data.name,
          produto_sku:   data.sku,
          preco_revenda: data.resale_price ?? data.price ?? null,
          confidence:    "titulo",
        });
        break;
      }
    }
  }

  return NextResponse.json({ suggestions });
}
