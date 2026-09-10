import { createSistemaClient } from "@/lib/supabase/server";
import type {
  Representada,
  CategoriaProduto,
  TabelaPreco,
  ProdutoVariacao,
} from "./types";

/** Representadas ativas para popular <select> (id + rótulo). */
export async function listRepresentadaOptions(): Promise<
  { id: string; label: string }[]
> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("representadas")
    .select("id, nome_fantasia, razao_social, ativa")
    .order("nome_fantasia", { ascending: true, nullsFirst: false });
  return (data ?? [])
    .filter((r) => r.ativa)
    .map((r) => ({ id: r.id as string, label: (r.nome_fantasia as string) || (r.razao_social as string) }));
}

export async function getRepresentada(id: string): Promise<Representada | null> {
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("representadas").select("*").eq("id", id).maybeSingle();
  return (data as Representada) ?? null;
}

export async function listCategorias(representadaId: string): Promise<CategoriaProduto[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("categorias_produtos")
    .select("*")
    .eq("representada_id", representadaId)
    .order("nome", { ascending: true });
  return (data as CategoriaProduto[]) ?? [];
}

export async function listAllCategorias(): Promise<
  { id: string; nome: string; representada_id: string }[]
> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("categorias_produtos")
    .select("id, nome, representada_id")
    .order("nome", { ascending: true });
  return (data as { id: string; nome: string; representada_id: string }[]) ?? [];
}

export async function listTabelasByRepresentada(representadaId: string): Promise<TabelaPreco[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("tabelas_preco")
    .select("*")
    .eq("representada_id", representadaId)
    .order("nome", { ascending: true });
  return (data as TabelaPreco[]) ?? [];
}

export async function listAllTabelas(): Promise<
  { id: string; nome: string; representada_id: string; ativa: boolean }[]
> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("tabelas_preco")
    .select("id, nome, representada_id, ativa")
    .order("nome", { ascending: true });
  return (data as { id: string; nome: string; representada_id: string; ativa: boolean }[]) ?? [];
}

/** Profiles ativos que podem ser vendedor de um cliente/pedido. */
export async function listVendedorOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo")
    .in("role", ["admin", "gerente", "vendedor"])
    .order("nome", { ascending: true });
  return (data ?? [])
    .filter((p) => p.ativo)
    .map((p) => ({ id: p.id as string, label: (p.nome as string) || (p.email as string) }));
}

/** Clientes para <select> / Combobox (respeita RLS: vendedor vê só os seus).
 *  `keywords` permite buscar por nome fantasia, razão social ou CNPJ/CPF. */
export async function listClienteOptions(): Promise<
  { id: string; label: string; keywords: string }[]
> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social, cnpj, cpf, status")
    .neq("status", "bloqueado")
    .order("nome_fantasia", { ascending: true, nullsFirst: false })
    .limit(2000);
  return (data ?? []).map((c) => {
    const fantasia = (c.nome_fantasia as string) || "";
    const razao = (c.razao_social as string) || "";
    const cnpj = (c.cnpj as string) || "";
    const cpf = (c.cpf as string) || "";
    const doc = cnpj || cpf;
    const label = fantasia || razao || "—";
    return {
      id: c.id as string,
      label: razao && fantasia && razao !== fantasia ? `${fantasia} — ${razao}` : label,
      keywords: [fantasia, razao, doc, doc.replace(/\D/g, "")].filter(Boolean).join(" "),
    };
  });
}

export async function profileLabelMap(): Promise<Map<string, string>> {
  const supabase = await createSistemaClient();
  const { data } = await supabase.from("profiles").select("id, nome, email");
  const m = new Map<string, string>();
  for (const p of data ?? [])
    m.set(p.id as string, (p.nome as string) || (p.email as string) || "—");
  return m;
}

/** Nome fantasia (ou razão social) por id — para exibir em tabelas. */
export async function representadaLabelMap(): Promise<Map<string, string>> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("representadas")
    .select("id, nome_fantasia, razao_social");
  const map = new Map<string, string>();
  for (const r of data ?? []) {
    map.set(r.id as string, (r.nome_fantasia as string) || (r.razao_social as string));
  }
  return map;
}

/** Variações de um produto, ordenadas para exibição. */
export async function getProdutoVariacoes(produtoId: string): Promise<ProdutoVariacao[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("produto_variacoes")
    .select("*")
    .eq("produto_id", produtoId)
    .order("ordem", { ascending: true })
    .order("sku", { ascending: true });
  return (data as ProdutoVariacao[]) ?? [];
}

/** Quantidade de variações por produto (para uma lista de ids). */
export async function variacaoCountMap(produtoIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (produtoIds.length === 0) return m;
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("produto_variacoes")
    .select("produto_id")
    .in("produto_id", produtoIds);
  for (const r of data ?? []) {
    const k = r.produto_id as string;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}
