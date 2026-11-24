import SellerCadastroForm from "@/components/public/SellerCadastroForm";

export default function DropCadastroPage() {
  return <SellerCadastroForm cnaeDesativado={process.env.CNAE_VALIDACAO_DESATIVADA === "true"} />;
}
