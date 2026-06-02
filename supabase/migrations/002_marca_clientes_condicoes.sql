-- Migration: Add configurable DROP payment options per client per brand
-- Run in Supabase SQL Editor

ALTER TABLE public.marca_clientes
  ADD COLUMN IF NOT EXISTS condicoes_pagamento_drop text[]
  DEFAULT ARRAY['pix', 'boleto', 'semanal'];
