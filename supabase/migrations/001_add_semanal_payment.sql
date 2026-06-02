-- Migration: Add 'semanal' as valid payment condition
-- Run this in Supabase SQL Editor

-- Drop existing check constraints (they may have auto-generated names, find them first with:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.orcamentos'::regclass AND contype = 'c';

ALTER TABLE public.clientes
  DROP CONSTRAINT IF EXISTS clientes_condicao_pagamento_check;

ALTER TABLE public.clientes
  ADD CONSTRAINT clientes_condicao_pagamento_check
  CHECK (condicao_pagamento IN ('pix', 'boleto', 'semanal'));

ALTER TABLE public.orcamentos
  DROP CONSTRAINT IF EXISTS orcamentos_condicao_pagamento_check;

ALTER TABLE public.orcamentos
  ADD CONSTRAINT orcamentos_condicao_pagamento_check
  CHECK (condicao_pagamento IN ('pix', 'boleto', 'semanal'));
