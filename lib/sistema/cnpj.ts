export interface CnpjData {
  fonte: "cnpja" | "brasilapi";
  razao_social: string;
  nome_fantasia: string;
  inscricao_estadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  telefone: string;
  email: string;
  situacao: string;
}
