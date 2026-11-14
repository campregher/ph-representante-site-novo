-- Guarda a galeria completa de fotos do produto (a planilha do ML traz
-- várias por produto, separadas por vírgula) — imagem_url continua sendo a
-- capa (1ª foto), usada onde só cabe uma imagem.
alter table dropshipping.produtos
  add column if not exists imagens text[] not null default '{}';
