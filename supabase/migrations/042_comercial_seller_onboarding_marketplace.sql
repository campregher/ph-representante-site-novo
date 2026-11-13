-- Reestrutura o questionário pós-aprovação do seller: antes de perguntar
-- interesse de categoria, pergunta se já vende em marketplace e, se sim,
-- há quanto tempo, quais métodos de envio usa (pode ser mais de um) e
-- quantas vendas faz por mês. onboarding_canal/onboarding_volume_mensal
-- (migration 040) ficam sem uso a partir de agora, mas não são removidas.
alter table comercial.clientes
  add column if not exists onboarding_ja_vende boolean,
  add column if not exists onboarding_tempo_vendendo text,
  add column if not exists onboarding_metodos_envio text[],
  add column if not exists onboarding_vendas_mes text;
