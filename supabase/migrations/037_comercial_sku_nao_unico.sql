-- ============================================================
-- SISTEMA COMERCIAL — 037 — SKU da linha própria deixa de ser único
--
-- O vendedor reusa o mesmo SKU em mais de um anúncio no Mercado Livre
-- de propósito (ex.: variações do mesmo kit em anúncios separados) —
-- a trava de unicidade travava a sincronização desses produtos.
-- SKU nunca foi usado como chave de junção em outra tabela (tudo
-- referencia produtos.id), então relaxar isso é seguro.
-- ============================================================

drop index if exists comercial.produtos_propria_sku_uidx;
