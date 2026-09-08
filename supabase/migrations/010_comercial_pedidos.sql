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
