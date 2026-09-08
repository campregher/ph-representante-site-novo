-- ============================================================
-- SISTEMA COMERCIAL — 019 — Link público do pedido (token)
-- Cada pedido ganha um token não-adivinhável para compartilhar
-- uma visualização somente-leitura (/p/<token>).
-- Aditivo e idempotente.
-- ============================================================

alter table comercial.pedidos
  add column if not exists share_token uuid not null default gen_random_uuid();

create unique index if not exists pedidos_share_token_uidx
  on comercial.pedidos (share_token);
