-- ============================================================
-- DROPSHIPPING — 055 — Status real de envio (Mercado Livre) + devolução
--
-- `status` em dropshipping.pedidos continua sendo só o repasse ao
-- fornecedor (aguardando_nf/pronto/enviado/cancelado, ver migration 050) —
-- "enviado" ali significa "o seller já mandou pro fornecedor", não que o
-- Mercado Livre já despachou/entregou de verdade pro comprador final.
-- Essas colunas novas guardam esse status REAL do ML (envio físico +
-- devolução/reclamação), consultado por
-- lib/sistema/dropshipping-pedido-envio-status.ts — ver esse arquivo pros
-- avisos sobre quais campos ainda não foram confirmados contra um caso real.
-- ============================================================

alter table dropshipping.pedidos
  add column if not exists ml_shipping_status text,
  add column if not exists ml_shipping_substatus text,
  add column if not exists ml_prazo_envio timestamptz,
  add column if not exists ml_envio_atualizado_em timestamptz,
  add column if not exists devolucao_status text,
  add column if not exists devolucao_claim_id text,
  add column if not exists devolucao_motivo text,
  add column if not exists devolucao_atualizada_em timestamptz;

comment on column dropshipping.pedidos.ml_shipping_status is
  'Status real do envio no Mercado Livre (shipped/delivered/not_delivered/...) — GET /shipments/{id}. Só informativo, não controla o repasse ao fornecedor.';
comment on column dropshipping.pedidos.ml_prazo_envio is
  'Prazo de despacho informado pelo ML ("enviar até") — campo ainda não confirmado contra um envio real, pode vir null até ajustarmos.';
comment on column dropshipping.pedidos.devolucao_status is
  'null | aberta | em_mediacao | resolvida | cancelada — derivado da API de claims do ML. Texto livre por enquanto (sem taxonomia de garantia ainda).';
comment on column dropshipping.pedidos.devolucao_motivo is
  'Motivo cru vindo do claim (reason/type do ML) — exibido pro seller/admin, sem categorização própria ainda.';
