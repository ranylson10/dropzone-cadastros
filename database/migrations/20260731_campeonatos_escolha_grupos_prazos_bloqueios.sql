-- Rodada 85H — prazos, abertura programada e bloqueios manuais de grupos/slots.

create table if not exists public.campeonato_grupo_escolha_bloqueios (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid not null references public.campeonato_fases(id) on delete cascade,
  grupo_id uuid references public.campeonato_grupos(id) on delete cascade,
  slot_id uuid references public.campeonato_slots(id) on delete cascade,
  motivo text,
  ativo boolean not null default true,
  criado_por uuid,
  removido_por uuid,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  check ((grupo_id is not null and slot_id is null) or (grupo_id is null and slot_id is not null))
);

create unique index if not exists campeonato_grupo_escolha_bloqueio_grupo_ativo_uq
  on public.campeonato_grupo_escolha_bloqueios (fase_id, grupo_id)
  where ativo and grupo_id is not null;

create unique index if not exists campeonato_grupo_escolha_bloqueio_slot_ativo_uq
  on public.campeonato_grupo_escolha_bloqueios (fase_id, slot_id)
  where ativo and slot_id is not null;

create index if not exists campeonato_grupo_escolha_bloqueios_lookup_idx
  on public.campeonato_grupo_escolha_bloqueios (campeonato_id, fase_id, ativo);

alter table public.campeonato_grupo_escolha_bloqueios enable row level security;
