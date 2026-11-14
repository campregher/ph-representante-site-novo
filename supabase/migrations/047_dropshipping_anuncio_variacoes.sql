-- ============================================================
-- DROPSHIPPING — 047 — Anúncio com variações (corrige bug)
--
-- Bug real encontrado em produção: publicar um grupo de variações (cor)
-- de um mesmo produto criava N anúncios SIMPLES separados no Mercado
-- Livre, em vez de 1 anúncio com N variações. A tabela tinha
-- `ml_item_id` como unique GLOBAL, o que impedia várias linhas
-- (uma por produto/variação) apontarem pro MESMO ml_item_id — passo
-- necessário pra corrigir. Adiciona `ml_variation_id` (id da variação
-- dentro do item no ML) pra permitir atualizar preço/pausar por
-- variação quando o anúncio é desse tipo.
-- ============================================================

alter table dropshipping.seller_ml_anuncios
  drop constraint if exists seller_ml_anuncios_ml_item_id_key;

alter table dropshipping.seller_ml_anuncios
  add column if not exists ml_variation_id text;

create index if not exists dropshipping_anuncios_ml_item_idx
  on dropshipping.seller_ml_anuncios (ml_item_id);
