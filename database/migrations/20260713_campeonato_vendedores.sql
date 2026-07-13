create table if not exists public.campeonato_vendedores (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  produtora_id uuid references public.produtoras(id) on delete cascade,
  manager_id uuid references public.managers(id) on delete set null,
  manager_auth_user_id uuid,
  token text not null unique,
  nome_publico text,
  whatsapp_url text,
  status text not null default 'pendente',
  criado_por uuid,
  aceito_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campeonato_vendedores_status_check check (status = any (array['pendente', 'ativo', 'suspenso', 'cancelado']::text[]))
);

create unique index if not exists campeonato_vendedores_campeonato_manager_unique
  on public.campeonato_vendedores (campeonato_id, manager_id)
  where manager_id is not null and status <> 'cancelado';

create index if not exists campeonato_vendedores_manager_auth_idx
  on public.campeonato_vendedores (manager_auth_user_id, status);

create index if not exists campeonato_vendedores_campeonato_idx
  on public.campeonato_vendedores (campeonato_id, status);
