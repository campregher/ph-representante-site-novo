-- Categoria interna nossa (mesma lista usada no onboarding do seller:
-- Calotas, Tapetes, Engates, Acessórios internos, Frisos, Outros) e os
-- métodos de transporte aceitos pra esse produto — usados pra filtrar/
-- configurar o envio quando o seller publica no Mercado Livre.
alter table dropshipping.produtos
  add column if not exists categoria_interna text,
  add column if not exists transporte_aceito text[] not null default '{}';
