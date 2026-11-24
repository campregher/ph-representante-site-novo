-- Verificação de WhatsApp por código (OTP) no auto-cadastro de seller
-- (/drop/cadastro) — roda ANTES de existir qualquer linha em
-- comercial.clientes, por isso fica numa tabela própria chaveada pelo
-- número, não em clientes.id (ver lib/sistema/actions/whatsapp-verificacao.ts).
create table if not exists dropshipping.whatsapp_verificacoes (
  id uuid primary key default gen_random_uuid(),
  whatsapp text not null,
  codigo_hash text not null,
  tentativas int not null default 0,
  verificado boolean not null default false,
  verificado_em timestamptz,
  expira_em timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists whatsapp_verificacoes_whatsapp_idx
  on dropshipping.whatsapp_verificacoes (whatsapp, created_at desc);
