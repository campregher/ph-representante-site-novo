-- ============================================================
-- DROPSHIPPING — 054 — Logo do fornecedor
--
-- Pra mostrar o fornecedor em card próprio (logo + infos da empresa) na
-- tela "Produtos para Anunciar" do seller — ver
-- app/drop/dashboard/produtos/page.tsx. Reaproveita o bucket público
-- "sistema-comercial" já usado pra logo de representada (migration 016),
-- não precisa de bucket/policy novos.
-- ============================================================

alter table dropshipping.fornecedores
  add column if not exists logo_url text;
