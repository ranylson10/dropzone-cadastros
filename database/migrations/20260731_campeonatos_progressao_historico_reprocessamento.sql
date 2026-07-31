-- Rodada 85E — histórico, conflitos e reversão segura da progressão entre etapas.

alter table public.campeonato_etapa_equipes
  add column if not exists regra_progressao_id uuid references public.campeonato_progressao_regras(id) on delete set null,
  add column if not exists progressao_execucao_id uuid;

create table if not exists public.campeonato_progressao_execucoes (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  regra_id uuid not null references public.campeonato_progressao_regras(id) on delete restrict,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  status text not null default 'aplicada' check (status in ('aplicada','revertida')),
  previa_snapshot jsonb not null default '{}'::jsonb,
  resultado_snapshot jsonb not null default '{}'::jsonb,
  aplicada_por uuid,
  aplicada_em timestamptz not null default now(),
  revertida_por uuid,
  revertida_em timestamptz,
  motivo_reversao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.campeonato_progressao_execucao_itens (
  id uuid primary key default gen_random_uuid(),
  execucao_id uuid not null references public.campeonato_progressao_execucoes(id) on delete cascade,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  vinculo_origem_id uuid references public.campeonato_etapa_equipes(id) on delete set null,
  vinculo_destino_id uuid references public.campeonato_etapa_equipes(id) on delete set null,
  posicao_origem integer,
  status_origem_anterior text,
  destino_anterior jsonb,
  resultado text not null check (resultado in ('incluida','substituida')),
  created_at timestamptz not null default now(),
  unique (execucao_id, campeonato_equipe_id)
);

alter table public.campeonato_etapa_equipes
  drop constraint if exists campeonato_etapa_equipes_progressao_execucao_id_fkey;
alter table public.campeonato_etapa_equipes
  add constraint campeonato_etapa_equipes_progressao_execucao_id_fkey
  foreign key (progressao_execucao_id) references public.campeonato_progressao_execucoes(id) on delete set null;

create index if not exists campeonato_progressao_execucoes_campeonato_idx on public.campeonato_progressao_execucoes (campeonato_id, regra_id, created_at desc);
create index if not exists campeonato_progressao_execucao_itens_execucao_idx on public.campeonato_progressao_execucao_itens (execucao_id);
create index if not exists campeonato_etapa_equipes_execucao_idx on public.campeonato_etapa_equipes (progressao_execucao_id);

alter table public.campeonato_progressao_execucoes enable row level security;
alter table public.campeonato_progressao_execucao_itens enable row level security;
