-- DROPZONE · Xtreino · calls por mapa
create extension if not exists pgcrypto;

create table if not exists public.xtreino_mapa_calls (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  mapa_codigo text not null,
  nome text not null,
  observacao text,
  cor text not null default '#d6b84b',
  ordem integer not null default 0,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campeonato_id, mapa_codigo, nome)
);

create table if not exists public.xtreino_mapa_call_equipes (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  call_id uuid not null references public.xtreino_mapa_calls(id) on delete cascade,
  mapa_codigo text not null,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  tipo text not null default 'principal' check (tipo in ('principal', 'alternativa')),
  permitir_conflito boolean not null default false,
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (call_id, campeonato_equipe_id, tipo)
);

create unique index if not exists xtreino_call_principal_unica_por_equipe_mapa
on public.xtreino_mapa_call_equipes (campeonato_id, mapa_codigo, campeonato_equipe_id)
where tipo = 'principal';

create index if not exists xtreino_mapa_calls_campeonato_mapa_idx
on public.xtreino_mapa_calls (campeonato_id, mapa_codigo, ordem);

create index if not exists xtreino_mapa_call_equipes_call_idx
on public.xtreino_mapa_call_equipes (call_id);

alter table public.xtreino_mapa_calls enable row level security;
alter table public.xtreino_mapa_call_equipes enable row level security;

comment on table public.xtreino_mapa_calls is 'Calls cadastradas manualmente pelo organizador em cada mapa de um Xtreino.';
comment on table public.xtreino_mapa_call_equipes is 'Vínculos manuais entre calls do mapa e equipes/lines participantes do Xtreino.';
