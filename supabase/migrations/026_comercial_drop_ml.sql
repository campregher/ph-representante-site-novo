-- ============================================================
-- SISTEMA COMERCIAL — 026 — Portal do seller (drop) + Mercado Livre
--
-- Retomada/adaptação do antigo portal_ml_tokens (schema public,
-- removido no commit 63c1fd9 junto com /portal). Agora vive no
-- schema comercial, referenciando comercial.clientes (não auth.users
-- — sellers não logam via Supabase Auth, usam link com token).
-- ============================================================

-- token de acesso do portal do seller (link mágico, sem senha)
alter table comercial.clientes
  add column if not exists portal_token uuid not null default gen_random_uuid();

create unique index if not exists clientes_portal_token_uidx
  on comercial.clientes (portal_token);

-- token OAuth do Mercado Livre de cada seller
create table if not exists comercial.cliente_ml_tokens (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null unique references comercial.clientes(id) on delete cascade,
  ml_user_id    text not null,
  ml_nickname   text,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists cliente_ml_tokens_ml_user_idx
  on comercial.cliente_ml_tokens (ml_user_id);

drop trigger if exists cliente_ml_tokens_updated_at on comercial.cliente_ml_tokens;
create trigger cliente_ml_tokens_updated_at
  before update on comercial.cliente_ml_tokens
  for each row execute function comercial.set_updated_at();

alter table comercial.cliente_ml_tokens enable row level security;
-- só admin/gerente (via client normal); a maior parte do acesso é via
-- service role nas rotas do portal público (sem sessão de usuário interno)
drop policy if exists cliente_ml_tokens_sel on comercial.cliente_ml_tokens;
create policy cliente_ml_tokens_sel on comercial.cliente_ml_tokens
  for select to authenticated using (comercial.has_access());
drop policy if exists cliente_ml_tokens_all on comercial.cliente_ml_tokens;
create policy cliente_ml_tokens_all on comercial.cliente_ml_tokens
  for all to authenticated using (comercial.can_manage()) with check (comercial.can_manage());
