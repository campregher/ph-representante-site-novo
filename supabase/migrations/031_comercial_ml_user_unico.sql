-- ============================================================
-- SISTEMA COMERCIAL — 031 — evita 2 clientes conectados à mesma conta ML
--
-- Achado testando o D6 (2026-09-19): existiam 2 linhas em cliente_ml_tokens
-- com o mesmo ml_user_id (resíduo de teste — um cliente de teste antigo
-- ficou com token de uma conexão OAuth de outro teste). Isso quebra
-- qualquer lookup por ml_user_id (webhook do D6, entre outros) — sem
-- unicidade, `.maybeSingle()` retorna erro/null em vez do registro certo.
-- ============================================================

create unique index if not exists cliente_ml_tokens_ml_user_uidx
  on comercial.cliente_ml_tokens (ml_user_id);
