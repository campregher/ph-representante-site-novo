-- ============================================================
-- SISTEMA COMERCIAL — 024 — Linha Própria (estoque físico + drop p/ sellers)
--
-- Negócio à parte das representadas: a PH compra produtos de
-- fornecedores, estoca fisicamente e vende no dropshipping para
-- SELLERS cadastrados. Controles: compra/estoque, pedido drop,
-- faturamento e cobrança (contas a receber).
--
-- Aditivo e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- FORNECEDORES
-- ------------------------------------------------------------
create table if not exists comercial.fornecedores (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  razao_social  text,
  cnpj          text,
  telefone      text,
  whatsapp      text,
  email         text,
  site          text,
  cep           text,
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text,
  estado        text,
  observacoes   text,
  ativo         boolean not null default true,
  created_by    uuid references comercial.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists fornecedores_cnpj_uidx on comercial.fornecedores (cnpj) where cnpj is not null;

drop trigger if exists fornecedores_updated_at on comercial.fornecedores;
create trigger fornecedores_updated_at before update on comercial.fornecedores
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- PRODUTOS — linha própria + estoque
-- ------------------------------------------------------------
alter table comercial.produtos alter column representada_id drop not null;

alter table comercial.produtos
  add column if not exists linha_propria   boolean not null default false,
  add column if not exists fornecedor_id   uuid references comercial.fornecedores(id) on delete set null,
  add column if not exists custo            numeric(12,2),        -- custo médio
  add column if not exists estoque_atual    integer not null default 0,
  add column if not exists estoque_minimo   integer not null default 0;

-- SKU único também para a linha própria (representada_id é null nesses)
create unique index if not exists produtos_propria_sku_uidx
  on comercial.produtos (lower(sku)) where linha_propria;

-- ------------------------------------------------------------
-- COMPRAS (entrada de estoque)
-- ------------------------------------------------------------
create table if not exists comercial.compras (
  id             uuid primary key default gen_random_uuid(),
  fornecedor_id  uuid references comercial.fornecedores(id) on delete set null,
  numero_nota    text,
  data_compra    date not null default current_date,
  frete          numeric(12,2) not null default 0,
  outras_despesas numeric(12,2) not null default 0,
  valor_total    numeric(12,2) not null default 0,
  status         text not null default 'recebida' check (status in ('rascunho','recebida','cancelada')),
  observacoes    text,
  created_by     uuid references comercial.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists compras_fornecedor_idx on comercial.compras (fornecedor_id);
create index if not exists compras_data_idx on comercial.compras (data_compra desc);

drop trigger if exists compras_updated_at on comercial.compras;
create trigger compras_updated_at before update on comercial.compras
  for each row execute function comercial.set_updated_at();

create table if not exists comercial.compra_itens (
  id             uuid primary key default gen_random_uuid(),
  compra_id      uuid not null references comercial.compras(id) on delete cascade,
  produto_id     uuid references comercial.produtos(id) on delete set null,
  descricao      text,
  quantidade     integer not null check (quantidade > 0),
  custo_unitario numeric(12,2) not null default 0,
  subtotal       numeric(12,2) not null default 0,
  created_at     timestamptz not null default now()
);
create index if not exists compra_itens_compra_idx on comercial.compra_itens (compra_id);
create index if not exists compra_itens_produto_idx on comercial.compra_itens (produto_id);

-- ------------------------------------------------------------
-- MOVIMENTOS DE ESTOQUE (extrato)
-- ------------------------------------------------------------
create table if not exists comercial.estoque_movimentos (
  id           uuid primary key default gen_random_uuid(),
  produto_id   uuid not null references comercial.produtos(id) on delete cascade,
  tipo         text not null check (tipo in ('entrada','saida','ajuste')),
  quantidade   integer not null,                 -- + entrada, - saída (ajuste pode ser +/-)
  saldo_apos   integer not null,
  origem_tipo  text,                             -- 'compra' | 'pedido' | 'ajuste'
  origem_id    uuid,
  observacao   text,
  created_by   uuid references comercial.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists estoque_mov_produto_idx on comercial.estoque_movimentos (produto_id, created_at desc);
create index if not exists estoque_mov_origem_idx on comercial.estoque_movimentos (origem_tipo, origem_id);

-- ------------------------------------------------------------
-- PEDIDOS — tipo + entrega do consumidor (drop)
-- ------------------------------------------------------------
alter table comercial.pedidos alter column representada_id drop not null;

alter table comercial.pedidos
  add column if not exists tipo            text not null default 'representacao'
                           check (tipo in ('representacao','drop_proprio')),
  add column if not exists canal           text,
  add column if not exists pedido_externo  text,
  add column if not exists entrega_nome        text,
  add column if not exists entrega_documento   text,
  add column if not exists entrega_telefone    text,
  add column if not exists entrega_cep         text,
  add column if not exists entrega_logradouro  text,
  add column if not exists entrega_numero      text,
  add column if not exists entrega_complemento text,
  add column if not exists entrega_bairro      text,
  add column if not exists entrega_cidade      text,
  add column if not exists entrega_uf          text;

alter table comercial.pedido_itens
  add column if not exists custo_unitario numeric(12,2) not null default 0;

-- Triggers de consistência de representada: pular quando o pedido não tem representada
create or replace function comercial.check_pedido_item_representada()
returns trigger language plpgsql security definer set search_path = comercial, public as $$
declare v_ped_rep uuid; v_prod_rep uuid;
begin
  select representada_id into v_ped_rep from comercial.pedidos where id = new.pedido_id;
  if v_ped_rep is null then return new; end if;               -- pedido drop / sem representada
  if new.produto_id is not null then
    select representada_id into v_prod_rep from comercial.produtos where id = new.produto_id;
    if v_prod_rep is distinct from v_ped_rep then
      raise exception 'Produto pertence a outra representada (pedido=%, produto=%)', v_ped_rep, v_prod_rep;
    end if;
  end if;
  return new;
end; $$;

-- ------------------------------------------------------------
-- CLIENTES — flag de seller (revendedor da linha própria)
-- ------------------------------------------------------------
alter table comercial.clientes
  add column if not exists is_seller boolean not null default false;

-- ------------------------------------------------------------
-- CONTAS A RECEBER (cobrança)
-- ------------------------------------------------------------
create table if not exists comercial.contas_receber (
  id            uuid primary key default gen_random_uuid(),
  pedido_id     uuid references comercial.pedidos(id) on delete set null,
  cliente_id    uuid references comercial.clientes(id) on delete set null,
  descricao     text not null,
  valor         numeric(12,2) not null default 0,
  vencimento    date,
  forma         text,                            -- 'pix' | 'boleto' | 'dinheiro' | 'cartao' | 'transferencia' | 'outro'
  status        text not null default 'aberto'
                check (status in ('aberto','pago','vencido','cancelado')),
  valor_pago    numeric(12,2),
  pago_em       date,
  observacoes   text,
  created_by    uuid references comercial.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists cr_cliente_idx on comercial.contas_receber (cliente_id);
create index if not exists cr_pedido_idx  on comercial.contas_receber (pedido_id);
create index if not exists cr_status_idx  on comercial.contas_receber (status, vencimento);

drop trigger if exists cr_updated_at on comercial.contas_receber;
create trigger cr_updated_at before update on comercial.contas_receber
  for each row execute function comercial.set_updated_at();

-- ------------------------------------------------------------
-- pedido_faturamento — nº/série da fatura da linha própria
-- ------------------------------------------------------------
alter table comercial.pedido_faturamento
  add column if not exists serie text;

create sequence if not exists comercial.fatura_numero_seq start 1;

-- ------------------------------------------------------------
-- RLS
-- ------------------------------------------------------------
alter table comercial.fornecedores        enable row level security;
alter table comercial.compras             enable row level security;
alter table comercial.compra_itens        enable row level security;
alter table comercial.estoque_movimentos  enable row level security;
alter table comercial.contas_receber      enable row level security;

-- fornecedores: leitura has_access; escrita can_manage
drop policy if exists forn_sel on comercial.fornecedores;
create policy forn_sel on comercial.fornecedores for select to authenticated using (comercial.has_access());
drop policy if exists forn_wr on comercial.fornecedores;
create policy forn_wr on comercial.fornecedores for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

-- compras / itens: leitura has_access; escrita can_manage
drop policy if exists compras_sel on comercial.compras;
create policy compras_sel on comercial.compras for select to authenticated using (comercial.has_access());
drop policy if exists compras_wr on comercial.compras;
create policy compras_wr on comercial.compras for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

drop policy if exists compra_itens_sel on comercial.compra_itens;
create policy compra_itens_sel on comercial.compra_itens for select to authenticated using (comercial.has_access());
drop policy if exists compra_itens_wr on comercial.compra_itens;
create policy compra_itens_wr on comercial.compra_itens for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());

-- movimentos: leitura has_access; inserção can_manage (normalmente via server)
drop policy if exists estq_mov_sel on comercial.estoque_movimentos;
create policy estq_mov_sel on comercial.estoque_movimentos for select to authenticated using (comercial.has_access());
drop policy if exists estq_mov_ins on comercial.estoque_movimentos;
create policy estq_mov_ins on comercial.estoque_movimentos for insert to authenticated with check (comercial.can_manage());

-- contas a receber: leitura can_finance/consulta; escrita admin/financeiro/gerente
drop policy if exists cr_sel on comercial.contas_receber;
create policy cr_sel on comercial.contas_receber for select to authenticated
  using (comercial.can_finance() or comercial.my_role() = 'consulta');
drop policy if exists cr_wr on comercial.contas_receber;
create policy cr_wr on comercial.contas_receber for all to authenticated
  using (comercial.can_finance()) with check (comercial.can_finance());
