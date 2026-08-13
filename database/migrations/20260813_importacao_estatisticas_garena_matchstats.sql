-- Importação privada de estatísticas detalhadas do MatchStats da Garena.
-- Estas tabelas são preenchidas exclusivamente pelo backend depois da confirmação
-- de um MatchResult. Não existe rota pública nem permissão direta de cliente.

create table if not exists public.garena_matchstats_importacoes (
  id uuid primary key default gen_random_uuid(),
  matchresult_importacao_id uuid references public.matchresult_importacoes(id) on delete set null,
  produtora_id uuid references public.produtoras(id) on delete set null,
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  partida_id uuid not null references public.campeonato_partidas(id) on delete cascade,
  match_id text not null,
  nome_arquivo text not null,
  status text not null default 'pendente',
  total_jogadores integer not null default 0,
  consulta_em timestamptz,
  concluida_em timestamptz,
  erro text,
  dados_brutos jsonb,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garena_matchstats_importacoes_status_check
    check (status = any (array['pendente', 'processando', 'concluida', 'falhou']::text[])),
  constraint garena_matchstats_importacoes_match_id_unique unique (match_id)
);

create index if not exists garena_matchstats_importacoes_campeonato_partida_idx
  on public.garena_matchstats_importacoes (campeonato_id, partida_id);

create table if not exists public.garena_matchstats_jogadores (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.garena_matchstats_importacoes(id) on delete cascade,
  player_id text not null,
  campeonato_jogador_id uuid references public.campeonato_jogadores(id) on delete set null,
  jogador_id uuid references public.jogadores(id) on delete set null,
  jogador_temporario_id uuid references public.jogadores_temporarios(id) on delete set null,
  campeonato_equipe_id uuid references public.campeonato_equipes(id) on delete set null,
  nick_snapshot text not null,
  equipe_snapshot text,
  posicao_equipe integer,
  abates integer not null default 0,
  assistencias integer not null default 0,
  dano integer not null default 0,
  headshots integer not null default 0,
  knockdowns integer not null default 0,
  sobrevivencia_segundos integer not null default 0,
  distancia_movida integer not null default 0,
  distancia_max_abate integer not null default 0,
  precisao_percentual numeric(8,3) not null default 0,
  taxa_headshot_kill_percentual numeric(8,3) not null default 0,
  precisao_headshot_percentual numeric(8,3) not null default 0,
  revives integer not null default 0,
  membros_revividos integer not null default 0,
  membros_resgatados integer not null default 0,
  granadas_usadas integer not null default 0,
  abates_granada integer not null default 0,
  dano_granada integer not null default 0,
  gel_usado integer not null default 0,
  gel_destruido integer not null default 0,
  kits_medicos integer not null default 0,
  abates_veiculo integer not null default 0,
  abates_oleo integer not null default 0,
  mudanca_posicao integer not null default 0,
  dados_brutos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint garena_matchstats_jogadores_importacao_player_unique unique (importacao_id, player_id)
);

create index if not exists garena_matchstats_jogadores_jogador_idx
  on public.garena_matchstats_jogadores (jogador_id);
create index if not exists garena_matchstats_jogadores_player_id_idx
  on public.garena_matchstats_jogadores (player_id);
create index if not exists garena_matchstats_jogadores_campeonato_equipe_idx
  on public.garena_matchstats_jogadores (campeonato_equipe_id);

create table if not exists public.garena_matchstats_armas (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.garena_matchstats_importacoes(id) on delete cascade,
  jogador_matchstats_id uuid not null references public.garena_matchstats_jogadores(id) on delete cascade,
  player_id text not null,
  ordem integer not null,
  weapon_id text,
  arma text,
  abates integer not null default 0,
  dano integer not null default 0,
  headshots integer not null default 0,
  precisao_percentual numeric(8,3) not null default 0,
  precisao_headshot_percentual numeric(8,3) not null default 0,
  dados_brutos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint garena_matchstats_armas_player_ordem_unique unique (importacao_id, player_id, ordem)
);

create index if not exists garena_matchstats_armas_jogador_idx
  on public.garena_matchstats_armas (jogador_matchstats_id);

create table if not exists public.garena_matchstats_habilidades (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.garena_matchstats_importacoes(id) on delete cascade,
  jogador_matchstats_id uuid not null references public.garena_matchstats_jogadores(id) on delete cascade,
  player_id text not null,
  tipo text not null,
  ordem integer not null,
  skill_id text,
  personagem text,
  habilidade text,
  usos integer not null default 0,
  informacao text,
  pick_times integer not null default 0,
  pick_rate numeric(8,3) not null default 0,
  dados_brutos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint garena_matchstats_habilidades_tipo_check
    check (tipo = any (array['ativa', 'passiva', 'pet', 'loadout']::text[])),
  constraint garena_matchstats_habilidades_player_tipo_ordem_unique unique (importacao_id, player_id, tipo, ordem)
);

create index if not exists garena_matchstats_habilidades_jogador_idx
  on public.garena_matchstats_habilidades (jogador_matchstats_id);

-- Base normalizada para futuras telas de estatística e para o motor de tiers.
create or replace view public.garena_matchstats_jogadores_geral as
select
  jogador.jogador_id,
  jogador.player_id,
  max(jogador.nick_snapshot) as nick,
  count(distinct jogador.importacao_id)::integer as partidas,
  sum(jogador.abates)::integer as abates,
  sum(jogador.assistencias)::integer as assistencias,
  sum(jogador.dano)::bigint as dano,
  sum(jogador.headshots)::integer as headshots,
  sum(jogador.knockdowns)::integer as knockdowns,
  sum(jogador.sobrevivencia_segundos)::bigint as sobrevivencia_segundos,
  sum(jogador.revives)::integer as revives,
  sum(jogador.granadas_usadas)::integer as granadas_usadas,
  sum(jogador.gel_usado)::integer as gel_usado,
  max(importacao.concluida_em) as ultima_partida_em
from public.garena_matchstats_jogadores jogador
join public.garena_matchstats_importacoes importacao on importacao.id = jogador.importacao_id
where importacao.status = 'concluida'
group by jogador.jogador_id, jogador.player_id;

alter table public.garena_matchstats_importacoes enable row level security;
alter table public.garena_matchstats_jogadores enable row level security;
alter table public.garena_matchstats_armas enable row level security;
alter table public.garena_matchstats_habilidades enable row level security;

revoke all on table public.garena_matchstats_importacoes, public.garena_matchstats_jogadores,
  public.garena_matchstats_armas, public.garena_matchstats_habilidades
from anon, authenticated, public;

grant select, insert, update, delete on table public.garena_matchstats_importacoes,
  public.garena_matchstats_jogadores, public.garena_matchstats_armas,
  public.garena_matchstats_habilidades to service_role;
