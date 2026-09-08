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
