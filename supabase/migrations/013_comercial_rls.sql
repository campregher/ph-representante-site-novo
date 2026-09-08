-- ============================================================
-- SISTEMA COMERCIAL — 013 — Row Level Security (RLS)
--
-- Papéis (comercial.profiles.role):
--   admin      → acesso completo
--   gerente    → cadastros + pedidos + vendas + relatórios
--   vendedor   → seus clientes / seus pedidos / suas tarefas / leitura de catálogo
--   financeiro → vendas + faturamento + comissões
--   consulta   → somente leitura
--
-- service_role (chave server-side) ignora RLS por padrão — usado
-- apenas em server actions / rotas de servidor para agregações.
-- ============================================================

-- Papel enxerga TODOS os clientes/pedidos (vendedor não)
create or replace function comercial.can_see_all_clientes()
returns boolean language sql stable as $$
  select comercial.my_role() in ('admin','gerente','financeiro','consulta')
$$;
grant execute on function comercial.can_see_all_clientes() to authenticated;

-- ------------------------------------------------------------
-- CADASTROS GERAIS  (leitura p/ todo profile ativo, escrita p/ gestão)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'representadas','categorias_produtos','produtos',
    'tabelas_preco','produtos_precos'
  ] loop
    execute format('alter table comercial.%I enable row level security;', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_sel', t);
    execute format(
      'create policy %I on comercial.%I for select to authenticated using (comercial.has_access());',
      t||'_sel', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_ins', t);
    execute format(
      'create policy %I on comercial.%I for insert to authenticated with check (comercial.can_manage());',
      t||'_ins', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_upd', t);
    execute format(
      'create policy %I on comercial.%I for update to authenticated using (comercial.can_manage()) with check (comercial.can_manage());',
      t||'_upd', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_del', t);
    execute format(
      'create policy %I on comercial.%I for delete to authenticated using (comercial.can_manage());',
      t||'_del', t);
  end loop;
end $$;

-- Histórico de preços: leitura p/ quem tem acesso, escrita só service_role/trigger
alter table comercial.produtos_precos_historico enable row level security;
drop policy if exists precos_hist_sel on comercial.produtos_precos_historico;
create policy precos_hist_sel on comercial.produtos_precos_historico
  for select to authenticated using (comercial.has_access());

-- ------------------------------------------------------------
-- CLIENTES
-- ------------------------------------------------------------
alter table comercial.clientes enable row level security;

drop policy if exists clientes_sel on comercial.clientes;
create policy clientes_sel on comercial.clientes
  for select to authenticated
  using (comercial.can_see_all_clientes() or vendedor_id = auth.uid());

drop policy if exists clientes_ins on comercial.clientes;
create policy clientes_ins on comercial.clientes
  for insert to authenticated
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid()));

drop policy if exists clientes_upd on comercial.clientes;
create policy clientes_upd on comercial.clientes
  for update to authenticated
  using (comercial.can_manage() or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid()))
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid()));

drop policy if exists clientes_del on comercial.clientes;
create policy clientes_del on comercial.clientes
  for delete to authenticated using (comercial.can_manage());

-- ------------------------------------------------------------
-- CLIENTE_CONTATOS  /  CLIENTE_REPRESENTADA  (seguem o cliente)
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['cliente_contatos','cliente_representada'] loop
    execute format('alter table comercial.%I enable row level security;', t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_sel', t);
    execute format($f$
      create policy %I on comercial.%I for select to authenticated
      using (exists (
        select 1 from comercial.clientes c
        where c.id = %I.cliente_id
          and (comercial.can_see_all_clientes() or c.vendedor_id = auth.uid())
      ));$f$, t||'_sel', t, t);

    execute format('drop policy if exists %I on comercial.%I;', t||'_wr', t);
    execute format($f$
      create policy %I on comercial.%I for all to authenticated
      using (exists (
        select 1 from comercial.clientes c
        where c.id = %I.cliente_id
          and (comercial.can_manage() or (comercial.my_role() = 'vendedor' and c.vendedor_id = auth.uid()))
      ))
      with check (exists (
        select 1 from comercial.clientes c
        where c.id = %I.cliente_id
          and (comercial.can_manage() or (comercial.my_role() = 'vendedor' and c.vendedor_id = auth.uid()))
      ));$f$, t||'_wr', t, t, t);
  end loop;
end $$;

-- ------------------------------------------------------------
-- PEDIDOS
-- ------------------------------------------------------------
alter table comercial.pedidos enable row level security;

drop policy if exists pedidos_sel on comercial.pedidos;
create policy pedidos_sel on comercial.pedidos
  for select to authenticated
  using (comercial.can_see_all_clientes() or vendedor_id = auth.uid() or created_by = auth.uid());

drop policy if exists pedidos_ins on comercial.pedidos;
create policy pedidos_ins on comercial.pedidos
  for insert to authenticated
  with check (comercial.my_role() in ('admin','gerente','vendedor'));

drop policy if exists pedidos_upd on comercial.pedidos;
create policy pedidos_upd on comercial.pedidos
  for update to authenticated
  using (
    comercial.can_manage()
    or (comercial.my_role() = 'vendedor'
        and (vendedor_id = auth.uid() or created_by = auth.uid())
        and status in ('orcamento','aguardando_aprovacao'))
  )
  with check (
    comercial.can_manage()
    or (comercial.my_role() = 'vendedor'
        and (vendedor_id = auth.uid() or created_by = auth.uid()))
  );

drop policy if exists pedidos_del on comercial.pedidos;
create policy pedidos_del on comercial.pedidos
  for delete to authenticated using (comercial.can_manage());

-- ------------------------------------------------------------
-- PEDIDO_ITENS  (segue o pedido)
-- ------------------------------------------------------------
alter table comercial.pedido_itens enable row level security;

drop policy if exists pedido_itens_sel on comercial.pedido_itens;
create policy pedido_itens_sel on comercial.pedido_itens
  for select to authenticated
  using (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_itens.pedido_id
      and (comercial.can_see_all_clientes() or p.vendedor_id = auth.uid() or p.created_by = auth.uid())
  ));

drop policy if exists pedido_itens_wr on comercial.pedido_itens;
create policy pedido_itens_wr on comercial.pedido_itens
  for all to authenticated
  using (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_itens.pedido_id
      and (comercial.can_manage()
           or (comercial.my_role() = 'vendedor'
               and (p.vendedor_id = auth.uid() or p.created_by = auth.uid())
               and p.status in ('orcamento','aguardando_aprovacao')))
  ))
  with check (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_itens.pedido_id
      and (comercial.can_manage()
           or (comercial.my_role() = 'vendedor'
               and (p.vendedor_id = auth.uid() or p.created_by = auth.uid())))
  ));

-- ------------------------------------------------------------
-- PEDIDO_HISTORICO  (append-only; leitura segue o pedido)
-- ------------------------------------------------------------
alter table comercial.pedido_historico enable row level security;

drop policy if exists pedido_hist_sel on comercial.pedido_historico;
create policy pedido_hist_sel on comercial.pedido_historico
  for select to authenticated
  using (exists (
    select 1 from comercial.pedidos p
    where p.id = pedido_historico.pedido_id
      and (comercial.can_see_all_clientes() or p.vendedor_id = auth.uid() or p.created_by = auth.uid())
  ));

drop policy if exists pedido_hist_ins on comercial.pedido_historico;
create policy pedido_hist_ins on comercial.pedido_historico
  for insert to authenticated with check (comercial.has_access());

-- ------------------------------------------------------------
-- PEDIDO_FATURAMENTO  (leitura ampla, escrita financeiro/gestão)
-- ------------------------------------------------------------
alter table comercial.pedido_faturamento enable row level security;

drop policy if exists pedido_fat_sel on comercial.pedido_faturamento;
create policy pedido_fat_sel on comercial.pedido_faturamento
  for select to authenticated using (comercial.has_access());

drop policy if exists pedido_fat_wr on comercial.pedido_faturamento;
create policy pedido_fat_wr on comercial.pedido_faturamento
  for all to authenticated
  using (comercial.can_finance())
  with check (comercial.can_finance());

-- ------------------------------------------------------------
-- COMISSÕES
-- ------------------------------------------------------------
alter table comercial.comissoes enable row level security;

drop policy if exists comissoes_sel on comercial.comissoes;
create policy comissoes_sel on comercial.comissoes
  for select to authenticated
  using (
    comercial.can_finance()
    or comercial.my_role() = 'consulta'
    or (comercial.my_role() = 'vendedor' and vendedor_id = auth.uid())
  );

drop policy if exists comissoes_wr on comercial.comissoes;
create policy comissoes_wr on comercial.comissoes
  for all to authenticated
  using (comercial.my_role() in ('admin','financeiro'))
  with check (comercial.my_role() in ('admin','financeiro'));

-- ------------------------------------------------------------
-- TAREFAS
-- ------------------------------------------------------------
alter table comercial.tarefas enable row level security;

drop policy if exists tarefas_sel on comercial.tarefas;
create policy tarefas_sel on comercial.tarefas
  for select to authenticated
  using (comercial.can_manage() or comercial.my_role() = 'consulta' or responsavel_id = auth.uid());

drop policy if exists tarefas_ins on comercial.tarefas;
create policy tarefas_ins on comercial.tarefas
  for insert to authenticated
  with check (comercial.has_access() and comercial.my_role() <> 'consulta');

drop policy if exists tarefas_upd on comercial.tarefas;
create policy tarefas_upd on comercial.tarefas
  for update to authenticated
  using (comercial.can_manage() or responsavel_id = auth.uid())
  with check (comercial.can_manage() or responsavel_id = auth.uid());

drop policy if exists tarefas_del on comercial.tarefas;
create policy tarefas_del on comercial.tarefas
  for delete to authenticated
  using (comercial.can_manage() or responsavel_id = auth.uid());

-- ------------------------------------------------------------
-- CRM_OPORTUNIDADES
-- ------------------------------------------------------------
alter table comercial.crm_oportunidades enable row level security;

drop policy if exists crm_sel on comercial.crm_oportunidades;
create policy crm_sel on comercial.crm_oportunidades
  for select to authenticated using (comercial.has_access());

drop policy if exists crm_ins on comercial.crm_oportunidades;
create policy crm_ins on comercial.crm_oportunidades
  for insert to authenticated
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and responsavel_id = auth.uid()));

drop policy if exists crm_upd on comercial.crm_oportunidades;
create policy crm_upd on comercial.crm_oportunidades
  for update to authenticated
  using (comercial.can_manage() or (comercial.my_role() = 'vendedor' and responsavel_id = auth.uid()))
  with check (comercial.can_manage() or (comercial.my_role() = 'vendedor' and responsavel_id = auth.uid()));

drop policy if exists crm_del on comercial.crm_oportunidades;
create policy crm_del on comercial.crm_oportunidades
  for delete to authenticated using (comercial.can_manage());

-- ------------------------------------------------------------
-- METAS_VENDAS
-- ------------------------------------------------------------
alter table comercial.metas_vendas enable row level security;

drop policy if exists metas_sel on comercial.metas_vendas;
create policy metas_sel on comercial.metas_vendas
  for select to authenticated using (comercial.has_access());

drop policy if exists metas_wr on comercial.metas_vendas;
create policy metas_wr on comercial.metas_vendas
  for all to authenticated
  using (comercial.can_manage())
  with check (comercial.can_manage());
