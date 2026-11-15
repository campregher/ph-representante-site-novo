-- ============================================================
-- DROPSHIPPING — 050 — Pedidos: captura de venda + pacote pro fornecedor
-- (planilha + etiqueta + DANFE). Aditivo.
-- ============================================================

-- status antigo tinha "aguardando_pagamento" (modelo CPF/Pix, abandonado antes
-- de a Fase 4 ser construída — ver plano). Fluxo novo: aguardando_nf (venda
-- capturada, esperando o seller declarar a NF do consumidor final no ML e o
-- ML liberar a etiqueta) -> pronto (planilha+etiqueta+DANFE já geradas, seller
-- pode baixar) -> enviado (seller marcou que despachou) / cancelado.
alter table dropshipping.pedidos drop constraint if exists pedidos_status_check;
alter table dropshipping.pedidos
  add constraint pedidos_status_check
  check (status in ('aguardando_nf', 'pronto', 'enviado', 'cancelado'));
alter table dropshipping.pedidos alter column status set default 'aguardando_nf';

alter table dropshipping.pedido_itens
  add column if not exists sku_snapshot text;

alter table dropshipping.pedidos
  add column if not exists ml_conta_id uuid references comercial.cliente_ml_tokens(id) on delete set null,
  add column if not exists ml_shipping_id bigint,
  add column if not exists etiqueta_path text,
  add column if not exists etiqueta_gerada_em timestamptz,
  add column if not exists danfe_path text,
  add column if not exists danfe_gerada_em timestamptz,
  add column if not exists planilha_path text,
  add column if not exists ultima_checagem_em timestamptz;

-- Bucket privado — etiqueta/DANFE carregam dado pessoal do comprador final
-- (nome, endereço, telefone). Sem policy nenhuma pra "authenticated": só
-- service_role acessa (RLS nega por padrão quando não há policy), o cron
-- grava e as rotas de download do seller leem com o client admin depois de
-- conferir que o pedido é dele.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dropshipping-pedidos', 'dropshipping-pedidos', false, 10485760, array['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
