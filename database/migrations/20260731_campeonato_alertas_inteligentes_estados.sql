create table if not exists public.campeonato_alerta_estados (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  alerta_chave text not null,
  status text not null default 'new' check (status in ('new', 'read', 'resolved', 'dismissed')),
  observacao text,
  atualizado_por_auth_user_id uuid,
  lido_em timestamptz,
  resolvido_em timestamptz,
  dispensado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campeonato_id, alerta_chave)
);

create index if not exists campeonato_alerta_estados_campeonato_status_idx
  on public.campeonato_alerta_estados (campeonato_id, status, updated_at desc);

alter table public.campeonato_alerta_estados enable row level security;

comment on table public.campeonato_alerta_estados is
  'Estado operacional persistente dos alertas inteligentes da Central do Campeonato. Acesso exclusivo pelo backend com service role.';
