-- ============================================================
-- SISTEMA COMERCIAL — 053 — Aceite da regra de emissão de NF no onboarding
--
-- Registra quando o seller confirmou ter lido como funciona a emissão da
-- nota fiscal da venda (Faturador do Mercado Livre vs. fluxo manual) — ver
-- OnboardingFlow.tsx e lib/sistema/actions/seller-onboarding.ts.
-- ============================================================

alter table comercial.clientes
  add column if not exists regra_nf_aceita_em timestamptz;

comment on column comercial.clientes.regra_nf_aceita_em is
  'Quando o seller confirmou ter lido a regra de emissão de NF (Faturador do ML vs. fluxo manual) no onboarding.';
