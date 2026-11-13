-- ============================================================
-- SISTEMA COMERCIAL — 040 — Onboarding do seller pós-aprovação
--
-- Depois que o admin aprova o cadastro (status -> ativo), o seller
-- responde um pequeno questionário (categorias de interesse, canal,
-- volume) antes de usar o resto do portal. Isso ajuda a direcionar
-- os fornecedores/produtos certos pra conta dele.
-- ============================================================

alter table comercial.clientes
  add column if not exists onboarding_completo      boolean not null default false,
  add column if not exists onboarding_interesses     text[] not null default '{}',
  add column if not exists onboarding_canal          text,
  add column if not exists onboarding_volume_mensal  text;

comment on column comercial.clientes.onboarding_completo is
  'Seller respondeu o questionário pós-aprovação (categorias/canal/volume) — gate de acesso ao /drop/dashboard.';
comment on column comercial.clientes.onboarding_interesses is
  'Categorias de produto que o seller tem interesse (ex.: calotas, tapetes, engates).';
