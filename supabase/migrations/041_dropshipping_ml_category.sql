-- Campos que faltam pra publicar produto do catálogo de dropshipping no
-- Mercado Livre (lib/sistema/dropshipping-ml-catalogo.ts exige ml_category_id).
alter table dropshipping.produtos
  add column if not exists ml_category_id text,
  add column if not exists ml_category_nome text,
  add column if not exists marca text;
