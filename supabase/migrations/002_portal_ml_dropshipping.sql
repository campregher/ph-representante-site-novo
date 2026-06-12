-- Tokens ML dos clientes do portal (cada cliente conecta seu próprio ML)
CREATE TABLE IF NOT EXISTS portal_ml_tokens (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ml_user_id    text NOT NULL,
  ml_nickname   text,
  access_token  text NOT NULL,
  refresh_token text NOT NULL,
  expires_at    timestamptz NOT NULL,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(cliente_id)
);

-- Anúncios publicados pelo cliente no próprio ML (produto da marca)
CREATE TABLE IF NOT EXISTS portal_ml_anuncios (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id     uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  marca_slug     text NOT NULL,
  ml_item_id     text NOT NULL,
  ml_status      text DEFAULT 'active',
  preco_revenda  numeric(12,2),
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(ml_item_id)
);

-- Colunas adicionais em orcamentos para pedidos vindos do ML (dropshipping automático)
ALTER TABLE orcamentos
  ADD COLUMN IF NOT EXISTS ml_order_id       text,
  ADD COLUMN IF NOT EXISTS ml_shipping_id    text,
  ADD COLUMN IF NOT EXISTS dropship_cliente_id uuid REFERENCES auth.users(id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_portal_ml_tokens_cliente    ON portal_ml_tokens(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_ml_tokens_ml_user    ON portal_ml_tokens(ml_user_id);
CREATE INDEX IF NOT EXISTS idx_portal_ml_anuncios_cliente  ON portal_ml_anuncios(cliente_id);
CREATE INDEX IF NOT EXISTS idx_portal_ml_anuncios_item     ON portal_ml_anuncios(ml_item_id);
CREATE INDEX IF NOT EXISTS idx_orcamentos_ml_order         ON orcamentos(ml_order_id) WHERE ml_order_id IS NOT NULL;
