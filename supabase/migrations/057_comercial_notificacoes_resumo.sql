-- Troca o e-mail instantâneo por notificação (um por evento — enchia a caixa
-- de entrada/push do celular, inclusive com o mesmo aviso repetido) por um
-- resumo agrupado a cada ~30 minutos. `email_enviado` marca o que já entrou
-- num resumo mandado; `ultimo_resumo_notificacoes_em` é a trava anti-spam
-- (mesmo padrão de dropshipping.fornecedores.envio_automatico_ultimo_em).
alter table comercial.notificacoes
  add column if not exists email_enviado boolean not null default false;

alter table comercial.profiles
  add column if not exists ultimo_resumo_notificacoes_em timestamptz;
