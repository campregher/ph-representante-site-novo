-- ============================================================
-- SISTEMA COMERCIAL — 035 — Linha própria nunca mistura com representação
--
-- Trava a nível de banco: linha_propria=true SEMPRE sem representada_id,
-- e todo produto de representação (linha_propria=false) SEMPRE precisa de
-- uma representada. Impossível daqui pra frente um produto ficar em estado
-- ambíguo (nem totalmente linha própria, nem totalmente representação).
-- ============================================================

alter table comercial.produtos
  add constraint produtos_linha_propria_xor_representada
  check (
    (linha_propria = true  and representada_id is null)
    or
    (linha_propria = false and representada_id is not null)
  );
