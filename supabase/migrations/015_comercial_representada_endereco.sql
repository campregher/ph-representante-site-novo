-- ============================================================
-- SISTEMA COMERCIAL — 015 — Endereço da representada
-- (para o preenchimento automático via consulta de CNPJ)
-- Aditivo e idempotente.
-- ============================================================

alter table comercial.representadas
  add column if not exists cep         text,
  add column if not exists logradouro  text,
  add column if not exists numero      text,
  add column if not exists complemento text,
  add column if not exists bairro      text,
  add column if not exists cidade      text,
  add column if not exists estado      varchar(2);
