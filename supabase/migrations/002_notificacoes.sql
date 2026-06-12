-- Tabela de notificações in-app
CREATE TABLE IF NOT EXISTS notificacoes (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario_tipo TEXT      NOT NULL CHECK (destinatario_tipo IN ('marca', 'portal')),
  -- auth.uid() do usuário destinatário
  destinatario_id TEXT        NOT NULL,
  tipo            TEXT        NOT NULL,
  titulo          TEXT        NOT NULL,
  mensagem        TEXT,
  link            TEXT,
  lida            BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notificacoes_dest
  ON notificacoes (destinatario_id, lida, created_at DESC);

-- RLS
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own"        ON notificacoes;
DROP POLICY IF EXISTS "update_own_lida"   ON notificacoes;
DROP POLICY IF EXISTS "insert_service_role" ON notificacoes;

CREATE POLICY "select_own" ON notificacoes
  FOR SELECT TO authenticated
  USING (auth.uid()::text = destinatario_id);

CREATE POLICY "update_own_lida" ON notificacoes
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = destinatario_id)
  WITH CHECK (auth.uid()::text = destinatario_id);

CREATE POLICY "insert_service_role" ON notificacoes
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Realtime (ignora erro se já adicionado)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
