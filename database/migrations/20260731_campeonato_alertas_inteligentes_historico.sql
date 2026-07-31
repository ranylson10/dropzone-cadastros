create table if not exists public.campeonato_alerta_historico (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  alerta_chave text not null,
  status_anterior text check (status_anterior is null or status_anterior in ('new', 'read', 'resolved', 'dismissed')),
  status_novo text not null check (status_novo in ('new', 'read', 'resolved', 'dismissed')),
  observacao text,
  alterado_por_auth_user_id uuid,
  alterado_por_email text,
  created_at timestamptz not null default now()
);

create index if not exists campeonato_alerta_historico_campeonato_created_idx
  on public.campeonato_alerta_historico (campeonato_id, created_at desc);

create index if not exists campeonato_alerta_historico_alerta_idx
  on public.campeonato_alerta_historico (campeonato_id, alerta_chave, created_at desc);

alter table public.campeonato_alerta_historico enable row level security;

comment on table public.campeonato_alerta_historico is
  'Histórico imutável das mudanças de estado dos alertas inteligentes. Acesso exclusivo pelo backend com service role.';
