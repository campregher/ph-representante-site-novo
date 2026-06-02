import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PortalDashboard from "@/components/portal/PortalDashboard";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/portal/login");

  const { data: clienteRows, error } = await supabase
    .from("clientes")
    .select("*, bloqueado")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);

  const cliente = clienteRows?.[0] ?? null;

  const { data: rawOrders } = cliente
    ? await supabase
        .from("orcamentos")
        .select("id, numero, status, marca, total, created_at, orcamento_itens(quantidade)")
        .eq("cliente_id", cliente.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const orders = (rawOrders ?? []) as any[];

  return (
    <PortalDashboard
      cliente={cliente}
      dbError={error?.message}
      userEmail={user.email}
      orders={orders}
    />
  );
}
