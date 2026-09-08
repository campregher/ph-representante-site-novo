-- ============================================================
-- SISTEMA COMERCIAL — 014 — Modalidades de atendimento da representada
-- (atacado / dropshipping + opções do dropship)
-- Aditivo e idempotente.
-- ============================================================

alter table comercial.representadas
  add column if not exists modalidades text[] not null default array['atacado']::text[],
  add column if not exists dropship_faturamento text,
  add column if not exists dropship_condicoes_pagamento text[] not null default array[]::text[],
  add column if not exists dropship_observacoes text;

comment on column comercial.representadas.modalidades is
  'valores livres esperados: atacado | dropshipping';

-- índice para filtrar por modalidade
create index if not exists representadas_modalidades_idx
  on comercial.representadas using gin (modalidades);
