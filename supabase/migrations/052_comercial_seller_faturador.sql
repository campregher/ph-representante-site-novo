-- ============================================================
-- SISTEMA COMERCIAL — 052 — Seller autodeclara o Faturador do Mercado Livre
--
-- O Faturador é o emissor fiscal nativo do ML (precisa de CNPJ + Inscrição
-- Estadual atualizada + certificado digital A1, configurados pelo próprio
-- seller no painel dele — nada disso passa pelo nosso sistema). Não existe
-- endpoint de API pra consultar se está ativo, então é autodeclarado aqui
-- (tela de Configuração do portal) — usado no futuro pra decidir se
-- tentamos emitir a NF automaticamente via API ou se o fluxo continua
-- manual (seller declara a NF direto no Mercado Livre, como hoje).
-- ============================================================

alter table comercial.clientes
  add column if not exists faturador_ml_ativo boolean not null default false;

comment on column comercial.clientes.faturador_ml_ativo is
  'Autodeclarado pelo seller: já ativou o Faturador (emissor fiscal nativo) no painel do Mercado Livre dele.';
