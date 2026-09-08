import { requireSistemaProfile, ROLE_LABEL } from "@/lib/sistema/auth";
import { canManage } from "@/lib/sistema/roles";
import { getEmpresaConfig } from "@/lib/sistema/config";
import { createSistemaClient } from "@/lib/supabase/server";
import { listRepresentadaOptions, listVendedorOptions } from "@/lib/sistema/queries";
import { PageHeader } from "@/components/sistema/ui/State";
import { Card, CardHeader, CardBody } from "@/components/sistema/ui/Card";
import { Badge } from "@/components/sistema/ui/Badge";
import MeuPerfilForm from "@/components/sistema/config/MeuPerfilForm";
import EmpresaConfigForm from "@/components/sistema/config/EmpresaConfigForm";
import MetasForm from "@/components/sistema/config/MetasForm";
import MetaVendedorForm from "@/components/sistema/config/MetaVendedorForm";
import UsuariosManager from "@/components/sistema/config/UsuariosManager";

export default async function ConfiguracoesPage() {
  const profile = await requireSistemaProfile();
  const isAdmin = profile.role === "admin";
  const gestor = canManage(profile.role);
  const empresa = isAdmin ? await getEmpresaConfig() : null;

  const metasGeral: Record<string, number> = {};
  const metasVendedor: Record<string, number> = {};
  let vendedores: { id: string; label: string }[] = [];
  let representadas: { id: string; label: string }[] = [];
  let usuarios: { id: string; nome: string; email: string; role: string; ativo: boolean }[] = [];

  if (gestor) {
    const supabase = await createSistemaClient();
    const [{ data: metasRaw }, vend, reps] = await Promise.all([
      supabase.from("metas_vendas").select("ano, mes, valor_meta, vendedor_id, representada_id"),
      listVendedorOptions(),
      listRepresentadaOptions(),
    ]);
    vendedores = vend;
    representadas = reps;
    for (const m of metasRaw ?? []) {
      const ym = `${m.ano}-${String(m.mes).padStart(2, "0")}`;
      if (!m.vendedor_id && !m.representada_id) {
        metasGeral[ym] = Number(m.valor_meta);
      } else if (m.vendedor_id) {
        metasVendedor[`${ym}|${m.vendedor_id}|${m.representada_id ?? "geral"}`] = Number(m.valor_meta);
      }
    }
  }

  if (isAdmin) {
    const supabase = await createSistemaClient();
    const { data } = await supabase
      .from("profiles")
      .select("id, nome, email, role, ativo")
      .order("nome", { ascending: true });
    usuarios = (data ?? []).map((u) => ({
      id: u.id as string,
      nome: (u.nome as string) ?? "—",
      email: (u.email as string) ?? "—",
      role: u.role as string,
      ativo: !!u.ativo,
    }));
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Configurações" description="Sua conta e parâmetros do sistema." />

      <Card className="mb-4">
        <CardHeader
          title="Minha conta"
          description={`Papel: ${ROLE_LABEL[profile.role]}`}
          action={<Badge tone="brand">{ROLE_LABEL[profile.role]}</Badge>}
        />
        <CardBody>
          <MeuPerfilForm
            initial={{
              nome: profile.nome ?? "",
              telefone: profile.telefone ?? "",
              email: profile.email ?? "",
            }}
          />
        </CardBody>
      </Card>

      {isAdmin && empresa && (
        <Card className="mb-4">
          <CardHeader
            title="Dados da empresa"
            description="Aparecem no PDF e no link do pedido enviado ao cliente."
          />
          <CardBody>
            <EmpresaConfigForm initial={empresa} />
          </CardBody>
        </Card>
      )}

      {isAdmin && (
        <Card className="mb-4">
          <CardHeader
            title="Usuários"
            description="Crie acessos e defina papéis. Novos usuários trocam a senha no 1º acesso."
          />
          <CardBody>
            <UsuariosManager usuarios={usuarios} selfId={profile.id} />
          </CardBody>
        </Card>
      )}

      {gestor && (
        <Card className="mb-4">
          <CardHeader
            title="Metas de vendas"
            description="Meta mensal geral. Usada nos cartões e no gráfico do painel."
          />
          <CardBody>
            <MetasForm metas={metasGeral} />
          </CardBody>
        </Card>
      )}

      {gestor && vendedores.length > 0 && (
        <Card className="mb-4">
          <CardHeader
            title="Metas por vendedor"
            description="Meta mensal individual, opcionalmente por representada."
          />
          <CardBody>
            <MetaVendedorForm
              vendedores={vendedores}
              representadas={representadas}
              metas={metasVendedor}
            />
          </CardBody>
        </Card>
      )}
    </div>
  );
}
