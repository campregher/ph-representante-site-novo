-- Relatos de problema que o seller reporta direto do portal (botão
-- "Reportar problema" no menu) — monitoramento de erros relatados por
-- seller, pra quem administra conseguir acompanhar e responder.
create table if not exists dropshipping.relatos_problema (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null,
  titulo text not null,
  descricao text not null,
  pagina text,
  status text not null default 'aberto',
  resposta_admin text,
  created_at timestamptz not null default now(),
  resolvido_em timestamptz,
  resolvido_por uuid
);

create index if not exists relatos_problema_cliente_id_idx on dropshipping.relatos_problema (cliente_id);
create index if not exists relatos_problema_status_idx on dropshipping.relatos_problema (status);
