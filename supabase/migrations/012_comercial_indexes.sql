-- ============================================================
-- SISTEMA COMERCIAL — 012 — Índices de performance / busca
-- ============================================================

create extension if not exists pg_trgm;

-- Busca textual (ilike) em clientes
create index if not exists clientes_razao_trgm
  on comercial.clientes using gin (lower(coalesce(razao_social,'')) gin_trgm_ops);
create index if not exists clientes_fantasia_trgm
  on comercial.clientes using gin (lower(coalesce(nome_fantasia,'')) gin_trgm_ops);
create index if not exists clientes_cidade_idx
  on comercial.clientes (lower(coalesce(cidade,'')));
create index if not exists clientes_vendedor_idx
  on comercial.clientes (vendedor_id);
create index if not exists clientes_status_idx
  on comercial.clientes (status);
create index if not exists clientes_ultima_compra_idx
  on comercial.clientes (data_ultima_compra);

-- Busca textual em produtos
create index if not exists produtos_nome_trgm
  on comercial.produtos using gin (lower(coalesce(nome,'')) gin_trgm_ops);
create index if not exists produtos_aplicacao_trgm
  on comercial.produtos using gin (lower(coalesce(aplicacao,'')) gin_trgm_ops);
create index if not exists produtos_sku_idx
  on comercial.produtos (lower(sku));
create index if not exists produtos_representada_idx
  on comercial.produtos (representada_id);
create index if not exists produtos_categoria_idx
  on comercial.produtos (categoria_id);
create index if not exists produtos_ativo_idx
  on comercial.produtos (ativo);

-- Preços
create index if not exists produtos_precos_produto_idx
  on comercial.produtos_precos (produto_id);
create index if not exists produtos_precos_tabela_idx
  on comercial.produtos_precos (tabela_preco_id);
