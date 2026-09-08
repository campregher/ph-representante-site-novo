import { createSistemaAdminClient } from "@/lib/supabase/server";
import DescadastroForm from "./DescadastroForm";

export default async function DescadastroPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await createSistemaAdminClient();
  const { data } = await db
    .from("clientes")
    .select("nome_fantasia, razao_social, email, aceita_email")
    .eq("descadastro_token", token)
    .maybeSingle();

  const valido = !!data;
  const nome = data
    ? (data.nome_fantasia as string) || (data.razao_social as string) || ""
    : "";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 items-center justify-center">
          <span className="text-2xl font-black tracking-tight text-neutral-900">PH</span>
        </div>

        {!valido ? (
          <>
            <h1 className="text-lg font-bold text-neutral-900">Link inválido</h1>
            <p className="mt-2 text-sm text-neutral-500">
              Este link de preferências de e-mail não é válido ou expirou.
            </p>
          </>
        ) : (
          <DescadastroForm
            token={token}
            nome={nome}
            aceitaInicial={!!data!.aceita_email}
          />
        )}
      </div>
    </div>
  );
}
