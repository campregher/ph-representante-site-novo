-- ============================================================
-- SISTEMA COMERCIAL — 034 — Admin puxa os próprios anúncios do ML
--
-- Conta do Mercado Livre da EMPRESA (não de um seller) — usada só pelo
-- admin/gerente pra importar produtos da linha própria a partir dos
-- anúncios que a PH já tem publicados. Nenhum seller participa disso.
-- ============================================================

create table if not exists comercial.admin_ml_token (
  id            uuid primary key default gen_random_uuid(),
  ml_user_id    text not null unique,
  ml_nickname   text,
  access_token  text not null,
  refresh_token text not null,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists admin_ml_token_updated_at on comercial.admin_ml_token;
create trigger admin_ml_token_updated_at
  before update on comercial.admin_ml_token
  for each row execute function comercial.set_updated_at();

alter table comercial.admin_ml_token enable row level security;
drop policy if exists admin_ml_token_all on comercial.admin_ml_token;
create policy admin_ml_token_all on comercial.admin_ml_token
  for all to authenticated using (comercial.can_manage()) with check (comercial.can_manage());

-- rastreia de qual anúncio do ML o produto foi importado — evita reimportar
-- o mesmo anúncio duas vezes e mostra "já importado" na lista
alter table comercial.produtos
  add column if not exists ml_item_id text;

create unique index if not exists produtos_ml_item_id_uidx
  on comercial.produtos (ml_item_id) where ml_item_id is not null;
