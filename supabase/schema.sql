-- ============================================================
-- PH Representante — Schema Supabase
-- Rodar no SQL Editor do Supabase (https://supabase.com/dashboard)
-- ============================================================

-- Clientes
create table if not exists public.clientes (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  cnpj            varchar(18) not null unique,
  razao_social    text not null,
  nome_fantasia   text,
  inscricao_estadual text,
  cnae_codigo     text,
  cnae_descricao  text,
  cep             varchar(9),
  logradouro      text,
  numero          text,
  complemento     text,
  bairro          text,
  cidade          text,
  estado          varchar(2),
  telefone        text,
  whatsapp        text not null,
  email           text not null,
  condicao_pagamento text check (condicao_pagamento in ('pix','boleto')),
  transportadora  text,
  status          text not null default 'pendente'
                    check (status in ('pendente','aprovado','reprovado')),
  observacao_admin text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.clientes enable row level security;

-- Políticas RLS clientes
create policy "cliente_select_own"  on public.clientes for select  using (auth.uid() = user_id);
create policy "cliente_update_own"  on public.clientes for update  using (auth.uid() = user_id);
create policy "cliente_insert_open" on public.clientes for insert  with check (true);

-- Orçamentos
create table if not exists public.orcamentos (
  id                  uuid primary key default gen_random_uuid(),
  cliente_id          uuid not null references public.clientes(id) on delete cascade,
  numero              bigint generated always as identity,
  status              text not null default 'rascunho'
                        check (status in ('rascunho','enviado','aprovado','recusado')),
  marca               text,
  condicao_pagamento  text check (condicao_pagamento in ('pix','boleto')),
  prazo_boleto        text,
  transportadora      text,
  observacoes         text,
  observacao_admin    text,
  total               numeric(12,2) default 0,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- Se a tabela já existir, rode:
-- alter table public.orcamentos add column if not exists marca text;
-- alter table public.orcamentos add column if not exists prazo_boleto text;
-- alter table public.orcamentos add column if not exists horario_postagem text;
-- Novo fluxo de status (rode para atualizar o constraint):
-- alter table public.orcamentos drop constraint if exists orcamentos_status_check;
-- alter table public.orcamentos add constraint orcamentos_status_check check (status in ('rascunho','enviado','em_separacao','a_pagar','pago','recusado'));

-- Marcas
create table if not exists public.marcas (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  segment     text,
  logo_url    text,
  cnpj        text,
  email       text,
  telefone    text,
  contato     text,
  cep         text,
  logradouro  text,
  numero      text,
  complemento text,
  bairro      text,
  cidade      text,
  estado      varchar(2),
  ativo       boolean not null default true,
  created_at  timestamptz default now()
);
-- Se a tabela já existir:
-- alter table public.marcas add column if not exists cnpj text;
-- alter table public.marcas add column if not exists email text;
-- alter table public.marcas add column if not exists telefone text;
-- alter table public.marcas add column if not exists contato text;
-- alter table public.marcas add column if not exists cep text;
-- alter table public.marcas add column if not exists logradouro text;
-- alter table public.marcas add column if not exists numero text;
-- alter table public.marcas add column if not exists complemento text;
-- alter table public.marcas add column if not exists bairro text;
-- alter table public.marcas add column if not exists cidade text;
-- alter table public.marcas add column if not exists estado varchar(2);

alter table public.marcas enable row level security;
create policy "marcas_read_all" on public.marcas for select using (true);

-- Seed das marcas existentes
insert into public.marcas (slug, name, segment, logo_url) values
  ('attis',      'ATTIS',                 'Tapetes e Proteção',       '/images/brands/attis.png'),
  ('ecoflex',    'ECOFLEX',               'Proteção contra chuva',    '/images/brands/ecoflex.png'),
  ('mega',       'MEGA AUTOMOTIVE',       'Proteção e Engate',        '/images/brands/mega.png'),
  ('sofisticar', 'SOFISTICAR AUTOMOTIVE', 'Conforto e Interior',      '/images/brands/sofisticar.png'),
  ('tevic',      'TEVIC',                 'Tapetes e Acessórios',     '/images/brands/tevic.png'),
  ('tiger',      'TIGER',                 'Acessórios Completos',     '/images/brands/tiger.png'),
  ('topmix',     'TOP MIX',               'Estética Automotiva',      '/images/brands/topmix.png'),
  ('vhip',       'VHIP ACESSÓRIOS',       'Transporte e Bagageiro',   '/images/brands/vhip.png')
on conflict (slug) do nothing;

alter table public.orcamentos enable row level security;

create policy "orcamento_select_own" on public.orcamentos for select
  using (cliente_id in (select id from public.clientes where user_id = auth.uid()));

create policy "orcamento_insert_own" on public.orcamentos for insert
  with check (cliente_id in (select id from public.clientes where user_id = auth.uid()));

create policy "orcamento_update_rascunho" on public.orcamentos for update
  using (
    cliente_id in (select id from public.clientes where user_id = auth.uid())
    and status = 'rascunho'
  );

create policy "orcamento_delete_rascunho" on public.orcamentos for delete
  using (
    cliente_id in (select id from public.clientes where user_id = auth.uid())
    and status = 'rascunho'
  );

-- Itens de orçamento
create table if not exists public.orcamento_itens (
  id              uuid primary key default gen_random_uuid(),
  orcamento_id    uuid not null references public.orcamentos(id) on delete cascade,
  produto_sku     text not null,
  produto_nome    text not null,
  quantidade      integer not null default 1 check (quantidade > 0),
  valor_unitario  numeric(12,2) not null,
  valor_total     numeric(12,2) generated always as (quantidade * valor_unitario) stored
);

alter table public.orcamento_itens enable row level security;

create policy "item_select_own" on public.orcamento_itens for select
  using (orcamento_id in (
    select o.id from public.orcamentos o
    join public.clientes c on c.id = o.cliente_id
    where c.user_id = auth.uid()
  ));

create policy "item_insert_rascunho" on public.orcamento_itens for insert
  with check (orcamento_id in (
    select o.id from public.orcamentos o
    join public.clientes c on c.id = o.cliente_id
    where c.user_id = auth.uid() and o.status = 'rascunho'
  ));

create policy "item_update_rascunho" on public.orcamento_itens for update
  using (orcamento_id in (
    select o.id from public.orcamentos o
    join public.clientes c on c.id = o.cliente_id
    where c.user_id = auth.uid() and o.status = 'rascunho'
  ));

create policy "item_delete_rascunho" on public.orcamento_itens for delete
  using (orcamento_id in (
    select o.id from public.orcamentos o
    join public.clientes c on c.id = o.cliente_id
    where c.user_id = auth.uid() and o.status = 'rascunho'
  ));

-- Trigger para atualizar updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger clientes_updated_at   before update on public.clientes   for each row execute function update_updated_at();
create trigger orcamentos_updated_at before update on public.orcamentos for each row execute function update_updated_at();

-- ============================================================
-- Migrações (rodar apenas se a tabela já existir)
-- ============================================================

-- Adicionar 'semanal' como condição de pagamento válida
-- alter table public.clientes   drop constraint if exists clientes_condicao_pagamento_check;
-- alter table public.clientes   add  constraint clientes_condicao_pagamento_check   check (condicao_pagamento in ('pix','boleto','semanal'));
-- alter table public.orcamentos drop constraint if exists orcamentos_condicao_pagamento_check;
-- alter table public.orcamentos add  constraint orcamentos_condicao_pagamento_check check (condicao_pagamento in ('pix','boleto','semanal'));

-- Tabela de cobranças semanais
-- create table if not exists public.cobrancas (
--   id           uuid primary key default gen_random_uuid(),
--   marca_slug   text not null,
--   cliente_id   uuid not null references public.clientes(id) on delete cascade,
--   semana_inicio date not null,
--   semana_fim    date not null,
--   total         numeric(12,2) not null default 0,
--   status        text not null default 'pendente'
--                   check (status in ('pendente','pago')),
--   observacoes   text,
--   created_at    timestamptz default now(),
--   unique (marca_slug, cliente_id, semana_inicio)
-- );
-- alter table public.cobrancas enable row level security;
-- create policy "cobrancas_select_cliente" on public.cobrancas for select
--   using (cliente_id in (select id from public.clientes where user_id = auth.uid()));

-- Tabela de relação cobrança ↔ pedidos
-- create table if not exists public.cobranca_pedidos (
--   id           uuid primary key default gen_random_uuid(),
--   cobranca_id  uuid not null references public.cobrancas(id) on delete cascade,
--   orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
--   unique (cobranca_id, orcamento_id)
-- );
