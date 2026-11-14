-- ============================================================
-- DROPSHIPPING — 049 — Seller escolhe tipo de anúncio (Clássico/Premium)
--
-- Até aqui toda publicação saía fixa como "Premium" (gold_pro) — comissão
-- mais alta (17%) só pra ter mais exposição. Agora o seller escolhe, em
-- "Detalhes do produto", entre Clássico (gold_special, comissão menor) e
-- Premium (gold_pro), e a comissão/"você recebe" mostrados batem com o
-- tipo escolhido de verdade — ver GET /sites/MLB/listing_prices em
-- lib/sistema/dropshipping-ml-catalogo.ts. Vazio = continua usando Premium
-- (comportamento de antes), pra não mudar nada de quem não mexer nisso.
-- ============================================================

alter table dropshipping.seller_produto_customizacoes
  add column if not exists tipo_anuncio text;
