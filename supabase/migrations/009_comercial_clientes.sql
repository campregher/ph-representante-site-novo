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
