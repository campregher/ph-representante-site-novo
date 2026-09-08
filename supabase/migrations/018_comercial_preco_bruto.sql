-- ============================================================
-- SISTEMA COMERCIAL — 018 — Preço bruto + tabelas por desconto
--
-- Novo modelo de precificação:
--   • produto tem UM preço bruto (lista) — importado por planilha
--   • tabela de preço = regra de desconto (%) sobre o bruto
--   • produtos_precos passa a guardar apenas EXCEÇÕES (override do
--     preço líquido de um produto numa tabela específica)
--
-- Aditivo e idempotente.
-- ============================================================

alter table comercial.produtos
  add column if not exists preco_bruto numeric(12,2);

alter table comercial.tabelas_preco
  add column if not exists desconto_percentual numeric(6,3) not null default 0;

comment on column comercial.produtos.preco_bruto is 'preço de lista / bruto (base para as tabelas de desconto)';
comment on column comercial.tabelas_preco.desconto_percentual is 'desconto % aplicado sobre o preço bruto do produto';
comment on column comercial.produtos_precos.preco is 'override do preço líquido (exceção) — quando nulo/ausente, usa bruto - desconto da tabela';
