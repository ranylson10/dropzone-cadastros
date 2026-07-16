-- =============================================================================
-- DropZone — Convites/Pedidos Manager × Campeonato + Correio (ADITIVO)
-- =============================================================================
-- Como usar:
--   1) Supabase → SQL Editor
--   2) Cole este arquivo inteiro
--   3) Run
--
-- Fluxos:
--   A) Adm do campeonato pesquisa manager → define permissões → convite no correio
--   B) Manager pesquisa campeonato → envia pedido → adm aceita no correio
--
-- Seguro:
--   - Só CREATE TABLE IF NOT EXISTS + índices
--   - NÃO altera login, tokens legados, campeonato_vendedores schema
--   - Pode rodar mais de uma vez
-- =============================================================================

create table if not exists public.campeonato_manager_convites (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  produtora_id uuid references public.produtoras(id) on delete set null,
  manager_id uuid not null references public.managers(id) on delete cascade,
  -- convite = adm convida manager | pedido = manager pede acesso
  tipo text not null default 'convite'
    check (tipo in ('convite', 'pedido')),
  criado_por_auth_user_id uuid not null references auth.users(id) on delete cascade,
  manager_username text,
  mensagem text,
  limite_vagas integer not null default 0,
  permissoes jsonb not null default '{
    "vendedor_vagas": true,
    "adicionar_equipes": false,
    "remover_proprias_equipes": false,
    "gerar_convites_equipe": true,
    "ver_estrutura": true,
    "organizar_grupos": false,
    "pontuar_tabela": false
  }'::jsonb,
  expira_em timestamptz not null,
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado', 'cancelado', 'expirado')),
  respondido_em timestamptz,
  notificacao_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campeonato_manager_convites_camp_idx
  on public.campeonato_manager_convites (campeonato_id, status, created_at desc);

create index if not exists campeonato_manager_convites_manager_idx
  on public.campeonato_manager_convites (manager_id, status, created_at desc);

create index if not exists campeonato_manager_convites_tipo_idx
  on public.campeonato_manager_convites (tipo, status);

-- No máximo 1 pendente por (campeonato, manager, tipo)
create unique index if not exists campeonato_manager_convites_pendente_unique
  on public.campeonato_manager_convites (campeonato_id, manager_id, tipo)
  where status = 'pendente';

-- FK opcional → notificacoes (se a tabela já existir)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'notificacoes'
  ) and not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'campeonato_manager_convites'
      and constraint_name = 'campeonato_manager_convites_notificacao_fk'
  ) then
    alter table public.campeonato_manager_convites
      add constraint campeonato_manager_convites_notificacao_fk
      foreign key (notificacao_id) references public.notificacoes(id)
      on delete set null;
  end if;
end $$;

select 'campeonato_manager_convites' as tabela, count(*)::int as linhas
from public.campeonato_manager_convites;
