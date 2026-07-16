-- =============================================================================
-- DropZone — Convites Equipe → Manager + Correio (ADITIVO)
-- =============================================================================
-- Como usar:
--   1) Abra o Supabase → SQL Editor
--   2) Cole este arquivo inteiro
--   3) Run
--
-- Seguro:
--   - Só CREATE TABLE IF NOT EXISTS + índices
--   - NÃO altera manager_equipe, managers, equipes, tokens, login
--   - Pode rodar mais de uma vez
-- =============================================================================

-- 1) Convites de staff (equipe convida manager)
create table if not exists public.equipe_manager_convites (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  criado_por_auth_user_id uuid not null references auth.users(id) on delete cascade,
  manager_id uuid references public.managers(id) on delete set null,
  manager_username text,
  mensagem text,
  pode_ver boolean not null default true,
  pode_editar boolean not null default false,
  pode_escalar boolean not null default true,
  pode_gerar_token boolean not null default false,
  expira_em timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado', 'cancelado', 'expirado')),
  respondido_em timestamptz,
  notificacao_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists equipe_manager_convites_equipe_idx
  on public.equipe_manager_convites (equipe_id, status, created_at desc);

create index if not exists equipe_manager_convites_manager_idx
  on public.equipe_manager_convites (manager_id, status, created_at desc);

-- No máximo 1 convite pendente por (equipe, manager)
create unique index if not exists equipe_manager_convites_pendente_unique
  on public.equipe_manager_convites (equipe_id, manager_id)
  where status = 'pendente' and manager_id is not null;

-- 2) Correio / notificações (genérico)
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_auth_user_id uuid not null references auth.users(id) on delete cascade,
  destinatario_profile_type text,
  destinatario_profile_id uuid,
  remetente_auth_user_id uuid references auth.users(id) on delete set null,
  remetente_profile_type text,
  remetente_profile_id uuid,
  tipo text not null,
  titulo text not null,
  corpo text,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'nao_lida'
    check (status in ('nao_lida', 'lida', 'arquivada')),
  referencia_tipo text,
  referencia_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  archived_at timestamptz
);

create index if not exists notificacoes_destinatario_idx
  on public.notificacoes (destinatario_auth_user_id, status, created_at desc);

create index if not exists notificacoes_referencia_idx
  on public.notificacoes (referencia_tipo, referencia_id);

-- 3) FK opcional do convite → notificação (após as duas tabelas existirem)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'equipe_manager_convites'
      and constraint_name = 'equipe_manager_convites_notificacao_fk'
  ) then
    alter table public.equipe_manager_convites
      add constraint equipe_manager_convites_notificacao_fk
      foreign key (notificacao_id) references public.notificacoes(id)
      on delete set null;
  end if;
end $$;

-- Verificação
select 'equipe_manager_convites' as tabela, count(*)::int as linhas from public.equipe_manager_convites
union all
select 'notificacoes', count(*)::int from public.notificacoes;
