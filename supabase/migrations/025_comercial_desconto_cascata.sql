-- ============================================================
-- SISTEMA COMERCIAL — 025 — Descontos em cascata (sucessivos)
--
-- Em vendas de representação os descontos são aplicados um sobre
-- o outro (ex.: 50% + 6,66% + 4%), não somados. Guardamos a
-- cadeia digitada (array de %) e mantemos os campos já existentes
-- (desconto_item_percentual, desconto_percentual, desconto_valor,
-- preco_unitario_final) com o VALOR EFETIVO já calculado — assim
-- relatórios, comissão, PDF e limites continuam funcionando.
--
-- Aditivo e idempotente. Não destrói dados: cascata vazia => usa
-- o número único de antes.
-- ============================================================

alter table comercial.pedido_itens
  add column if not exists desconto_cascata numeric[] not null default '{}';

alter table comercial.pedidos
  add column if not exists desconto_cascata numeric[] not null default '{}';

alter table comercial.clientes
  add column if not exists desconto_cascata numeric[] not null default '{}';

comment on column comercial.pedido_itens.desconto_cascata is
  'Descontos sucessivos aplicados um sobre o outro, em %. Ex.: {50,6.66,4}. Vazio = usa desconto_item_percentual.';
comment on column comercial.pedidos.desconto_cascata is
  'Descontos sucessivos sobre o subtotal, em %. Vazio = usa desconto_percentual/desconto_valor.';
comment on column comercial.clientes.desconto_cascata is
  'Cascata padrão do cliente — pré-preenche o desconto adicional em novos pedidos.';
