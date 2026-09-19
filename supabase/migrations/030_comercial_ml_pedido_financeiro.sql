-- ============================================================
-- SISTEMA COMERCIAL — 030 — D6/D7: pedido automático da venda no ML
--
-- pedido_itens ganha o preço de venda no ML e a comissão do ML (distintos
-- de preco_unitario_final/custo_unitario, que continuam representando o
-- que o SELLER deve pra PH — o custo do produto, não o preço de venda).
-- pedidos ganha o frete do ML (nível do pedido, não do item). Índice único
-- parcial evita processar a mesma venda do ML duas vezes (retry de webhook).
-- ============================================================

alter table comercial.pedido_itens
  add column if not exists ml_preco_venda numeric(12,2),
  add column if not exists ml_comissao numeric(12,2);

alter table comercial.pedidos
  add column if not exists ml_frete numeric(12,2);

create unique index if not exists pedidos_drop_pedido_externo_uidx
  on comercial.pedidos (cliente_id, pedido_externo)
  where tipo = 'drop_proprio' and pedido_externo is not null;
