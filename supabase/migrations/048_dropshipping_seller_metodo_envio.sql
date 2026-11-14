-- ============================================================
-- DROPSHIPPING — 048 — Seller cadastra o método de envio por produto
--
-- Até aqui o método de envio usado na publicação vinha de uma resposta
-- única, dada no questionário de onboarding (comercial.clientes.
-- onboarding_metodos_envio), cruzada com o transporte aceito do produto
-- (dropshipping.produtos.transporte_aceito, setado pelo admin). Isso virou
-- um cadastro explícito, por produto: o seller escolhe, em "Detalhes do
-- produto" (antes de anunciar, em massa ou individual), qual método de
-- envio usar pra ESSE produto — dentre os que o produto aceita. Ver
-- lib/sistema/actions/seller-ml-catalogo.ts e
-- lib/sistema/dropshipping-ml-catalogo.ts.
-- ============================================================

alter table dropshipping.seller_produto_customizacoes
  add column if not exists metodo_envio text;
