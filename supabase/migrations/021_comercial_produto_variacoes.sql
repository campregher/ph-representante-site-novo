-- ============================================================
-- SISTEMA COMERCIAL — 021 — Variações de produto
--
-- Um produto pode ter variações (ex.: "Apoio de braço HB20" com
-- eixos "Estofado" e "Costura"). Cada variação é uma linha filha
-- em comercial.produto_variacoes, com SKU próprio, atributos, e
-- preço opcional (nulo = herda o preço bruto do produto pai).
--
-- O item do pedido passa a referenciar a variação escolhida
-- (pedido_itens.variacao_id). O snapshot de SKU/descrição continua
-- sendo a fonte para PDF / link / relatórios — sem mudança lá.
--
-- Aditivo e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- PRODUTO PAI: flag + eixos das variações
-- ------------------------------------------------------------
alter table comercial.produtos
  add column if not exists tem_variacoes  boolean not null default false,
  add column if not exists variacao_eixos jsonb   not null default '[]'::jsonb;

comment on column comercial.produtos.tem_variacoes is
  'quando true, o produto é vendido por variações (comercial.produto_variacoes)';
comment on column comercial.produtos.variacao_eixos is
  'eixos das variações: [{"nome":"Estofado","valores":["Couro","Tecido"]}, ...]';

-- ------------------------------------------------------------
-- PRODUTO_VARIACOES
-- ------------------------------------------------------------
create table if not exists comercial.produto_variacoes (
  id              uuid primary key default gen_random_uuid(),
  produto_id      uuid not null references comercial.produtos(id) on delete cascade,
  sku             text not null,
  atributos       jsonb not null default '{}'::jsonb,   -- {"Estofado":"Couro","Costura":"Dupla vermelha"}
  preco_bruto     numeric(12,2),                        -- nulo = herda do produto pai
  codigo_fabrica  text,
  ean             text,
  imagem_url      text,
  peso            numeric(12,3),
  ativo           boolean not null default true,
  ordem           integer not null default 0,
  observacoes     text,
  created_by      uuid references comercial.profiles(id) on delete set null,
  updated_by      uuid references comercial.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on column comercial.produto_variacoes.preco_bruto is
  'preço bruto da variação — quando nulo, usa o preço bruto do produto pai';

-- SKU único por produto pai
create unique index if not exists produto_variacoes_sku_uidx
  on comercial.produto_variacoes (produto_id, lower(sku));

create index if not exists produto_variacoes_produto_idx
  on comercial.produto_variacoes (produto_id);

drop trigger if exists produto_variacoes_updated_at on comercial.produto_variacoes;
create trigger produto_variacoes_updated_at
  before update on comercial.produto_variacoes
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- PEDIDO_ITENS: variação escolhida
-- ------------------------------------------------------------
alter table comercial.pedido_itens
  add column if not exists variacao_id uuid
    references comercial.produto_variacoes(id) on delete set null;

create index if not exists pedido_itens_variacao_idx
  on comercial.pedido_itens (variacao_id);

-- ------------------------------------------------------------
-- RLS — mesma política dos demais cadastros (ver 013)
--   select  → comercial.has_access()
--   ins/upd/del → comercial.can_manage()
-- ------------------------------------------------------------
alter table comercial.produto_variacoes enable row level security;

drop policy if exists produto_variacoes_sel on comercial.produto_variacoes;
create policy produto_variacoes_sel on comercial.produto_variacoes
  for select to authenticated using (comercial.has_access());

drop policy if exists produto_variacoes_ins on comercial.produto_variacoes;
create policy produto_variacoes_ins on comercial.produto_variacoes
  for insert to authenticated with check (comercial.can_manage());

drop policy if exists produto_variacoes_upd on comercial.produto_variacoes;
create policy produto_variacoes_upd on comercial.produto_variacoes
  for update to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists produto_variacoes_del on comercial.produto_variacoes;
create policy produto_variacoes_del on comercial.produto_variacoes
  for delete to authenticated using (comercial.can_manage());
