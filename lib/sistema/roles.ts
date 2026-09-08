// Constantes/tipos de papel — seguros para importar em Client Components
// (sem dependência de next/headers ou do cliente Supabase de servidor).

export type Role = "admin" | "gerente" | "vendedor" | "financeiro" | "consulta";

export const ROLE_LABEL: Record<Role, string> = {
  admin: "Administrador",
  gerente: "Gerente",
  vendedor: "Vendedor",
  financeiro: "Financeiro",
  consulta: "Consulta",
};

export const ROLE_OPTIONS: { value: Role; label: string }[] = (
  Object.keys(ROLE_LABEL) as Role[]
).map((value) => ({ value, label: ROLE_LABEL[value] }));

export function canManage(role: Role): boolean {
  return role === "admin" || role === "gerente";
}

export function canFinance(role: Role): boolean {
  return role === "admin" || role === "gerente" || role === "financeiro";
}
