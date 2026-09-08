import { createSistemaClient } from "@/lib/supabase/server";
import type { Representada, CategoriaProduto, TabelaPreco } from "./types";

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

/** Clientes para <select> (respeita RLS: vendedor vê só os seus). */
export async function listClienteOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await createSistemaClient();
  const { data } = await supabase
    .from("clientes")
    .select("id, nome_fantasia, razao_social, status")
    .neq("status", "bloqueado")
    .order("nome_fantasia", { ascending: true, nullsFirst: false })
    .limit(2000);
  return (data ?? []).map((c) => ({
    id: c.id as string,
    label: (c.nome_fantasia as string) || (c.razao_social as string) || "—",
  }));
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
