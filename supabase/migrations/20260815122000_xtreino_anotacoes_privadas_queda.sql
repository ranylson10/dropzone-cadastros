-- Rodada 34: anotações privadas da equipe por queda de XTreino.
-- Não altera a súmula nem a classificação pública.

create table if not exists public.xtreino_anotacoes_equipes_quedas (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  partida_id uuid not null references public.campeonato_partidas(id) on delete cascade,
  call_nome text null,
  primeira_safe text null,
  segunda_safe text null,
  updated_by uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint xtreino_anotacoes_equipe_queda_unique unique (campeonato_equipe_id, partida_id)
);

create index if not exists xtreino_anotacoes_campeonato_idx
  on public.xtreino_anotacoes_equipes_quedas (campeonato_id, partida_id);

create index if not exists xtreino_anotacoes_equipe_idx
  on public.xtreino_anotacoes_equipes_quedas (equipe_id, campeonato_equipe_id);

alter table public.xtreino_anotacoes_equipes_quedas enable row level security;

comment on table public.xtreino_anotacoes_equipes_quedas is
  'Anotações táticas privadas da própria equipe por queda de XTreino. Acesso pelo backend autorizado; não compõe classificação pública.';
