import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { requireRole } from "@/lib/sistema/auth";
import { fornecedorOptions, categoriaLinhaPropriaOptions } from "@/lib/sistema/estoque";
import { PageHeader } from "@/components/sistema/ui/State";
import { Button } from "@/components/sistema/ui/Button";
import ProdutoProprioForm from "@/components/sistema/estoque/ProdutoProprioForm";

export default async function NovoProdutoProprioPage() {
  await requireRole("admin", "gerente");
  const [fornecedores, categorias] = await Promise.all([fornecedorOptions(), categoriaLinhaPropriaOptions()]);
  return (
    <div>
      <PageHeader
        title="Novo produto (linha própria)"
        action={
          <Link href="/sistema/estoque/produtos/importar-ml">
            <Button variant="outline" size="sm">
              <ShoppingBag size={14} /> Importar do Mercado Livre
            </Button>
          </Link>
        }
      />
      <ProdutoProprioForm fornecedores={fornecedores} categorias={categorias} />
    </div>
  );
}
