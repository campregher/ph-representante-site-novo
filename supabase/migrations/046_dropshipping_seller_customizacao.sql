-- ============================================================
-- DROPSHIPPING — 046 — Customização do seller por produto
--
-- Cada seller pode personalizar como UM produto aparece no anúncio dele
-- (título, descrição, fotos) sem alterar o cadastro do admin, que
-- continua valendo pra todos os outros sellers que revendem o mesmo
-- produto. Quando não há customização (linha ausente ou campo null), usa
-- o valor do admin — ver merge em lib/sistema/seller-catalogo.ts e
-- lib/sistema/actions/seller-ml-catalogo.ts.
-- ============================================================

create table if not exists dropshipping.seller_produto_customizacoes (
  id          uuid primary key default gen_random_uuid(),
  cliente_id  uuid not null references comercial.clientes(id) on delete cascade,
  produto_id  uuid not null references dropshipping.produtos(id) on delete cascade,
  nome        text,
  descricao   text,
  imagens     text[],
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (cliente_id, produto_id)
);

create index if not exists dropshipping_customizacoes_cliente_idx
  on dropshipping.seller_produto_customizacoes (cliente_id);

drop trigger if exists seller_produto_customizacoes_updated_at on dropshipping.seller_produto_customizacoes;
create trigger seller_produto_customizacoes_updated_at before update on dropshipping.seller_produto_customizacoes
  for each row execute function comercial.set_updated_at();

alter table dropshipping.seller_produto_customizacoes enable row level security;

drop policy if exists custom_sel on dropshipping.seller_produto_customizacoes;
create policy custom_sel on dropshipping.seller_produto_customizacoes for select to authenticated using (comercial.has_access());
drop policy if exists custom_wr on dropshipping.seller_produto_customizacoes;
create policy custom_wr on dropshipping.seller_produto_customizacoes for all to authenticated
  using (comercial.can_manage()) with check (comercial.can_manage());
