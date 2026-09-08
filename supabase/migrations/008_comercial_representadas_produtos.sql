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
