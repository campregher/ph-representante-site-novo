-- ============================================================
-- DROPSHIPPING — 039 — Schema novo, separado da representação
--
-- Substitui "Linha Própria" (comercial.produtos/linha_propria,
-- comercial.fornecedores, comercial.contas_receber, comercial.pedidos
-- tipo='drop_proprio'). Schema próprio chamado `dropshipping` — NÃO
-- pode se chamar `drop`, é palavra reservada do SQL.
--
-- Identidade do seller continua em comercial.clientes (is_seller,
-- tipo_pessoa, auth_user_id, portal_token) — não duplicamos login.
-- comercial.cliente_ml_tokens (OAuth do ML) também continua onde está.
-- ============================================================

create schema if not exists dropshipping;

grant usage on schema dropshipping to authenticated, service_role;
alter default privileges in schema dropshipping
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema dropshipping
  grant all on tables to service_role;
alter default privileges in schema dropshipping
  grant usage, select on sequences to authenticated, service_role;

-- ------------------------------------------------------------
-- FORNECEDORES
-- ------------------------------------------------------------
create table if not exists dropshipping.fornecedores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  razao_social  text,
  cnpj          text,
  telefone      text,
  whatsapp      text,
  email         text,
  observacoes   text,
  ativo         boolean not null default true,
  created_by    uuid references comercial.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create unique index if not exists dropshipping_fornecedores_cnpj_uidx
  on dropshipping.fornecedores (cnpj) where cnpj is not null;

drop trigger if exists fornecedores_updated_at on dropshipping.fornecedores;
create trigger fornecedores_updated_at before update on dropshipping.fornecedores
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- TABELAS DE PREÇO (seed: CPF e CNPJ)
-- ------------------------------------------------------------
create table if not exists dropshipping.tabelas_preco (
  id          uuid primary key default gen_random_uuid(),
  codigo      text not null unique,    -- 'cpf' | 'cnpj' (ou outras no futuro)
  nome        text not null,
  descricao   text,
  created_at  timestamptz not null default now()
);

insert into dropshipping.tabelas_preco (codigo, nome, descricao) values
  ('cpf',  'CPF',  'Pessoa física — compra direto da PH. "Custo" aqui já é o preço de compra da PH (margem da PH embutida).'),
  ('cnpj', 'CNPJ', 'Pessoa jurídica — preço melhor. "Custo" aqui é o custo real de fábrica; paga o fornecedor diretamente.')
on conflict (codigo) do nothing;

-- ------------------------------------------------------------
-- PRODUTOS (catálogo próprio do dropshipping)
-- ------------------------------------------------------------
create table if not exists dropshipping.produtos (
  id              uuid primary key default gen_random_uuid(),
  fornecedor_id   uuid references dropshipping.fornecedores(id) on delete set null,
  sku             text not null,
  nome            text not null,
  descricao       text,
  imagem_url      text,
  estoque_atual   integer not null default 0,
  estoque_minimo  integer not null default 0,
  ativo           boolean not null default true,
  created_by      uuid references comercial.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index if not exists dropshipping_produtos_sku_uidx
  on dropshipping.produtos (lower(sku));
create index if not exists dropshipping_produtos_fornecedor_idx
  on dropshipping.produtos (fornecedor_id);

drop trigger if exists produtos_updated_at on dropshipping.produtos;
create trigger produtos_updated_at before update on dropshipping.produtos
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- PREÇOS POR TABELA (produto x tabela: custo + preço sugerido)
-- ------------------------------------------------------------
create table if not exists dropshipping.produto_precos (
  id               uuid primary key default gen_random_uuid(),
  produto_id       uuid not null references dropshipping.produtos(id) on delete cascade,
  tabela_preco_id  uuid not null references dropshipping.tabelas_preco(id) on delete cascade,
  custo            numeric(12,2) not null default 0,
  preco_sugerido   numeric(12,2),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (produto_id, tabela_preco_id)
);

drop trigger if exists produto_precos_updated_at on dropshipping.produto_precos;
create trigger produto_precos_updated_at before update on dropshipping.produto_precos
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- ANÚNCIOS DO SELLER NO MERCADO LIVRE
-- ------------------------------------------------------------
create table if not exists dropshipping.seller_ml_anuncios (
  id            uuid primary key default gen_random_uuid(),
  cliente_id    uuid not null references comercial.clientes(id) on delete cascade,
  produto_id    uuid not null references dropshipping.produtos(id) on delete cascade,
  ml_conta_id   uuid references comercial.cliente_ml_tokens(id) on delete set null,
  ml_item_id    text not null unique,
  ml_status     text not null default 'active',
  ml_permalink  text,
  preco_revenda numeric(12,2) not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (cliente_id, produto_id, ml_conta_id)
);

create index if not exists dropshipping_anuncios_cliente_idx
  on dropshipping.seller_ml_anuncios (cliente_id);

drop trigger if exists seller_ml_anuncios_updated_at on dropshipping.seller_ml_anuncios;
create trigger seller_ml_anuncios_updated_at before update on dropshipping.seller_ml_anuncios
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- PEDIDOS (venda do seller no ML → pedido automático)
-- ------------------------------------------------------------
create sequence if not exists dropshipping.pedido_numero_seq start 1;

create table if not exists dropshipping.pedidos (
  id                  uuid primary key default gen_random_uuid(),
  numero              bigint not null default nextval('dropshipping.pedido_numero_seq'),
  cliente_id          uuid not null references comercial.clientes(id) on delete restrict,
  canal               text,                       -- 'Mercado Livre' | 'Shopee' | ...
  pedido_externo      text,                       -- id do pedido no marketplace
  status              text not null default 'aguardando_pagamento'
                      check (status in ('aguardando_pagamento','confirmado','enviado','entregue','cancelado')),
  valor_total         numeric(12,2) not null default 0,
  ml_frete            numeric(12,2),
  forma_pagamento     text,
  entrega_nome        text,
  entrega_documento   text,
  entrega_telefone    text,
  entrega_cep         text,
  entrega_logradouro  text,
  entrega_numero      text,
  entrega_complemento text,
  entrega_bairro      text,
  entrega_cidade      text,
  entrega_uf          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (cliente_id, canal, pedido_externo)
);

create index if not exists dropshipping_pedidos_cliente_idx on dropshipping.pedidos (cliente_id);
create index if not exists dropshipping_pedidos_status_idx  on dropshipping.pedidos (status);

drop trigger if exists pedidos_updated_at on dropshipping.pedidos;
create trigger pedidos_updated_at before update on dropshipping.pedidos
  for each row execute function comercial.set_updated_at();

create table if not exists dropshipping.pedido_itens (
  id                 uuid primary key default gen_random_uuid(),
  pedido_id          uuid not null references dropshipping.pedidos(id) on delete cascade,
  produto_id         uuid references dropshipping.produtos(id) on delete set null,
  descricao_snapshot text,
  quantidade         integer not null check (quantidade > 0),
  custo_unitario     numeric(12,2) not null default 0,
  ml_preco_venda     numeric(12,2),
  ml_comissao        numeric(12,2),
  created_at         timestamptz not null default now()
);

create index if not exists dropshipping_pedido_itens_pedido_idx on dropshipping.pedido_itens (pedido_id);

-- ------------------------------------------------------------
-- COBRANÇAS (Pix via Asaas — só pedidos de cliente CPF passam por aqui)
-- ------------------------------------------------------------
create table if not exists dropshipping.cobrancas (
  id                uuid primary key default gen_random_uuid(),
  pedido_id         uuid not null references dropshipping.pedidos(id) on delete cascade,
  cliente_id        uuid not null references comercial.clientes(id) on delete restrict,
  valor             numeric(12,2) not null default 0,
  asaas_payment_id  text unique,
  asaas_invoice_url text,
  asaas_status      text,
  status            text not null default 'pendente'
                    check (status in ('pendente','pago','vencido','cancelado')),
  pago_em           timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists dropshipping_cobrancas_pedido_idx  on dropshipping.cobrancas (pedido_id);
create index if not exists dropshipping_cobrancas_cliente_idx on dropshipping.cobrancas (cliente_id);

drop trigger if exists cobrancas_updated_at on dropshipping.cobrancas;
create trigger cobrancas_updated_at before update on dropshipping.cobrancas
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- RLS — leitura: quem tem acesso ao /sistema; escrita: admin/gerente.
-- Reaproveita comercial.has_access()/can_manage() (funções de role,
-- não dado de representação). Páginas do portal do seller usam o
-- client admin (service_role), igual o resto do portal hoje — não
-- dependem de RLS aqui.
-- ------------------------------------------------------------
alter table dropshipping.fornecedores        enable row level security;
alter table dropshipping.tabelas_preco        enable row level security;
alter table dropshipping.produtos             enable row level security;
alter table dropshipping.produto_precos       enable row level security;
alter table dropshipping.seller_ml_anuncios   enable row level security;
alter table dropshipping.pedidos              enable row level security;
alter table dropshipping.pedido_itens         enable row level security;
alter table dropshipping.cobrancas            enable row level security;

drop policy if exists forn_sel on dropshipping.fornecedores;
create policy forn_sel on dropshipping.fornecedores for select to authenticated using (comercial.has_access());
drop policy if exists forn_wr on dropshipping.fornecedores;
create policy forn_wr on dropshipping.fornecedores for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists tabelas_sel on dropshipping.tabelas_preco;
create policy tabelas_sel on dropshipping.tabelas_preco for select to authenticated using (comercial.has_access());
drop policy if exists tabelas_wr on dropshipping.tabelas_preco;
create policy tabelas_wr on dropshipping.tabelas_preco for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists produtos_sel on dropshipping.produtos;
create policy produtos_sel on dropshipping.produtos for select to authenticated using (comercial.has_access());
drop policy if exists produtos_wr on dropshipping.produtos;
create policy produtos_wr on dropshipping.produtos for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists precos_sel on dropshipping.produto_precos;
create policy precos_sel on dropshipping.produto_precos for select to authenticated using (comercial.has_access());
drop policy if exists precos_wr on dropshipping.produto_precos;
create policy precos_wr on dropshipping.produto_precos for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists anuncios_sel on dropshipping.seller_ml_anuncios;
create policy anuncios_sel on dropshipping.seller_ml_anuncios for select to authenticated using (comercial.has_access());
drop policy if exists anuncios_wr on dropshipping.seller_ml_anuncios;
create policy anuncios_wr on dropshipping.seller_ml_anuncios for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists dpedidos_sel on dropshipping.pedidos;
create policy dpedidos_sel on dropshipping.pedidos for select to authenticated using (comercial.has_access());
drop policy if exists dpedidos_wr on dropshipping.pedidos;
create policy dpedidos_wr on dropshipping.pedidos for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists ditens_sel on dropshipping.pedido_itens;
create policy ditens_sel on dropshipping.pedido_itens for select to authenticated using (comercial.has_access());
drop policy if exists ditens_wr on dropshipping.pedido_itens;
create policy ditens_wr on dropshipping.pedido_itens for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists cobrancas_sel on dropshipping.cobrancas;
create policy cobrancas_sel on dropshipping.cobrancas for select to authenticated using (comercial.can_finance());
drop policy if exists cobrancas_wr on dropshipping.cobrancas;
create policy cobrancas_wr on dropshipping.cobrancas for all to authenticated
  using (comercial.can_finance()) with check (comercial.can_finance());
