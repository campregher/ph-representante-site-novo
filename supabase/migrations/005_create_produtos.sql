-- Tabela de produtos (migrado do Google Sheets)
CREATE TABLE IF NOT EXISTS produtos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  sku         text        NOT NULL,
  name        text        NOT NULL,
  brand       text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  price       numeric(12, 2),
  images      text[]      NOT NULL DEFAULT '{}',
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS produtos_brand_idx  ON produtos (brand);
CREATE INDEX IF NOT EXISTS produtos_active_idx ON produtos (active);
CREATE UNIQUE INDEX IF NOT EXISTS produtos_brand_sku_idx ON produtos (brand, sku);
