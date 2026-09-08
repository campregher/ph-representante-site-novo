-- ============================================================
-- SISTEMA COMERCIAL — 007 — Inicialização do schema
-- Cria o schema isolado `comercial`, funções utilitárias,
-- a tabela profiles e o trigger que cria um profile para cada
-- usuário do Supabase Auth.
--
-- ⚠️ NÃO é destrutivo. Não altera nenhuma tabela existente do
--    schema `public` (clientes, produtos, marcas, orcamentos...).
--
-- Depois de rodar TODAS as migrations 007..013, no painel do
-- Supabase vá em:  Project Settings → API → "Exposed schemas"
-- e adicione:  comercial
-- (sem isso o PostgREST/JS não enxerga as tabelas novas)
-- ============================================================

create schema if not exists comercial;

-- Permissões de uso do schema. `anon` NÃO recebe nada (área privada).
grant usage on schema comercial to authenticated, service_role;

alter default privileges in schema comercial
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema comercial
  grant all on tables to service_role;
alter default privileges in schema comercial
  grant usage, select on sequences to authenticated, service_role;

-- ------------------------------------------------------------
-- Função genérica de updated_at
-- ------------------------------------------------------------
create or replace function comercial.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ------------------------------------------------------------
-- PROFILES  (1:1 com auth.users)
-- ------------------------------------------------------------
create table if not exists comercial.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text,
  email       text,
  telefone    text,
  avatar_url  text,
  role        text not null default 'consulta'
              check (role in ('admin','gerente','vendedor','financeiro','consulta')),
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists profiles_role_idx on comercial.profiles (role) where ativo;

drop trigger if exists profiles_updated_at on comercial.profiles;
create trigger profiles_updated_at
  before update on comercial.profiles
  for each row execute function comercial.set_updated_at();

-- Cria um profile automaticamente para cada novo usuário do Auth.
-- role inicial = 'consulta' e ativo = true (um admin ajusta depois).
create or replace function comercial.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = comercial, public
as $$
begin
  insert into comercial.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function comercial.handle_new_user();

-- Popula profiles para usuários que já existam no Auth
insert into comercial.profiles (id, nome, email)
select u.id,
       coalesce(u.raw_user_meta_data->>'nome', split_part(u.email,'@',1)),
       u.email
from auth.users u
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Helpers de RLS
-- ------------------------------------------------------------
-- Papel do usuário logado (null se não tiver profile ativo)
create or replace function comercial.my_role()
returns text
language sql
stable
security definer
set search_path = comercial, public
as $$
  select role from comercial.profiles where id = auth.uid() and ativo = true
$$;

-- Tem QUALQUER acesso à área (profile ativo)
create or replace function comercial.has_access()
returns boolean
language sql
stable
as $$
  select comercial.my_role() is not null
$$;

-- Pode escrever dados comerciais "gerais" (cadastros)
create or replace function comercial.can_manage()
returns boolean
language sql
stable
as $$
  select comercial.my_role() in ('admin','gerente')
$$;

create or replace function comercial.is_admin()
returns boolean
language sql
stable
as $$
  select comercial.my_role() = 'admin'
$$;

-- Acesso ao módulo financeiro (faturamento / comissões)
create or replace function comercial.can_finance()
returns boolean
language sql
stable
as $$
  select comercial.my_role() in ('admin','gerente','financeiro')
$$;

grant execute on function
  comercial.my_role(), comercial.has_access(), comercial.can_manage(),
  comercial.is_admin(), comercial.can_finance()
to authenticated;

-- ------------------------------------------------------------
-- RLS de profiles
-- ------------------------------------------------------------
alter table comercial.profiles enable row level security;

drop policy if exists profiles_select on comercial.profiles;
create policy profiles_select on comercial.profiles
  for select to authenticated
  using (comercial.has_access() or id = auth.uid());

drop policy if exists profiles_update_self_or_admin on comercial.profiles;
create policy profiles_update_self_or_admin on comercial.profiles
  for update to authenticated
  using (id = auth.uid() or comercial.is_admin())
  with check (id = auth.uid() or comercial.is_admin());

drop policy if exists profiles_insert_admin on comercial.profiles;
create policy profiles_insert_admin on comercial.profiles
  for insert to authenticated
  with check (comercial.is_admin());

drop policy if exists profiles_delete_admin on comercial.profiles;
create policy profiles_delete_admin on comercial.profiles
  for delete to authenticated
  using (comercial.is_admin());
