-- ============================================================
-- SISTEMA COMERCIAL — 027 — Confirmação de e-mail do seller (drop D1)
-- ============================================================

alter table comercial.clientes
  add column if not exists email_confirmado boolean not null default false;
