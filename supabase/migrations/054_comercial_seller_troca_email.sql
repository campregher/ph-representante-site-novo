-- ============================================================
-- SISTEMA COMERCIAL — 054 — Troca de e-mail de seller com confirmação
--
-- O e-mail de login de um seller fica em auth.users (Supabase Auth), mas o
-- CRM (ClienteForm) editava `clientes.email` direto, sem validação nenhuma —
-- os dois ficavam fora de sincronia e o login de verdade nunca mudava
-- (confirmado ao vivo: editar o e-mail no CRM não troca quem consegue
-- logar). Agora, quando o e-mail de um seller muda no CRM, fica pendente
-- aqui até o dono confirmar clicando no link mandado pro endereço NOVO — só
-- aí `clientes.email` e `auth.users.email` mudam de verdade (ver
-- lib/sistema/actions/clientes.ts e seller-troca-email.ts).
-- ============================================================

alter table comercial.clientes
  add column if not exists email_pendente text,
  add column if not exists email_pendente_token uuid,
  add column if not exists email_pendente_criado_em timestamptz;

comment on column comercial.clientes.email_pendente is
  'E-mail novo aguardando confirmação (clique no link mandado pra ele) — só vira `email` de verdade depois disso.';
comment on column comercial.clientes.email_pendente_token is
  'Token do link de confirmação em /drop/confirmar-email/[token] — null depois de confirmado ou cancelado.';
comment on column comercial.clientes.email_pendente_criado_em is
  'Quando o pedido de troca foi gerado — usado só pra expirar links antigos (ver CONFIRMAR_EMAIL_VALIDADE_DIAS).';

create unique index if not exists clientes_email_pendente_token_idx
  on comercial.clientes (email_pendente_token)
  where email_pendente_token is not null;
