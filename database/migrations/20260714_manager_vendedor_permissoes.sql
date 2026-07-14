alter table public.tokens
  add column if not exists manager_limite_vagas integer,
  add column if not exists manager_permissoes jsonb not null default '{}'::jsonb;

alter table public.campeonato_vendedores
  add column if not exists limite_vagas integer not null default 0,
  add column if not exists permissoes jsonb not null default '{}'::jsonb;

create index if not exists campeonato_equipes_vendedor_idx
  on public.campeonato_equipes (campeonato_id, criado_por, origem_entrada, status);
