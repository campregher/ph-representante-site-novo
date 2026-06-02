CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone            text NOT NULL,
  cliente_id       uuid REFERENCES public.clientes(id),
  state            text NOT NULL DEFAULT 'idle',
  opcoes           jsonb NOT NULL DEFAULT '[]',
  marca_slug       text,
  tipo_pedido      text,
  condicao         text,
  items            jsonb NOT NULL DEFAULT '[]',
  etiquetas        jsonb NOT NULL DEFAULT '[]',
  horario_postagem text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_sessions_phone_idx
  ON public.whatsapp_sessions(phone);
