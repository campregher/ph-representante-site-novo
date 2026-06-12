-- Adiciona email de expedição à tabela de marcas
ALTER TABLE marcas ADD COLUMN IF NOT EXISTS email_expedicao TEXT;
