-- ============================================================
-- SISTEMA COMERCIAL — 028 — Margem mínima de revenda (catálogo do seller)
--
-- Preço mínimo de revenda no drop = custo / (1 - margem%/100), com a
-- margem definida pelo admin por categoria (padrão) ou por produto
-- (override). Categorias da linha própria não pertencem a nenhuma
-- representada, por isso representada_id vira opcional nessa tabela.
-- ============================================================

alter table comercial.categorias_produtos
  alter column representada_id drop not null;

alter table comercial.categorias_produtos
  add column if not exists margem_minima_percentual numeric;

alter table comercial.produtos
  add column if not exists margem_minima_percentual numeric;
