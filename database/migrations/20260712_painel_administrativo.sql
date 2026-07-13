begin;

create table if not exists public.sistema_administradores (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  nome text,
  status text not null default 'ativo' check (status in ('ativo', 'inativo')),
  created_at timestamptz not null default now()
);

create table if not exists public.sistema_denuncias (
  id uuid primary key default gen_random_uuid(),
  denunciante_auth_user_id uuid references auth.users(id) on delete set null,
  alvo_tipo text not null check (alvo_tipo in ('produtora', 'equipe', 'jogador', 'manager', 'campeonato', 'publicacao')),
  alvo_id uuid not null,
  categoria text not null,
  descricao text not null,
  evidencias jsonb not null default '[]'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'em_analise', 'resolvida', 'arquivada')),
  resolucao text,
  analisado_por uuid references auth.users(id) on delete set null,
  analisado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sistema_denuncias_status_created_idx on public.sistema_denuncias(status, created_at desc);
create index if not exists sistema_denuncias_alvo_idx on public.sistema_denuncias(alvo_tipo, alvo_id);

create table if not exists public.sistema_restricoes_conta (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('suspensao', 'banimento')),
  motivo text not null,
  expira_em timestamptz,
  ativo boolean not null default true,
  aplicado_por uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sistema_auditoria (
  id bigint generated always as identity primary key,
  administrador_auth_user_id uuid not null references auth.users(id) on delete restrict,
  acao text not null,
  alvo_tipo text not null,
  alvo_id text not null,
  detalhes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sistema_auditoria_created_idx on public.sistema_auditoria(created_at desc);

insert into public.sistema_administradores(auth_user_id, email, nome)
select id, email, coalesce(raw_user_meta_data->>'name', email)
from auth.users
where lower(email) = 'blackxl.santos@gmail.com'
on conflict (auth_user_id) do nothing;

create or replace function public.sistema_metricas_infra()
returns jsonb
language sql
security definer
set search_path = public, storage, pg_catalog
as $$
  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'storage_bytes', coalesce((select sum(coalesce((metadata->>'size')::bigint, 0)) from storage.objects), 0),
    'storage_objects', coalesce((select count(*) from storage.objects), 0)
  );
$$;

revoke all on function public.sistema_metricas_infra() from public, anon, authenticated;
grant execute on function public.sistema_metricas_infra() to service_role;

alter table public.sistema_administradores enable row level security;
alter table public.sistema_denuncias enable row level security;
alter table public.sistema_restricoes_conta enable row level security;
alter table public.sistema_auditoria enable row level security;

commit;
