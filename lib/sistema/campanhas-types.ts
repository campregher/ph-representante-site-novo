// Tipos e constantes de Campanhas — seguros para importar em Client Components
// (sem dependência de next/headers / cliente Supabase de servidor).

export interface CampanhaModelo {
  id: string;
  nome: string;
  assunto: string;
  corpo: string;
  ativo: boolean;
}

export interface CampanhaAlvo {
  id: string;
  nome: string;
  email: string;
  dias: number | null;
  vendedor_id: string | null;
  vendedorNome: string | null;
  descadastro_token: string;
  jaRecebeu30d: boolean;
}

export interface CampanhaResumo {
  id: string;
  nome: string;
  assunto: string;
  faixa_min_dias: number | null;
  inclui_nunca: boolean;
  criado_por: string | null;
  criadoNome: string | null;
  total_alvos: number;
  total_enviado: number;
  total_erro: number;
  total_pulado: number;
  enviado_em: string | null;
  created_at: string;
}

export const FAIXA_OPCOES = [
  { value: "30", label: "Sem comprar há +30 dias" },
  { value: "60", label: "Sem comprar há +60 dias" },
  { value: "90", label: "Sem comprar há +90 dias" },
  { value: "180", label: "Sem comprar há +180 dias" },
  { value: "nunca", label: "Nunca compraram" },
] as const;
