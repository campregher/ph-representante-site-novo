-- ============================================================
-- SISTEMA COMERCIAL — 022 — E-mail de pedido + Notificações
--
-- - pedidos.enviado_email_at: quando o pedido foi enviado ao cliente por e-mail
-- - comercial.email_log: auditoria de todo e-mail disparado pelo sistema
-- - comercial.notificacoes: avisos in-app por usuário (sino no topo)
--
-- Aditivo e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- PEDIDOS: marca do envio por e-mail
-- ------------------------------------------------------------
alter table comercial.pedidos
  add column if not exists enviado_email_at timestamptz;

-- ------------------------------------------------------------
-- EMAIL_LOG
-- ------------------------------------------------------------
create table if not exists comercial.email_log (
  id           uuid primary key default gen_random_uuid(),
  tipo         text not null,                 -- 'pedido' | 'alerta' | 'status' | ...
  para         text[] not null default '{}',
  cc           text[] not null default '{}',
  assunto      text not null,
  pedido_id    uuid references comercial.pedidos(id) on delete set null,
  resend_id    text,
  status       text not null default 'enviado' check (status in ('enviado','erro')),
  erro         text,
  enviado_por  uuid references comercial.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists email_log_pedido_idx  on comercial.email_log (pedido_id);
create index if not exists email_log_criado_idx  on comercial.email_log (created_at desc);

alter table comercial.email_log enable row level security;

drop policy if exists email_log_sel on comercial.email_log;
create policy email_log_sel on comercial.email_log
  for select to authenticated using (comercial.has_access());

drop policy if exists email_log_ins on comercial.email_log;
create policy email_log_ins on comercial.email_log
  for insert to authenticated
  with check (comercial.has_access() and comercial.my_role() <> 'consulta');

-- ------------------------------------------------------------
-- NOTIFICACOES (in-app, por usuário)
-- ------------------------------------------------------------
create table if not exists comercial.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references comercial.profiles(id) on delete cascade,
  tipo        text not null default 'info',   -- 'pedido' | 'tarefa' | 'comissao' | 'cliente' | 'info'
  titulo      text not null,
  descricao   text,
  link        text,
  lida        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notificacoes_user_idx
  on comercial.notificacoes (user_id, lida, created_at desc);

alter table comercial.notificacoes enable row level security;

-- cada um lê / marca / apaga as suas; gestor enxerga todas (suporte)
drop policy if exists notificacoes_sel on comercial.notificacoes;
create policy notificacoes_sel on comercial.notificacoes
  for select to authenticated
  using (user_id = auth.uid() or comercial.can_manage());

drop policy if exists notificacoes_upd on comercial.notificacoes;
create policy notificacoes_upd on comercial.notificacoes
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notificacoes_del on comercial.notificacoes;
create policy notificacoes_del on comercial.notificacoes
  for delete to authenticated
  using (user_id = auth.uid() or comercial.can_manage());

-- inserção geralmente é feita pelo servidor (service role); esta policy
-- cobre o caso de um usuário criar aviso para si mesmo.
drop policy if exists notificacoes_ins on comercial.notificacoes;
create policy notificacoes_ins on comercial.notificacoes
  for insert to authenticated
  with check (user_id = auth.uid() or comercial.can_manage());
