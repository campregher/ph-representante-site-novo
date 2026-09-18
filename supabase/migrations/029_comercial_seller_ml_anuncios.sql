-- ============================================================
-- SISTEMA COMERCIAL — 029 — D5: publicar/editar anúncios no ML (seller)
--
-- Categoria do Mercado Livre é definida por produto (admin, via
-- category_predictor). Cada anúncio publicado por um seller vira 1 linha
-- em seller_ml_anuncios (1 anúncio por cliente+produto).
-- ============================================================

alter table comercial.produtos
  add column if not exists ml_category_id text,
  add column if not exists ml_category_nome text;

create table if not exists comercial.seller_ml_anuncios (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references comercial.clientes(id) on delete cascade,
  produto_id    uuid not null references comercial.produtos(id) on delete cascade,
  ml_item_id    text not null unique,
  ml_status     text not null default 'active',
  ml_permalink  text,
  preco_revenda numeric(12,2) not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cliente_id, produto_id)
);

create index if not exists seller_ml_anuncios_cliente_idx
  on comercial.seller_ml_anuncios (cliente_id);

drop trigger if exists seller_ml_anuncios_updated_at on comercial.seller_ml_anuncios;
create trigger seller_ml_anuncios_updated_at
  before update on comercial.seller_ml_anuncios
  for each row execute function comercial.set_updated_at();

alter table comercial.seller_ml_anuncios enable row level security;
-- leitura pra quem tem acesso ao /sistema; escrita normalmente vem do portal
-- público (service role) — a policy de escrita é só pra gestão manual futura
drop policy if exists seller_ml_anuncios_sel on comercial.seller_ml_anuncios;
create policy seller_ml_anuncios_sel on comercial.seller_ml_anuncios
  for select to authenticated using (comercial.has_access());
drop policy if exists seller_ml_anuncios_all on comercial.seller_ml_anuncios;
create policy seller_ml_anuncios_all on comercial.seller_ml_anuncios
  for all to authenticated using (comercial.can_manage()) with check (comercial.can_manage());
