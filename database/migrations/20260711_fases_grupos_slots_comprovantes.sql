begin;

alter table public.campeonato_grupos
  add column if not exists whatsapp_url text;

alter table public.campeonato_slots
  add column if not exists slot_letra text,
  add column if not exists line_id uuid references public.equipe_lines(id) on delete set null;

update public.campeonato_slots
set slot_letra = chr(64 + slot_numero)
where slot_letra is null and slot_numero between 1 and 26;

create unique index if not exists campeonato_slots_grupo_letra_unique
  on public.campeonato_slots (grupo_id, upper(slot_letra))
  where slot_letra is not null;

create unique index if not exists campeonato_slots_fase_line_unique
  on public.campeonato_slots (fase_id, line_id)
  where line_id is not null;

create table if not exists public.comprovantes_inscricao (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  grupo_id uuid references public.campeonato_grupos(id) on delete set null,
  slot_id uuid references public.campeonato_slots(id) on delete set null,
  campeonato_equipe_id uuid references public.campeonato_equipes(id) on delete set null,
  equipe_id uuid references public.equipes(id) on delete set null,
  line_id uuid references public.equipe_lines(id) on delete set null,
  jogo_id uuid references public.campeonato_jogos(id) on delete set null,
  status text not null default 'valido',
  emitido_em timestamptz not null default now(),
  cancelado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comprovantes_inscricao_codigo_idx on public.comprovantes_inscricao (codigo);
commit;
