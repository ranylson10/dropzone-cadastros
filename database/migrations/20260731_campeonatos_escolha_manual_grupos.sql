-- Rodada 85F — distribuição manual e escolha de grupos pelas equipes.

create table if not exists public.campeonato_grupo_escolha_configuracoes (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid not null references public.campeonato_fases(id) on delete cascade,
  aberta boolean not null default false,
  permite_troca boolean not null default true,
  abre_em timestamptz,
  fecha_em timestamptz,
  criado_por uuid,
  atualizado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (fase_id)
);

create table if not exists public.campeonato_grupo_escolha_historico (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid not null references public.campeonato_fases(id) on delete cascade,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  grupo_anterior_id uuid references public.campeonato_grupos(id) on delete set null,
  grupo_novo_id uuid references public.campeonato_grupos(id) on delete set null,
  slot_anterior_id uuid references public.campeonato_slots(id) on delete set null,
  slot_novo_id uuid references public.campeonato_slots(id) on delete set null,
  origem text not null check (origem in ('administrador','equipe')),
  alterado_por uuid,
  observacao text,
  created_at timestamptz not null default now()
);

create index if not exists campeonato_grupo_escolha_config_campeonato_idx
  on public.campeonato_grupo_escolha_configuracoes (campeonato_id, fase_id);
create index if not exists campeonato_grupo_escolha_historico_lookup_idx
  on public.campeonato_grupo_escolha_historico (campeonato_id, fase_id, campeonato_equipe_id, created_at desc);

alter table public.campeonato_grupo_escolha_configuracoes enable row level security;
alter table public.campeonato_grupo_escolha_historico enable row level security;
