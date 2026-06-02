-- Adiciona campo de rastreamento de impressão nos pedidos
ALTER TABLE orcamentos ADD COLUMN IF NOT EXISTS impresso_at timestamptz DEFAULT NULL;
