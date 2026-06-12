-- Notificações para clientes sobre mudanças em produtos que anunciaram no ML
CREATE TABLE IF NOT EXISTS portal_ml_notificacoes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id    uuid NOT NULL,
  produto_id    uuid NOT NULL,
  produto_name  text NOT NULL,
  ml_item_id    text,
  tipo          text NOT NULL CHECK (tipo IN ('produto_editado', 'produto_pausado', 'produto_excluido')),
  mensagem      text,
  lida          boolean DEFAULT false,
  acao_tomada   text CHECK (acao_tomada IN ('sincronizado', 'pausado', 'removido', 'dispensado')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ml_notif_cliente
  ON portal_ml_notificacoes (cliente_id, lida);

CREATE INDEX IF NOT EXISTS idx_ml_notif_produto
  ON portal_ml_notificacoes (produto_id);
