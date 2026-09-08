-- ============================================================
-- SISTEMA COMERCIAL — 023 — Campanhas de reativação (e-mail)
--
-- Vendedor dispara e-mail de reativação para OS PRÓPRIOS clientes
-- inativos, a partir de modelos editáveis. Com opt-out (descadastro).
--
-- Aditivo e idempotente.
-- ============================================================

-- ------------------------------------------------------------
-- CLIENTES: opt-in de e-mail + token de descadastro
-- ------------------------------------------------------------
alter table comercial.clientes
  add column if not exists aceita_email      boolean not null default true,
  add column if not exists descadastro_token uuid    not null default gen_random_uuid();

create unique index if not exists clientes_descadastro_token_uidx
  on comercial.clientes (descadastro_token);

-- ------------------------------------------------------------
-- EMAIL_LOG: referência opcional ao cliente
-- ------------------------------------------------------------
alter table comercial.email_log
  add column if not exists cliente_id uuid references comercial.clientes(id) on delete set null;

create index if not exists email_log_cliente_idx on comercial.email_log (cliente_id);

-- ------------------------------------------------------------
-- CAMPANHA_MODELOS  (templates editáveis)
-- ------------------------------------------------------------
create table if not exists comercial.campanha_modelos (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  assunto     text not null,
  corpo       text not null,          -- HTML/markup simples com {{nome}}, {{vendedor}}, {{dias}}, {{empresa}}, {{link_catalogo}}
  ativo       boolean not null default true,
  created_by  uuid references comercial.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists campanha_modelos_updated_at on comercial.campanha_modelos;
create trigger campanha_modelos_updated_at
  before update on comercial.campanha_modelos
  for each row execute function comercial.set_updated_at();

alter table comercial.campanha_modelos enable row level security;

drop policy if exists campanha_modelos_sel on comercial.campanha_modelos;
create policy campanha_modelos_sel on comercial.campanha_modelos
  for select to authenticated using (comercial.has_access());

drop policy if exists campanha_modelos_ins on comercial.campanha_modelos;
create policy campanha_modelos_ins on comercial.campanha_modelos
  for insert to authenticated
  with check (comercial.has_access() and comercial.my_role() <> 'consulta');

drop policy if exists campanha_modelos_upd on comercial.campanha_modelos;
create policy campanha_modelos_upd on comercial.campanha_modelos
  for update to authenticated
  using (created_by = auth.uid() or comercial.can_manage())
  with check (created_by = auth.uid() or comercial.can_manage());

drop policy if exists campanha_modelos_del on comercial.campanha_modelos;
create policy campanha_modelos_del on comercial.campanha_modelos
  for delete to authenticated
  using (created_by = auth.uid() or comercial.can_manage());

-- ------------------------------------------------------------
-- CAMPANHAS  (cada disparo)
-- ------------------------------------------------------------
create table if not exists comercial.campanhas (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null,
  tipo             text not null default 'reativacao',
  assunto          text not null,
  corpo            text not null,
  faixa_min_dias   integer,               -- "sem comprar há +N dias"; null = inclui "nunca comprou"
  inclui_nunca     boolean not null default false,
  representada_id  uuid references comercial.representadas(id) on delete set null,
  criado_por       uuid references comercial.profiles(id) on delete set null,
  total_alvos      integer not null default 0,
  total_enviado    integer not null default 0,
  total_erro       integer not null default 0,
  total_pulado     integer not null default 0,
  enviado_em       timestamptz,
  created_at       timestamptz not null default now()
);

create index if not exists campanhas_criador_idx on comercial.campanhas (criado_por, created_at desc);

alter table comercial.campanhas enable row level security;

drop policy if exists campanhas_sel on comercial.campanhas;
create policy campanhas_sel on comercial.campanhas
  for select to authenticated
  using (criado_por = auth.uid() or comercial.can_manage());

drop policy if exists campanhas_ins on comercial.campanhas;
create policy campanhas_ins on comercial.campanhas
  for insert to authenticated
  with check (
    comercial.has_access() and comercial.my_role() <> 'consulta'
    and criado_por = auth.uid()
  );

drop policy if exists campanhas_upd on comercial.campanhas;
create policy campanhas_upd on comercial.campanhas
  for update to authenticated
  using (criado_por = auth.uid() or comercial.can_manage())
  with check (criado_por = auth.uid() or comercial.can_manage());

drop policy if exists campanhas_del on comercial.campanhas;
create policy campanhas_del on comercial.campanhas
  for delete to authenticated
  using (criado_por = auth.uid() or comercial.can_manage());

-- ------------------------------------------------------------
-- CAMPANHA_ENVIOS  (1 linha por cliente de cada campanha)
-- ------------------------------------------------------------
create table if not exists comercial.campanha_envios (
  id             uuid primary key default gen_random_uuid(),
  campanha_id    uuid not null references comercial.campanhas(id) on delete cascade,
  cliente_id     uuid references comercial.clientes(id) on delete set null,
  email          text not null,
  status         text not null check (status in ('enviado','erro','pulado')),
  motivo         text,                  -- para 'pulado' / 'erro'
  resend_id      text,
  created_at     timestamptz not null default now()
);

create unique index if not exists campanha_envios_uidx
  on comercial.campanha_envios (campanha_id, cliente_id);
create index if not exists campanha_envios_cliente_idx
  on comercial.campanha_envios (cliente_id, created_at desc);

alter table comercial.campanha_envios enable row level security;

drop policy if exists campanha_envios_sel on comercial.campanha_envios;
create policy campanha_envios_sel on comercial.campanha_envios
  for select to authenticated
  using (
    comercial.can_manage()
    or exists (
      select 1 from comercial.campanhas c
      where c.id = campanha_id and c.criado_por = auth.uid()
    )
  );

drop policy if exists campanha_envios_ins on comercial.campanha_envios;
create policy campanha_envios_ins on comercial.campanha_envios
  for insert to authenticated
  with check (
    comercial.can_manage()
    or exists (
      select 1 from comercial.campanhas c
      where c.id = campanha_id and c.criado_por = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- Modelos iniciais
-- ------------------------------------------------------------
insert into comercial.campanha_modelos (nome, assunto, corpo)
select * from (values
  (
    'Sentimos sua falta',
    'Sentimos sua falta, {{nome}}!',
    'Olá, {{nome}}!' || chr(10) || chr(10) ||
    'Notamos que faz {{dias}} dias desde sua última compra e queremos te ajudar a repor o estoque. ' ||
    'Temos novidades e condições especiais esperando por você.' || chr(10) || chr(10) ||
    'Fale comigo, {{vendedor}}, e monto seu pedido rapidinho.'
  ),
  (
    'Condição especial de retorno',
    '{{nome}}, preparei uma condição especial para você voltar a comprar',
    'Oi, {{nome}}!' || chr(10) || chr(10) ||
    'Faz um tempo que não fazemos um pedido juntos ({{dias}} dias). ' ||
    'Preparei uma condição especial de retorno — me chama que te passo os detalhes.' || chr(10) || chr(10) ||
    'Abraço,' || chr(10) || '{{vendedor}} — {{empresa}}'
  ),
  (
    'Novidades no catálogo',
    'Novidades no catálogo da {{empresa}}',
    'Olá, {{nome}}!' || chr(10) || chr(10) ||
    'Chegaram lançamentos que combinam com o seu mix. Dá uma olhada no catálogo: {{link_catalogo}}' || chr(10) || chr(10) ||
    'Qualquer dúvida é só me chamar. {{vendedor}}'
  )
) as v(nome, assunto, corpo)
where not exists (select 1 from comercial.campanha_modelos);
