-- ============================================================
-- SISTEMA COMERCIAL — 033 — Seller conecta mais de uma conta do ML
--
-- Antes: 1 conta do Mercado Livre por seller (unique em cliente_id).
-- Agora: N contas por seller (unique em cliente_id+ml_user_id), e cada
-- anúncio (seller_ml_anuncios) passa a saber em qual conta foi publicado
-- — o mesmo produto pode ser anunciado em mais de uma conta ao mesmo tempo.
-- ============================================================

alter table comercial.cliente_ml_tokens
  drop constraint if exists cliente_ml_tokens_cliente_id_key;

create unique index if not exists cliente_ml_tokens_cliente_ml_user_uidx
  on comercial.cliente_ml_tokens (cliente_id, ml_user_id);

alter table comercial.seller_ml_anuncios
  add column if not exists ml_conta_id uuid references comercial.cliente_ml_tokens(id) on delete cascade;

-- backfill: cada seller só tinha 1 conta até aqui, então dá pra inferir
update comercial.seller_ml_anuncios a
set ml_conta_id = t.id
from comercial.cliente_ml_tokens t
where a.ml_conta_id is null and t.cliente_id = a.cliente_id;

alter table comercial.seller_ml_anuncios
  drop constraint if exists seller_ml_anuncios_cliente_id_produto_id_key;

create unique index if not exists seller_ml_anuncios_cliente_produto_conta_uidx
  on comercial.seller_ml_anuncios (cliente_id, produto_id, ml_conta_id);

create index if not exists seller_ml_anuncios_ml_conta_idx
  on comercial.seller_ml_anuncios (ml_conta_id);
