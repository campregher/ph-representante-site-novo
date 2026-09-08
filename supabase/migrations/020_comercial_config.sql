-- ============================================================
-- SISTEMA COMERCIAL — 020 — Configurações da empresa (linha única)
-- Dados que aparecem nos documentos (PDF/link do pedido).
-- Editável em /sistema/configuracoes por admin.
-- ============================================================

create table if not exists comercial.config (
  id            text primary key default 'default',
  empresa_nome  text,
  whatsapp      text,
  email         text,
  cnpj          text,
  telefone      text,
  endereco      text,
  cidade        text,
  site          text,
  observacoes_padrao_pedido text,
  updated_by    uuid references comercial.profiles(id) on delete set null,
  updated_at    timestamptz not null default now()
);

insert into comercial.config (id, empresa_nome, whatsapp, email, cidade)
values ('default', 'PH Representante', '5511959993968', 'contato@phrepresentante.com.br', 'São Paulo, SP')
on conflict (id) do nothing;

drop trigger if exists config_updated_at on comercial.config;
create trigger config_updated_at
  before update on comercial.config
  for each row execute function comercial.set_updated_at();

alter table comercial.config enable row level security;

drop policy if exists config_read on comercial.config;
create policy config_read on comercial.config
  for select to authenticated using (comercial.has_access());

drop policy if exists config_write on comercial.config;
create policy config_write on comercial.config
  for all to authenticated
  using (comercial.is_admin())
  with check (comercial.is_admin());
