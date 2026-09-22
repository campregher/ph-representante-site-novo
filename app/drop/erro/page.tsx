import AuthCard from "@/components/sistema/AuthCard";

export default async function DropErroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const msg =
    sp.e === "ml_auth"
      ? "Não conseguimos validar a autorização do Mercado Livre. Tente conectar de novo pelo link do seu portal."
      : sp.e === "sem_cadastro"
        ? "Não encontramos um cadastro de seller vinculado a esse login. Fale com a gente ou cadastre-se em /drop/cadastro."
        : "Algo deu errado.";

  return (
    <AuthCard title="Ocorreu um erro" subtitle={msg}>
      {null}
    </AuthCard>
  );
}
