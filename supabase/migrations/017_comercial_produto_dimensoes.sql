-- ============================================================
-- SISTEMA COMERCIAL — 017 — Dimensões da embalagem do produto
-- Aditivo e idempotente. (peso e ncm já existem na 008)
-- ============================================================

alter table comercial.produtos
  add column if not exists altura      numeric(10,2),
  add column if not exists largura     numeric(10,2),
  add column if not exists comprimento numeric(10,2);

comment on column comercial.produtos.peso is 'peso da embalagem (kg)';
comment on column comercial.produtos.altura is 'altura da embalagem (cm)';
comment on column comercial.produtos.largura is 'largura da embalagem (cm)';
comment on column comercial.produtos.comprimento is 'comprimento da embalagem (cm)';
