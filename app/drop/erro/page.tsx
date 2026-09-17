export default async function DropErroPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const msg =
    sp.e === "ml_auth"
      ? "Não conseguimos validar a autorização do Mercado Livre. Tente conectar de novo pelo link do seu portal."
      : "Algo deu errado.";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-8 text-center shadow-sm">
        <span className="text-2xl font-black tracking-tight text-neutral-900">PH</span>
        <h1 className="mt-4 text-lg font-bold text-neutral-900">Ocorreu um erro</h1>
        <p className="mt-2 text-sm text-neutral-500">{msg}</p>
      </div>
    </div>
  );
}
