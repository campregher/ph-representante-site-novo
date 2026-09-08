-- ============================================================
-- SISTEMA COMERCIAL — SETUP COMPLETO (migrations 007..020)
-- Rode este arquivo inteiro no Supabase → SQL Editor → Run. Idempotente.
-- Depois: Project Settings → API → Exposed schemas → add 'comercial'
-- ============================================================

-- >>>>>>>>>>  migrations/007_comercial_init.sql

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


-- >>>>>>>>>>  migrations/008_comercial_representadas_produtos.sql

-- ============================================================
-- SISTEMA COMERCIAL — 008 — Representadas, Categorias, Produtos,
--                            Tabelas de Preço e Preços
-- ============================================================

-- ------------------------------------------------------------
-- REPRESENTADAS
-- ------------------------------------------------------------
create table if not exists comercial.representadas (
  id                          uuid primary key default gen_random_uuid(),
  razao_social                text not null,
  nome_fantasia               text,
  cnpj                        text,
  inscricao_estadual          text,
  telefone                    text,
  whatsapp                    text,
  email                       text,
  site                        text,
  contato_comercial           text,
  contato_financeiro          text,
  pedido_minimo               numeric(12,2) default 0,
  percentual_comissao_padrao  numeric(6,3)  default 0,
  desconto_maximo_padrao      numeric(6,3)  default 0,
  prazo_pagamento_padrao      text,
  prazo_entrega               text,
  logo_url                    text,
  observacoes                 text,
  ativa                       boolean not null default true,
  created_by                  uuid references comercial.profiles(id) on delete set null,
  updated_by                  uuid references comercial.profiles(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- CNPJ único quando informado
create unique index if not exists representadas_cnpj_uidx
  on comercial.representadas (cnpj) where cnpj is not null;

drop trigger if exists representadas_updated_at on comercial.representadas;
create trigger representadas_updated_at
  before update on comercial.representadas
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- CATEGORIAS DE PRODUTO  (pertencem a uma representada)
-- ------------------------------------------------------------
create table if not exists comercial.categorias_produtos (
  id              uuid primary key default gen_random_uuid(),
  representada_id uuid not null references comercial.representadas(id) on delete cascade,
  nome            text not null,
  descricao       text,
  ativa           boolean not null default true,
  created_at      timestamptz not null default now()
);

create index if not exists categorias_representada_idx
  on comercial.categorias_produtos (representada_id);

-- ------------------------------------------------------------
-- PRODUTOS  (sempre pertencem a UMA representada)
-- ------------------------------------------------------------
create table if not exists comercial.produtos (
  id              uuid primary key default gen_random_uuid(),
  representada_id uuid not null references comercial.representadas(id) on delete cascade,
  categoria_id    uuid references comercial.categorias_produtos(id) on delete set null,
  sku             text not null,
  codigo_fabrica  text,
  ean             text,
  ncm             text,
  nome            text not null,
  descricao       text,
  marca           text,
  aplicacao       text,
  montadora       text,
  modelo          text,
  ano_inicio      integer,
  ano_fim         integer,
  unidade         text default 'UN',
  peso            numeric(12,3),
  imagem_url      text,
  ativo           boolean not null default true,
  observacoes     text,
  created_by      uuid references comercial.profiles(id) on delete set null,
  updated_by      uuid references comercial.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- SKU único por representada
create unique index if not exists produtos_representada_sku_uidx
  on comercial.produtos (representada_id, lower(sku));

drop trigger if exists produtos_updated_at on comercial.produtos;
create trigger produtos_updated_at
  before update on comercial.produtos
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- TABELAS DE PREÇO  (uma representada tem várias)
-- ------------------------------------------------------------
create table if not exists comercial.tabelas_preco (
  id              uuid primary key default gen_random_uuid(),
  representada_id uuid not null references comercial.representadas(id) on delete cascade,
  nome            text not null,
  descricao       text,
  tipo            text,   -- loja | distribuidor | seller | especial | promocional | ...
  data_inicio     date,
  data_fim        date,
  ativa           boolean not null default true,
  created_by      uuid references comercial.profiles(id) on delete set null,
  updated_by      uuid references comercial.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tabelas_preco_representada_idx
  on comercial.tabelas_preco (representada_id);

drop trigger if exists tabelas_preco_updated_at on comercial.tabelas_preco;
create trigger tabelas_preco_updated_at
  before update on comercial.tabelas_preco
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- PREÇOS DOS PRODUTOS  (produto x tabela)
-- ------------------------------------------------------------
create table if not exists comercial.produtos_precos (
  id               uuid primary key default gen_random_uuid(),
  produto_id       uuid not null references comercial.produtos(id) on delete cascade,
  tabela_preco_id  uuid not null references comercial.tabelas_preco(id) on delete cascade,
  preco            numeric(12,2) not null default 0,
  preco_minimo     numeric(12,2),
  desconto_maximo  numeric(6,3) default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (produto_id, tabela_preco_id)
);

drop trigger if exists produtos_precos_updated_at on comercial.produtos_precos;
create trigger produtos_precos_updated_at
  before update on comercial.produtos_precos
  for each row execute function comercial.set_updated_at();

-- Histórico de alterações de preço (auditoria simples)
create table if not exists comercial.produtos_precos_historico (
  id               uuid primary key default gen_random_uuid(),
  produto_id       uuid not null,
  tabela_preco_id  uuid not null,
  preco_anterior   numeric(12,2),
  preco_novo       numeric(12,2),
  usuario_id       uuid references comercial.profiles(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists precos_hist_produto_idx
  on comercial.produtos_precos_historico (produto_id, tabela_preco_id, created_at desc);

create or replace function comercial.log_preco_change()
returns trigger
language plpgsql
security definer
set search_path = comercial, public
as $$
begin
  if tg_op = 'UPDATE' and new.preco is distinct from old.preco then
    insert into comercial.produtos_precos_historico
      (produto_id, tabela_preco_id, preco_anterior, preco_novo, usuario_id)
    values (new.produto_id, new.tabela_preco_id, old.preco, new.preco, auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists produtos_precos_log on comercial.produtos_precos;
create trigger produtos_precos_log
  after update on comercial.produtos_precos
  for each row execute function comercial.log_preco_change();


-- >>>>>>>>>>  migrations/009_comercial_clientes.sql

-- ============================================================
-- SISTEMA COMERCIAL — 009 — Clientes, Contatos e vínculo
--                            Cliente x Representada
-- ============================================================

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
create table if not exists comercial.clientes (
  id                  uuid primary key default gen_random_uuid(),
  tipo_pessoa         text not null default 'juridica'
                      check (tipo_pessoa in ('juridica','fisica')),
  cnpj                text,
  cpf                 text,
  razao_social        text,
  nome_fantasia       text,
  inscricao_estadual  text,
  telefone            text,
  whatsapp            text,
  email               text,
  site                text,
  cep                 text,
  logradouro          text,
  numero              text,
  complemento         text,
  bairro              text,
  cidade              text,
  estado              varchar(2),
  vendedor_id         uuid references comercial.profiles(id) on delete set null,
  limite_credito      numeric(12,2) default 0,
  status              text not null default 'prospect'
                      check (status in ('prospect','ativo','inativo','bloqueado','reativacao')),
  data_ultima_compra  date,
  observacoes         text,
  created_by          uuid references comercial.profiles(id) on delete set null,
  updated_by          uuid references comercial.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index if not exists clientes_cnpj_uidx
  on comercial.clientes (cnpj) where cnpj is not null;
create unique index if not exists clientes_cpf_uidx
  on comercial.clientes (cpf) where cpf is not null;

drop trigger if exists clientes_updated_at on comercial.clientes;
create trigger clientes_updated_at
  before update on comercial.clientes
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- CONTATOS DO CLIENTE
-- ------------------------------------------------------------
create table if not exists comercial.cliente_contatos (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references comercial.clientes(id) on delete cascade,
  nome        text not null,
  cargo       text,
  telefone    text,
  whatsapp    text,
  email       text,
  principal   boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists cliente_contatos_cliente_idx
  on comercial.cliente_contatos (cliente_id);

-- ------------------------------------------------------------
-- CLIENTE x REPRESENTADA  (condições comerciais por relação)
-- ------------------------------------------------------------
create table if not exists comercial.cliente_representada (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references comercial.clientes(id) on delete cascade,
  representada_id     uuid not null references comercial.representadas(id) on delete cascade,
  tabela_preco_id     uuid references comercial.tabelas_preco(id) on delete set null,
  condicao_pagamento  text,
  desconto_padrao     numeric(6,3) default 0,
  limite_credito      numeric(12,2) default 0,
  observacoes         text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (cliente_id, representada_id)
);

create index if not exists cliente_representada_cliente_idx
  on comercial.cliente_representada (cliente_id);
create index if not exists cliente_representada_representada_idx
  on comercial.cliente_representada (representada_id);

drop trigger if exists cliente_representada_updated_at on comercial.cliente_representada;
create trigger cliente_representada_updated_at
  before update on comercial.cliente_representada
  for each row execute function comercial.set_updated_at();


-- >>>>>>>>>>  migrations/010_comercial_pedidos.sql

-- ============================================================
-- SISTEMA COMERCIAL — 010 — Pedidos, Itens, Histórico, Faturamento
--
-- REGRA FUNDAMENTAL: um pedido pertence a UMA representada.
-- Não é permitido item de produto de outra representada, nem
-- tabela de preço de outra representada, no mesmo pedido.
-- (garantido por trigger abaixo)
-- ============================================================

create sequence if not exists comercial.pedido_numero_seq start 1001;

create table if not exists comercial.pedidos (
  id                        uuid primary key default gen_random_uuid(),
  numero                    bigint not null default nextval('comercial.pedido_numero_seq'),
  cliente_id                uuid not null references comercial.clientes(id) on delete restrict,
  representada_id            uuid not null references comercial.representadas(id) on delete restrict,
  tabela_preco_id           uuid references comercial.tabelas_preco(id) on delete set null,
  vendedor_id               uuid references comercial.profiles(id) on delete set null,
  data_pedido               timestamptz not null default now(),
  status                    text not null default 'orcamento'
                            check (status in (
                              'orcamento','aguardando_aprovacao','enviado','confirmado',
                              'faturado','em_transporte','entregue','pendencia',
                              'cancelado','rejeitado')),
  subtotal                  numeric(12,2) not null default 0,
  desconto_percentual       numeric(6,3)  not null default 0,
  desconto_valor            numeric(12,2) not null default 0,
  valor_total               numeric(12,2) not null default 0,
  condicao_pagamento        text,
  forma_pagamento           text,
  previsao_entrega          date,
  observacao_cliente        text,
  observacao_representada    text,
  observacao_interna        text,
  numero_pedido_fabrica     text,
  created_by                uuid references comercial.profiles(id) on delete set null,
  updated_by                uuid references comercial.profiles(id) on delete set null,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (numero)
);

create index if not exists pedidos_cliente_idx      on comercial.pedidos (cliente_id);
create index if not exists pedidos_representada_idx  on comercial.pedidos (representada_id);
create index if not exists pedidos_vendedor_idx      on comercial.pedidos (vendedor_id);
create index if not exists pedidos_status_idx        on comercial.pedidos (status);
create index if not exists pedidos_data_idx          on comercial.pedidos (data_pedido);

drop trigger if exists pedidos_updated_at on comercial.pedidos;
create trigger pedidos_updated_at
  before update on comercial.pedidos
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- ITENS DO PEDIDO  (com snapshot de SKU/descrição/preço)
-- ------------------------------------------------------------
create table if not exists comercial.pedido_itens (
  id                        uuid primary key default gen_random_uuid(),
  pedido_id                 uuid not null references comercial.pedidos(id) on delete cascade,
  produto_id                uuid references comercial.produtos(id) on delete set null,
  sku_snapshot              text,
  descricao_snapshot        text,
  quantidade                numeric(12,3) not null default 1 check (quantidade > 0),
  preco_tabela              numeric(12,2) not null default 0,
  desconto_item_percentual  numeric(6,3)  not null default 0,
  desconto_item_valor       numeric(12,2) not null default 0,
  preco_unitario_final      numeric(12,2) not null default 0,
  valor_total               numeric(12,2) not null default 0,
  created_at                timestamptz not null default now()
);

create index if not exists pedido_itens_pedido_idx on comercial.pedido_itens (pedido_id);

-- Impede misturar representadas no mesmo pedido
create or replace function comercial.check_pedido_item_representada()
returns trigger
language plpgsql
security definer
set search_path = comercial, public
as $$
declare
  v_ped_rep uuid;
  v_prod_rep uuid;
begin
  select representada_id into v_ped_rep from comercial.pedidos where id = new.pedido_id;
  if new.produto_id is not null then
    select representada_id into v_prod_rep from comercial.produtos where id = new.produto_id;
    if v_prod_rep is distinct from v_ped_rep then
      raise exception 'Produto pertence a outra representada (pedido=%, produto=%)', v_ped_rep, v_prod_rep;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pedido_itens_check_rep on comercial.pedido_itens;
create trigger pedido_itens_check_rep
  before insert or update on comercial.pedido_itens
  for each row execute function comercial.check_pedido_item_representada();

-- Valida que a tabela de preço pertence à representada do pedido
create or replace function comercial.check_pedido_tabela_representada()
returns trigger
language plpgsql
security definer
set search_path = comercial, public
as $$
declare
  v_tab_rep uuid;
begin
  if new.tabela_preco_id is not null then
    select representada_id into v_tab_rep from comercial.tabelas_preco where id = new.tabela_preco_id;
    if v_tab_rep is distinct from new.representada_id then
      raise exception 'Tabela de preço pertence a outra representada';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_check_tabela on comercial.pedidos;
create trigger pedidos_check_tabela
  before insert or update on comercial.pedidos
  for each row execute function comercial.check_pedido_tabela_representada();

-- ------------------------------------------------------------
-- HISTÓRICO DE STATUS DO PEDIDO
-- ------------------------------------------------------------
create table if not exists comercial.pedido_historico (
  id              uuid primary key default gen_random_uuid(),
  pedido_id       uuid not null references comercial.pedidos(id) on delete cascade,
  status_anterior text,
  status_novo     text,
  descricao       text,
  usuario_id      uuid references comercial.profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists pedido_historico_pedido_idx
  on comercial.pedido_historico (pedido_id, created_at desc);

create or replace function comercial.log_pedido_status()
returns trigger
language plpgsql
security definer
set search_path = comercial, public
as $$
begin
  if tg_op = 'INSERT' then
    insert into comercial.pedido_historico (pedido_id, status_anterior, status_novo, descricao, usuario_id)
    values (new.id, null, new.status, 'Pedido criado', auth.uid());
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status then
    insert into comercial.pedido_historico (pedido_id, status_anterior, status_novo, descricao, usuario_id)
    values (new.id, old.status, new.status, 'Alteração de status', auth.uid());
  end if;
  return new;
end;
$$;

drop trigger if exists pedidos_log_status on comercial.pedidos;
create trigger pedidos_log_status
  after insert or update on comercial.pedidos
  for each row execute function comercial.log_pedido_status();

-- ------------------------------------------------------------
-- FATURAMENTO DO PEDIDO
-- ------------------------------------------------------------
create table if not exists comercial.pedido_faturamento (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid not null references comercial.pedidos(id) on delete cascade,
  numero_nf         text,
  data_emissao      date,
  valor_nf          numeric(12,2),
  valor_faturado    numeric(12,2),
  transportadora    text,
  codigo_rastreio   text,
  previsao_entrega  date,
  data_entrega      date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists pedido_faturamento_pedido_idx
  on comercial.pedido_faturamento (pedido_id);

drop trigger if exists pedido_faturamento_updated_at on comercial.pedido_faturamento;
create trigger pedido_faturamento_updated_at
  before update on comercial.pedido_faturamento
  for each row execute function comercial.set_updated_at();


-- >>>>>>>>>>  migrations/011_comercial_gestao.sql

-- ============================================================
-- SISTEMA COMERCIAL — 011 — Comissões, Tarefas, CRM e Metas
-- ============================================================

-- ------------------------------------------------------------
-- COMISSÕES
-- ------------------------------------------------------------
create table if not exists comercial.comissoes (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid references comercial.pedidos(id) on delete set null,
  representada_id   uuid references comercial.representadas(id) on delete set null,
  vendedor_id       uuid references comercial.profiles(id) on delete set null,
  valor_base        numeric(12,2) not null default 0,
  percentual        numeric(6,3)  not null default 0,
  valor_comissao    numeric(12,2) not null default 0,
  competencia       text,   -- 'YYYY-MM'
  data_prevista     date,
  data_recebimento  date,
  status            text not null default 'a_receber'
                    check (status in ('a_receber','recebida','divergencia')),
  observacoes       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists comissoes_pedido_idx       on comercial.comissoes (pedido_id);
create index if not exists comissoes_representada_idx  on comercial.comissoes (representada_id);
create index if not exists comissoes_vendedor_idx      on comercial.comissoes (vendedor_id);
create index if not exists comissoes_competencia_idx   on comercial.comissoes (competencia);
create index if not exists comissoes_status_idx        on comercial.comissoes (status);

drop trigger if exists comissoes_updated_at on comercial.comissoes;
create trigger comissoes_updated_at
  before update on comercial.comissoes
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- TAREFAS
-- ------------------------------------------------------------
create table if not exists comercial.tarefas (
  id              uuid primary key default gen_random_uuid(),
  titulo          text not null,
  descricao       text,
  tipo            text not null default 'outro'
                  check (tipo in ('ligacao','whatsapp','email','visita','reuniao','followup','outro')),
  cliente_id      uuid references comercial.clientes(id) on delete set null,
  pedido_id       uuid references comercial.pedidos(id) on delete set null,
  representada_id uuid references comercial.representadas(id) on delete set null,
  responsavel_id  uuid references comercial.profiles(id) on delete set null,
  data_prevista   date,
  prioridade      text not null default 'media'
                  check (prioridade in ('baixa','media','alta')),
  status          text not null default 'pendente'
                  check (status in ('pendente','em_andamento','concluida','cancelada')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists tarefas_responsavel_idx on comercial.tarefas (responsavel_id, status);
create index if not exists tarefas_cliente_idx     on comercial.tarefas (cliente_id);
create index if not exists tarefas_data_idx        on comercial.tarefas (data_prevista);

drop trigger if exists tarefas_updated_at on comercial.tarefas;
create trigger tarefas_updated_at
  before update on comercial.tarefas
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- CRM — OPORTUNIDADES
-- ------------------------------------------------------------
create table if not exists comercial.crm_oportunidades (
  id                 uuid primary key default gen_random_uuid(),
  cliente_id         uuid references comercial.clientes(id) on delete set null,
  responsavel_id     uuid references comercial.profiles(id) on delete set null,
  etapa              text not null default 'prospect'
                     check (etapa in (
                       'prospect','primeiro_contato','apresentacao','tabela_enviada',
                       'negociacao','primeiro_pedido','cliente_ativo','perdido')),
  valor_estimado     numeric(12,2) default 0,
  representada_id     uuid references comercial.representadas(id) on delete set null,
  proxima_acao       text,
  data_proxima_acao  date,
  observacoes        text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists crm_cliente_idx      on comercial.crm_oportunidades (cliente_id);
create index if not exists crm_responsavel_idx  on comercial.crm_oportunidades (responsavel_id);
create index if not exists crm_etapa_idx        on comercial.crm_oportunidades (etapa);

drop trigger if exists crm_updated_at on comercial.crm_oportunidades;
create trigger crm_updated_at
  before update on comercial.crm_oportunidades
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- METAS DE VENDAS
-- ------------------------------------------------------------
create table if not exists comercial.metas_vendas (
  id              uuid primary key default gen_random_uuid(),
  ano             integer not null,
  mes             integer not null check (mes between 1 and 12),
  vendedor_id     uuid references comercial.profiles(id) on delete cascade,
  representada_id uuid references comercial.representadas(id) on delete cascade,
  valor_meta      numeric(12,2) not null default 0,
  created_at      timestamptz not null default now()
);

-- Uma meta por combinação ano/mes/vendedor/representada (nulls tratados como "geral")
create unique index if not exists metas_vendas_uidx
  on comercial.metas_vendas (
    ano, mes,
    coalesce(vendedor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(representada_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );


-- >>>>>>>>>>  migrations/012_comercial_indexes.sql

-- ============================================================
-- SISTEMA COMERCIAL — 012 — Índices de performance / busca
-- ============================================================

create extension if not exists pg_trgm;

-- Busca textual (ilike) em clientes
create index if not exists clientes_razao_trgm
  on comercial.clientes using gin (lower(coalesce(razao_social,'')) gin_trgm_ops);
create index if not exists clientes_fantasia_trgm
  on comercial.clientes using gin (lower(coalesce(nome_fantasia,'')) gin_trgm_ops);
create index if not exists clientes_cidade_idx
  on comercial.clientes (lower(coalesce(cidade,'')));
create index if not exists clientes_vendedor_idx
  on comercial.clientes (vendedor_id);
create index if not exists clientes_status_idx
  on comercial.clientes (status);
create index if not exists clientes_ultima_compra_idx
  on comercial.clientes (data_ultima_compra);

-- Busca textual em produtos
create index if not exists produtos_nome_trgm
  on comercial.produtos using gin (lower(coalesce(nome,'')) gin_trgm_ops);
create index if not exists produtos_aplicacao_trgm
  on comercial.produtos using gin (lower(coalesce(aplicacao,'')) gin_trgm_ops);
create index if not exists produtos_sku_idx
  on comercial.produtos (lower(sku));
create index if not exists produtos_representada_idx
  on comercial.produtos (representada_id);
create index if not exists produtos_categoria_idx
  on comercial.produtos (categoria_id);
create index if not exists produtos_ativo_idx
  on comercial.produtos (ativo);

-- Preços
create index if not exists produtos_precos_produto_idx
  on comercial.produtos_precos (produto_id);
create index if not exists produtos_precos_tabela_idx
  on comercial.produtos_precos (tabela_preco_id);


-- >>>>>>>>>>  migrations/013_comercial_rls.sql

-- ============================================================
-- SISTEMA COMERCIAL — 013 — Row Level Security (RLS)
--
-- Papéis (comercial.profiles.role):
--   admin      → acesso completo
--   gerente    → cadastros + pedidos + vendas + relatórios
--   vendedor   → seus clientes / seus pedidos / suas tarefas / leitura de catálogo
--   financeiro → vendas + faturamento + comissões
--   consulta   → somente leitura
--
-- service_role (chave server-side) ignora RLS por padrão — usado
-- apenas em server actions / rotas de servidor para agregações.
-- ============================================================

-- Papel enxerga TODOS os clientes/pedidos (vendedor não)
create or replace function comercial.can_see_all_clientes()
returns boolean language sql stable as $$
  select comercial.my_role() in ('admin','gerente','financeiro','consulta')
$$;
grant execute on function comercial.can_see_all_clientes() to authenticated;

-- ------------------------------------------------------------
-- CADASTROS GERAIS  (leitura p/ todo profile ativo, escrita p/ gestão)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'representadas','categorias_produtos','produtos',
    'tabelas_preco','produtos_precos'
  ] loop
    execute format('alter table comercial.%I enable row level security;', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_sel', t);
    execute format(
      'create policy %I on comercial.%I for select to authenticated using (comercial.has_access());',
      t||'_sel', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_ins', t);
    execute format(
      'create policy %I on comercial.%I for insert to authenticated with check (comercial.can_manage());',
      t||'_ins', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_upd', t);
    execute format(
      'create policy %I on comercial.%I for update to authenticated using (comercial.can_manage()) with check (comercial.can_manage());',
      t||'_upd', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_del', t);
    execute format(
      'create policy %I on comercial.%I for delete to authenticated using (comercial.can_manage());',
      t||'_del', t);
  end loop;
end $$;

-- Histórico de preços: leitura p/ quem tem acesso, escrita só service_role/trigger
alter table comercial.produtos_precos_historico enable row level security;
drop policy if exists precos_hist_sel on comercial.produtos_precos_historico;
create policy precos_hist_sel on comercial.produtos_precos_historico
  for select to authenticated using (comercial.has_access());

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
alter table comercial.clientes enable row level security;

drop policy if exists clientes_sel on comercial.clientes;
create policy clientes_sel on comercial.clientes
  for select to authenticated
  using (comercial.can_see_all_clientes() or vendedor_id = auth.uid());

drop policy if exists clientes_ins on comercial.clientes;
create policy clientes_ins on comercial.clientes
  for insert to authenticated
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid()));

drop policy if exists clientes_upd on comercial.clientes;
create policy clientes_upd on comercial.clientes
  for update to authenticated
  using (comercial.can_manage() or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid()))
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid()));

drop policy if exists clientes_del on comercial.clientes;
create policy clientes_del on comercial.clientes
  for delete to authenticated using (comercial.can_manage());

-- ------------------------------------------------------------
-- CLIENTE_CONTATOS  /  CLIENTE_REPRESENTADA  (seguem o cliente)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cliente_contatos','cliente_representada'] loop
    execute format('alter table comercial.%I enable row level security;', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_sel', t);
    execute format($f$
      create policy %I on comercial.%I for select to authenticated
      using (exists (
        select 1 from comercial.clientes c
        where c.id = %I.cliente_id
          and (comercial.can_see_all_clientes() or c.vendedor_id = auth.uid())
      ));$f$, t||'_sel', t, t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_wr', t);
    execute format($f$
      create policy %I on comercial.%I for all to authenticated
      using (exists (
        select 1 from comercial.clientes c
        where c.id = %I.cliente_id
          and (comercial.can_manage() or (comercial.my_role() = 'vendedor' and c.vendedor_id = auth.uid()))
      ))
      with check (exists (
        select 1 from comercial.clientes c
        where c.id = %I.cliente_id
          and (comercial.can_manage() or (comercial.my_role() = 'vendedor' and c.vendedor_id = auth.uid()))
      ));$f$, t||'_wr', t, t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- PEDIDOS
-- ------------------------------------------------------------
alter table comercial.pedidos enable row level security;

drop policy if exists pedidos_sel on comercial.pedidos;
create policy pedidos_sel on comercial.pedidos
  for select to authenticated
  using (comercial.can_see_all_clientes() or vendedor_id = auth.uid() or created_by = auth.uid());

drop policy if exists pedidos_ins on comercial.pedidos;
create policy pedidos_ins on comercial.pedidos
  for insert to authenticated
  with check (comercial.my_role() in ('admin','gerente','vendedor'));

drop policy if exists pedidos_upd on comercial.pedidos;
create policy pedidos_upd on comercial.pedidos
  for update to authenticated
  using (
    comercial.can_manage()
    or (comercial.my_role() = 'vendedor'
        and (vendedor_id = auth.uid() or created_by = auth.uid())
        and status in ('orcamento','aguardando_aprovacao'))
  )
  with check (
    comercial.can_manage()
    or (comercial.my_role() = 'vendedor'
        and (vendedor_id = auth.uid() or created_by = auth.uid()))
  );

drop policy if exists pedidos_del on comercial.pedidos;
create policy pedidos_del on comercial.pedidos
  for delete to authenticated using (comercial.can_manage());

-- ------------------------------------------------------------
-- PEDIDO_ITENS  (segue o pedido)
-- ------------------------------------------------------------
alter table comercial.pedido_itens enable row level security;

drop policy if exists pedido_itens_sel on comercial.pedido_itens;
create policy pedido_itens_sel on comercial.pedido_itens
  for select to authenticated
  using (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_itens.pedido_id
      and (comercial.can_see_all_clientes() or p.vendedor_id = auth.uid() or p.created_by = auth.uid())
  ));

drop policy if exists pedido_itens_wr on comercial.pedido_itens;
create policy pedido_itens_wr on comercial.pedido_itens
  for all to authenticated
  using (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_itens.pedido_id
      and (comercial.can_manage()
           or (comercial.my_role() = 'vendedor'
               and (p.vendedor_id = auth.uid() or p.created_by = auth.uid())
               and p.status in ('orcamento','aguardando_aprovacao')))
  ))
  with check (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_itens.pedido_id
      and (comercial.can_manage()
           or (comercial.my_role() = 'vendedor'
               and (p.vendedor_id = auth.uid() or p.created_by = auth.uid())))
  ));

-- ------------------------------------------------------------
-- PEDIDO_HISTORICO  (append-only; leitura segue o pedido)
-- ------------------------------------------------------------
alter table comercial.pedido_historico enable row level security;

drop policy if exists pedido_hist_sel on comercial.pedido_historico;
create policy pedido_hist_sel on comercial.pedido_historico
  for select to authenticated
  using (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_historico.pedido_id
      and (comercial.can_see_all_clientes() or p.vendedor_id = auth.uid() or p.created_by = auth.uid())
  ));

drop policy if exists pedido_hist_ins on comercial.pedido_historico;
create policy pedido_hist_ins on comercial.pedido_historico
  for insert to authenticated with check (comercial.has_access());

-- ------------------------------------------------------------
-- PEDIDO_FATURAMENTO  (leitura ampla, escrita financeiro/gestão)
-- ------------------------------------------------------------
alter table comercial.pedido_faturamento enable row level security;

drop policy if exists pedido_fat_sel on comercial.pedido_faturamento;
create policy pedido_fat_sel on comercial.pedido_faturamento
  for select to authenticated using (comercial.has_access());

drop policy if exists pedido_fat_wr on comercial.pedido_faturamento;
create policy pedido_fat_wr on comercial.pedido_faturamento
  for all to authenticated
  using (comercial.can_finance())
  with check (comercial.can_finance());

-- ------------------------------------------------------------
-- COMISSÕES
-- ------------------------------------------------------------
alter table comercial.comissoes enable row level security;

drop policy if exists comissoes_sel on comercial.comissoes;
create policy comissoes_sel on comercial.comissoes
  for select to authenticated
  using (
    comercial.can_finance()
    or comercial.my_role() = 'consulta'
    or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists comissoes_wr on comercial.comissoes;
create policy comissoes_wr on comercial.comissoes
  for all to authenticated
  using (comercial.my_role() in ('admin','financeiro'))
  with check (comercial.my_role() in ('admin','financeiro'));

-- ------------------------------------------------------------
-- TAREFAS
-- ------------------------------------------------------------
alter table comercial.tarefas enable row level security;

drop policy if exists tarefas_sel on comercial.tarefas;
create policy tarefas_sel on comercial.tarefas
  for select to authenticated
  using (comercial.can_manage() or comercial.my_role() = 'consulta' or responsavel_id = auth.uid());

drop policy if exists tarefas_ins on comercial.tarefas;
create policy tarefas_ins on comercial.tarefas
  for insert to authenticated
  with check (comercial.has_access() and comercial.my_role() <> 'consulta');

drop policy if exists tarefas_upd on comercial.tarefas;
create policy tarefas_upd on comercial.tarefas
  for update to authenticated
  using (comercial.can_manage() or responsavel_id = auth.uid())
  with check (comercial.can_manage() or responsavel_id = auth.uid());

drop policy if exists tarefas_del on comercial.tarefas;
create policy tarefas_del on comercial.tarefas
  for delete to authenticated
  using (comercial.can_manage() or responsavel_id = auth.uid());

-- ------------------------------------------------------------
-- CRM_OPORTUNIDADES
-- ------------------------------------------------------------
alter table comercial.crm_oportunidades enable row level security;

drop policy if exists crm_sel on comercial.crm_oportunidades;
create policy crm_sel on comercial.crm_oportunidades
  for select to authenticated using (comercial.has_access());

drop policy if exists crm_ins on comercial.crm_oportunidades;
create policy crm_ins on comercial.crm_oportunidades
  for insert to authenticated
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and responsavel_id = auth.uid()));

drop policy if exists crm_upd on comercial.crm_oportunidades;
create policy crm_upd on comercial.crm_oportunidades
  for update to authenticated
  using (comercial.can_manage() or (comercial.my_role() = 'vendedor' and responsavel_id = auth.uid()))
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and responsavel_id = auth.uid()));

drop policy if exists crm_del on comercial.crm_oportunidades;
create policy crm_del on comercial.crm_oportunidades
  for delete to authenticated using (comercial.can_manage());

-- ------------------------------------------------------------
-- METAS_VENDAS
-- ------------------------------------------------------------
alter table comercial.metas_vendas enable row level security;

drop policy if exists metas_sel on comercial.metas_vendas;
create policy metas_sel on comercial.metas_vendas
  for select to authenticated using (comercial.has_access());

drop policy if exists metas_wr on comercial.metas_vendas;
create policy metas_wr on comercial.metas_vendas
  for all to authenticated
  using (comercial.can_manage())
  with check (comercial.can_manage());


-- >>>>>>>>>>  migrations/014_comercial_representada_modalidades.sql

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


-- >>>>>>>>>>  migrations/015_comercial_representada_endereco.sql

-- ============================================================
-- SISTEMA COMERCIAL — 015 — Endereço da representada
-- (para o preenchimento automático via consulta de CNPJ)
-- Aditivo e idempotente.
-- ============================================================

alter table comercial.representadas
  add column if not exists cep         text,
  add column if not exists logradouro  text,
  add column if not exists numero      text,
  add column if not exists complemento text,
  add column if not exists bairro      text,
  add column if not exists cidade      text,
  add column if not exists estado      varchar(2);


-- >>>>>>>>>>  migrations/016_comercial_storage_logos.sql

-- ============================================================
-- SISTEMA COMERCIAL — 016 — Bucket de logos (Supabase Storage)
-- Upload de logo da representada (e futuros clientes/produtos).
-- Aditivo e idempotente.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sistema-comercial',
  'sistema-comercial',
  true,
  2097152, -- 2 MB
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura pública (bucket público)
drop policy if exists "sc_bucket_read" on storage.objects;
create policy "sc_bucket_read" on storage.objects
  for select
  using (bucket_id = 'sistema-comercial');

-- Escrita apenas para usuários autenticados do sistema
drop policy if exists "sc_bucket_insert" on storage.objects;
create policy "sc_bucket_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sistema-comercial');

drop policy if exists "sc_bucket_update" on storage.objects;
create policy "sc_bucket_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'sistema-comercial')
  with check (bucket_id = 'sistema-comercial');

drop policy if exists "sc_bucket_delete" on storage.objects;
create policy "sc_bucket_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'sistema-comercial');


-- >>>>>>>>>>  migrations/017_comercial_produto_dimensoes.sql

-- ============================================================
-- SISTEMA COMERCIAL — 017 — Dimensões da embalagem do produto
-- Aditivo e idempotente. (peso e ncm já existem na 008)
-- ============================================================

alter table comercial.produtos
  add column if not exists altura      numeric(10,2),
  add column if not exists largura     numeric(10,2),
  add column if not exists comprimento numeric(10,2);

comment on column comercial.produtos.peso is 'peso da embalagem (kg)';
comment on column comercial.produtos.altura is 'altura da embalagem (cm)';
comment on column comercial.produtos.largura is 'largura da embalagem (cm)';
comment on column comercial.produtos.comprimento is 'comprimento da embalagem (cm)';


-- >>>>>>>>>>  migrations/018_comercial_preco_bruto.sql

-- ============================================================
-- SISTEMA COMERCIAL — 018 — Preço bruto + tabelas por desconto
--
-- Novo modelo de precificação:
--   • produto tem UM preço bruto (lista) — importado por planilha
--   • tabela de preço = regra de desconto (%) sobre o bruto
--   • produtos_precos passa a guardar apenas EXCEÇÕES (override do
--     preço líquido de um produto numa tabela específica)
--
-- Aditivo e idempotente.
-- ============================================================

alter table comercial.produtos
  add column if not exists preco_bruto numeric(12,2);

alter table comercial.tabelas_preco
  add column if not exists desconto_percentual numeric(6,3) not null default 0;

comment on column comercial.produtos.preco_bruto is 'preço de lista / bruto (base para as tabelas de desconto)';
comment on column comercial.tabelas_preco.desconto_percentual is 'desconto % aplicado sobre o preço bruto do produto';
comment on column comercial.produtos_precos.preco is 'override do preço líquido (exceção) — quando nulo/ausente, usa bruto - desconto da tabela';


-- >>>>>>>>>>  migrations/019_comercial_pedido_share.sql

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


-- >>>>>>>>>>  migrations/020_comercial_config.sql

-- ============================================================
-- SISTEMA COMERCIAL — 020 — Configurações da empresa (linha única)
-- Dados que aparecem nos documentos (PDF/link do pedido).
-- Editável em /sistema/configuracoes por admin.
-- ============================================================

create table if not exists comercial.config (
  id            text primary key default 'default',
  empresa_nome  text,
  whatsapp      text,
  email         text,
  cnpj          text,
  telefone      text,
  endereco      text,
  cidade        text,
  site          text,
  observacoes_padrao_pedido text,
  updated_by    uuid references comercial.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

insert into comercial.config (id, empresa_nome, whatsapp, email, cidade)
values ('default', 'PH Representante', '5511959993968', 'contato@phrepresentante.com.br', 'São Paulo, SP')
on conflict (id) do nothing;

drop trigger if exists config_updated_at on comercial.config;
create trigger config_updated_at
  before update on comercial.config
  for each row execute function comercial.set_updated_at();

alter table comercial.config enable row level security;

drop policy if exists config_read on comercial.config;
create policy config_read on comercial.config
  for select to authenticated using (comercial.has_access());

drop policy if exists config_write on comercial.config;
create policy config_write on comercial.config
  for all to authenticated
  using (comercial.is_admin())
  with check (comercial.is_admin());

