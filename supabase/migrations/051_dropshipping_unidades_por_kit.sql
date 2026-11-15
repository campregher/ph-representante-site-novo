-- ============================================================
-- DROPSHIPPING — 051 — Unidades por kit (ex.: "Kit 3 Caixas" = 3 unidades)
-- Aditivo. Alguns produtos são vendidos em kit com mais de uma unidade
-- física por anúncio — a quantidade real a enviar pro fornecedor é
-- quantidade_vendida × unidades_por_kit, não só a quantidade de kits.
-- ============================================================

alter table dropshipping.produtos
  add column if not exists unidades_por_kit integer not null default 1;

alter table dropshipping.produtos
  add constraint produtos_unidades_por_kit_check check (unidades_por_kit > 0);

-- snapshot no item do pedido (igual sku_snapshot/descricao_snapshot) — não
-- muda retroativamente se o cadastro do produto mudar depois da venda.
alter table dropshipping.pedido_itens
  add column if not exists unidades_por_kit integer not null default 1;
