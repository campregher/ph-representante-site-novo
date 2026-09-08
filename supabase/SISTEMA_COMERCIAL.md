# Sistema Comercial — Setup do banco (Supabase)

Área interna `/sistema` da PH Representante. Tudo vive num schema Postgres
isolado chamado **`comercial`** — nenhuma tabela existente (`public.clientes`,
`public.produtos`, `public.marcas`, `public.orcamentos`, …) é alterada.

## 1. Aplicar as migrations

No painel do Supabase → **SQL Editor**, rode **na ordem**:

| Ordem | Arquivo | O que cria |
|---|---|---|
| 1 | `migrations/007_comercial_init.sql` | schema `comercial`, `profiles`, trigger de criação de profile, funções de RLS |
| 2 | `migrations/008_comercial_representadas_produtos.sql` | `representadas`, `categorias_produtos`, `produtos`, `tabelas_preco`, `produtos_precos` (+ histórico de preço) |
| 3 | `migrations/009_comercial_clientes.sql` | `clientes`, `cliente_contatos`, `cliente_representada` |
| 4 | `migrations/010_comercial_pedidos.sql` | `pedidos`, `pedido_itens`, `pedido_historico`, `pedido_faturamento` (+ triggers de validação de representada e log de status) |
| 5 | `migrations/011_comercial_gestao.sql` | `comissoes`, `tarefas`, `crm_oportunidades`, `metas_vendas` |
| 6 | `migrations/012_comercial_indexes.sql` | índices de busca/performance (usa `pg_trgm`) |
| 7 | `migrations/013_comercial_rls.sql` | ativa RLS e cria todas as políticas por papel |

Todas são **idempotentes** (`create ... if not exists`, `drop policy if exists`)
e **não destrutivas** — podem ser reaplicadas com segurança.

> CLI alternativa: `supabase db push` (se você usa o Supabase CLI e tem o projeto linkado).

## 2. Expor o schema para a API

**Project Settings → API → "Exposed schemas"** → adicione **`comercial`** e salve.
Sem isso o cliente JS (`@supabase/supabase-js`) devolve erro *"The schema must be
one of the following"*.

## 3. Criar usuários e definir papéis

Não há cadastro público. Crie os usuários em **Authentication → Users → Add user**
(marque *Auto Confirm User* e defina uma senha). Ao ser criado, cada usuário ganha
automaticamente um registro em `comercial.profiles` com `role = 'consulta'`.

Depois, promova quem for necessário via SQL Editor:

```sql
-- vira admin
update comercial.profiles set role = 'admin'
where email = 'voce@phrepresentante.com.br';

-- outros papéis: 'gerente' | 'vendedor' | 'financeiro' | 'consulta'
update comercial.profiles set role = 'vendedor', nome = 'Fulano'
where email = 'vendedor@phrepresentante.com.br';

-- desativar acesso sem apagar o usuário
update comercial.profiles set ativo = false where email = '...';
```

Com pelo menos um `admin`, o resto da gestão de papéis é feita pela tela
`/sistema/configuracoes` (implementada na Fase 3).

## 4. Variáveis de ambiente

Já usadas pelo projeto (veja `.env.example`). Para rodar/testar **localmente**,
garanta que o `.env.local` tenha:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...            # chave "anon/public"
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # chave "service_role" (NUNCA vai pro browser)
NEXT_PUBLIC_SITE_URL=http://localhost:3000     # usado nos e-mails de recuperação de senha
```

Na Vercel essas variáveis já existem (Production). Se acabou de adicionar,
faça um **Redeploy**.

## 5. Modelo de papéis (resumo do RLS)

| Papel | Pode |
|---|---|
| `admin` | tudo |
| `gerente` | cadastros (representadas/produtos/tabelas/clientes), pedidos, vendas, relatórios |
| `vendedor` | ver **seus** clientes, criar/editar **seus** pedidos (enquanto orçamento), suas tarefas, ler catálogo e tabelas |
| `financeiro` | vendas, faturamento, comissões |
| `consulta` | somente leitura |

`service_role` (server) ignora RLS — usado só em agregações de relatório no servidor.
