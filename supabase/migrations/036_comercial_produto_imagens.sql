-- ============================================================
-- SISTEMA COMERCIAL — 036 — Galeria de fotos do produto
--
-- A importação do ML só guardava a 1ª foto (imagem_url, capa). Anúncios
-- costumam ter várias fotos — guarda todas aqui; imagem_url continua
-- sendo a capa (usada no catálogo do seller e no PDF), sem mudar nada
-- em quem já lê esse campo.
-- ============================================================

alter table comercial.produtos
  add column if not exists imagens text[];
