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
  add column if not exists desconto_cascata     numeric[] not null default '{}',
  add column if not exists acrescimo_cascata    numeric[] not null default '{}',
  add column if not exists preco_liquido_manual numeric,
  add column if not exists tabela_preco_id      uuid references comercial.tabelas_preco(id) on delete set null,
  add column if not exists observacao           text;

alter table comercial.pedidos
  add column if not exists desconto_cascata  numeric[] not null default '{}',
  add column if not exists acrescimo_cascata numeric[] not null default '{}';

alter table comercial.clientes
  add column if not exists desconto_cascata numeric[] not null default '{}';

-- preço unitário líquido mantém precisão (Mercos mostra ex.: 171,51225)
alter table comercial.pedido_itens
  alter column preco_unitario_final type numeric(14,5);

comment on column comercial.pedido_itens.desconto_cascata is
  'Descontos sucessivos aplicados um sobre o outro, em %. Ex.: {50,6.66,4}. Vazio = usa desconto_item_percentual.';
comment on column comercial.pedido_itens.acrescimo_cascata is
  'Acréscimos sucessivos, em %, aplicados APÓS os descontos. Ex.: {5}.';
comment on column comercial.pedido_itens.preco_liquido_manual is
  'Preço unitário final digitado manualmente. Quando preenchido, ignora desconto/acréscimo em cascata.';
comment on column comercial.pedido_itens.tabela_preco_id is
  'Tabela de preço específica desta linha. Nulo = usa a tabela do pedido.';
comment on column comercial.pedido_itens.observacao is
  'Infos adicionais da linha do pedido (texto livre do vendedor).';
comment on column comercial.pedidos.desconto_cascata is
  'Descontos sucessivos sobre o subtotal, em %. Vazio = usa desconto_percentual/desconto_valor.';
comment on column comercial.clientes.desconto_cascata is
  'Cascata padrão do cliente — pré-preenche o desconto adicional em novos pedidos.';
