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

-- Usuário autenticado lê apenas suas próprias notificações
CREATE POLICY "select_own" ON notificacoes
  FOR SELECT TO authenticated
  USING (auth.uid()::text = destinatario_id);

-- Usuário autenticado marca como lida apenas as suas
CREATE POLICY "update_own_lida" ON notificacoes
  FOR UPDATE TO authenticated
  USING (auth.uid()::text = destinatario_id)
  WITH CHECK (auth.uid()::text = destinatario_id);

-- Apenas service_role insere (via API routes)
CREATE POLICY "insert_service_role" ON notificacoes
  FOR INSERT TO service_role
  WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE notificacoes;
