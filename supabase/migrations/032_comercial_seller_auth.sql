-- ============================================================
-- SISTEMA COMERCIAL — 032 — Login de verdade (e-mail + senha) pro seller
--
-- Antes (026): sellers não logavam via Supabase Auth, só link com token.
-- Agora o cadastro (/drop/cadastro) cria um usuário no Supabase Auth e
-- linka aqui — o login (/drop/login) usa esse vínculo pra achar o
-- portal_token do seller depois de autenticar.
-- ============================================================

alter table comercial.clientes
  add column if not exists auth_user_id uuid references auth.users(id) on delete set null;

create unique index if not exists clientes_auth_user_id_uidx
  on comercial.clientes (auth_user_id)
  where auth_user_id is not null;
