alter table public.campeonato_configuracoes
  add column if not exists permite_jogador_multiplas_equipes boolean not null default false,
  add column if not exists pontos_colocacao integer[] not null default array[12,9,8,7,6,5,4,3,2,1,0,0],
  add column if not exists pontos_por_abate numeric(10,2) not null default 1;

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_pontos_por_abate_check;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_pontos_por_abate_check
  check (pontos_por_abate >= 0);

alter table public.campeonato_jogadores
  add column if not exists origem text not null default 'manual',
  add column if not exists criado_automaticamente boolean not null default false,
  add column if not exists criado_por uuid references auth.users(id) on delete set null;

alter table public.campeonato_jogadores
  drop constraint if exists campeonato_jogadores_origem_check;

alter table public.campeonato_jogadores
  add constraint campeonato_jogadores_origem_check
  check (origem = any (array['manual', 'token', 'link', 'equipe', 'sumula', 'matchresult', 'temporario']::text[]));

create index if not exists campeonato_jogadores_campeonato_id_jogo_idx
  on public.campeonato_jogadores (campeonato_id, id_jogo)
  where status <> 'deletado';

create table if not exists public.campeonato_partidas (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  grupo_id uuid references public.campeonato_grupos(id) on delete set null,
  numero_partida integer not null,
  mapa text,
  data_jogo date,
  horario time,
  status text not null default 'agendada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campeonato_partidas_numero_check check (numero_partida > 0),
  constraint campeonato_partidas_status_check check (status = any (array['agendada', 'em_andamento', 'finalizada', 'cancelada']::text[]))
);

create unique index if not exists campeonato_partidas_jogo_numero_unique
  on public.campeonato_partidas (jogo_id, numero_partida);

create index if not exists campeonato_partidas_campeonato_fase_jogo_idx
  on public.campeonato_partidas (campeonato_id, fase_id, jogo_id);

create index if not exists campeonato_partidas_grupo_idx
  on public.campeonato_partidas (grupo_id);

insert into public.campeonato_partidas (
  campeonato_id,
  fase_id,
  jogo_id,
  numero_partida,
  mapa,
  data_jogo,
  horario,
  status
)
select
  jogo.campeonato_id,
  jogo.fase_id,
  jogo.id,
  serie.numero_partida,
  nullif(jogo.mapas[serie.numero_partida], ''),
  jogo.data_jogo,
  jogo.horario,
  'agendada'
from public.campeonato_jogos jogo
cross join lateral generate_series(1, greatest(coalesce(jogo.numero_partidas, 0), 0)) as serie(numero_partida)
on conflict (jogo_id, numero_partida) do update set
  fase_id = excluded.fase_id,
  mapa = excluded.mapa,
  data_jogo = excluded.data_jogo,
  horario = excluded.horario,
  updated_at = now();

create table if not exists public.matchresult_vinculos_equipes (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  grupo_id uuid references public.campeonato_grupos(id) on delete set null,
  nome_raw text not null,
  nome_normalizado text not null,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists matchresult_vinculos_equipes_jogo_nome_unique
  on public.matchresult_vinculos_equipes (jogo_id, nome_normalizado);

create index if not exists matchresult_vinculos_equipes_campeonato_idx
  on public.matchresult_vinculos_equipes (campeonato_id, jogo_id);

create table if not exists public.campeonato_resultados_equipes (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  partida_id uuid not null references public.campeonato_partidas(id) on delete cascade,
  grupo_id uuid references public.campeonato_grupos(id) on delete set null,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  equipe_id uuid references public.equipes(id) on delete set null,
  line_id uuid references public.equipe_lines(id) on delete set null,
  slot_numero integer,
  posicao integer not null,
  abates integer not null default 0,
  pontos_posicao numeric(10,2) not null default 0,
  pontos_abates numeric(10,2) not null default 0,
  pontos_total numeric(10,2) not null default 0,
  booyah boolean not null default false,
  origem text not null default 'manual',
  raw_team_name text,
  observacoes text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campeonato_resultados_equipes_posicao_check check (posicao > 0),
  constraint campeonato_resultados_equipes_abates_check check (abates >= 0),
  constraint campeonato_resultados_equipes_origem_check check (origem = any (array['manual', 'matchresult', 'importacao']::text[]))
);

create unique index if not exists campeonato_resultados_equipes_partida_line_unique
  on public.campeonato_resultados_equipes (partida_id, campeonato_equipe_id);

create index if not exists campeonato_resultados_equipes_filtro_sumula_idx
  on public.campeonato_resultados_equipes (campeonato_id, fase_id, jogo_id, partida_id);

create index if not exists campeonato_resultados_equipes_line_idx
  on public.campeonato_resultados_equipes (campeonato_equipe_id);

create table if not exists public.campeonato_resultados_jogadores (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  partida_id uuid not null references public.campeonato_partidas(id) on delete cascade,
  grupo_id uuid references public.campeonato_grupos(id) on delete set null,
  campeonato_equipe_id uuid not null references public.campeonato_equipes(id) on delete cascade,
  campeonato_jogador_id uuid not null references public.campeonato_jogadores(id) on delete cascade,
  jogador_id uuid references public.jogadores(id) on delete set null,
  equipe_id uuid references public.equipes(id) on delete set null,
  line_id uuid references public.equipe_lines(id) on delete set null,
  nick_snapshot text not null,
  id_jogo_snapshot text not null,
  abates integer not null default 0,
  dano integer not null default 0,
  assistencias integer not null default 0,
  revives integer not null default 0,
  origem text not null default 'manual',
  raw_player_name text,
  criado_por uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campeonato_resultados_jogadores_abates_check check (abates >= 0),
  constraint campeonato_resultados_jogadores_origem_check check (origem = any (array['manual', 'matchresult', 'importacao']::text[]))
);

create unique index if not exists campeonato_resultados_jogadores_partida_jogador_unique
  on public.campeonato_resultados_jogadores (partida_id, campeonato_jogador_id);

create index if not exists campeonato_resultados_jogadores_filtro_sumula_idx
  on public.campeonato_resultados_jogadores (campeonato_id, fase_id, jogo_id, partida_id);

create index if not exists campeonato_resultados_jogadores_mvp_idx
  on public.campeonato_resultados_jogadores (campeonato_jogador_id);

create or replace function public.fn_garantir_partidas_campeonato_jogo(p_jogo_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_jogo record;
  v_total integer := 0;
  v_num integer;
begin
  select *
  into v_jogo
  from public.campeonato_jogos
  where id = p_jogo_id;

  if not found then
    raise exception 'Jogo nao encontrado.';
  end if;

  for v_num in
    select generate_series(1, greatest(coalesce(v_jogo.numero_partidas, 0), 0))
  loop
    insert into public.campeonato_partidas (
      campeonato_id,
      fase_id,
      jogo_id,
      numero_partida,
      mapa,
      data_jogo,
      horario,
      status
    )
    values (
      v_jogo.campeonato_id,
      v_jogo.fase_id,
      v_jogo.id,
      v_num,
      nullif(v_jogo.mapas[v_num], ''),
      v_jogo.data_jogo,
      v_jogo.horario,
      'agendada'
    )
    on conflict (jogo_id, numero_partida)
    do update set
      fase_id = excluded.fase_id,
      mapa = excluded.mapa,
      data_jogo = excluded.data_jogo,
      horario = excluded.horario,
      updated_at = now();

    v_total := v_total + 1;
  end loop;

  delete from public.campeonato_partidas
  where jogo_id = v_jogo.id
    and numero_partida > greatest(coalesce(v_jogo.numero_partidas, 0), 0)
    and not exists (
      select 1
      from public.campeonato_resultados_equipes resultado
      where resultado.partida_id = campeonato_partidas.id
    )
    and not exists (
      select 1
      from public.campeonato_resultados_jogadores resultado
      where resultado.partida_id = campeonato_partidas.id
    );

  return v_total;
end;
$$;

create or replace function public.fn_sync_campeonato_jogo_partidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fn_garantir_partidas_campeonato_jogo(new.id);
  return new;
end;
$$;

drop trigger if exists trg_sync_campeonato_jogo_partidas on public.campeonato_jogos;

create trigger trg_sync_campeonato_jogo_partidas
after insert or update of numero_partidas, mapas, fase_id, data_jogo, horario
on public.campeonato_jogos
for each row
execute function public.fn_sync_campeonato_jogo_partidas();

create or replace function public.fn_obter_ou_criar_campeonato_jogador(
  p_campeonato_id uuid,
  p_campeonato_equipe_id uuid,
  p_nick text,
  p_id_jogo text,
  p_funcao text default null,
  p_origem text default 'matchresult',
  p_criado_por uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_participacao record;
  v_jogador_id uuid;
  v_campeonato_jogador_id uuid;
  v_permite_multiplas boolean := false;
  v_origem text;
  v_id_jogo text;
begin
  v_id_jogo := nullif(trim(coalesce(p_id_jogo, '')), '');
  if p_campeonato_id is null then
    raise exception 'campeonato_id obrigatorio';
  end if;
  if p_campeonato_equipe_id is null then
    raise exception 'campeonato_equipe_id obrigatorio';
  end if;
  if v_id_jogo is null then
    raise exception 'id_jogo obrigatorio';
  end if;

  v_origem := coalesce(nullif(trim(p_origem), ''), 'matchresult');
  if v_origem not in ('manual', 'token', 'link', 'equipe', 'sumula', 'matchresult', 'temporario') then
    v_origem := 'matchresult';
  end if;

  select *
  into v_participacao
  from public.campeonato_equipes
  where id = p_campeonato_equipe_id
    and campeonato_id = p_campeonato_id
    and status = 'ativo'
  limit 1;

  if not found then
    raise exception 'Line/vaga do campeonato nao encontrada.';
  end if;

  select coalesce(permite_jogador_multiplas_equipes, false)
  into v_permite_multiplas
  from public.campeonato_configuracoes
  where campeonato_id = p_campeonato_id;

  select id
  into v_jogador_id
  from public.jogadores
  where id_jogo = v_id_jogo
    and status = 'ativo'
  limit 1;

  if not v_permite_multiplas and exists (
    select 1
    from public.campeonato_jogadores existente
    where existente.campeonato_id = p_campeonato_id
      and existente.id_jogo = v_id_jogo
      and existente.status <> 'deletado'
      and existente.campeonato_equipe_id is distinct from p_campeonato_equipe_id
  ) then
    raise exception 'Este jogador ja esta inscrito em outra line deste campeonato.';
  end if;

  select id
  into v_campeonato_jogador_id
  from public.campeonato_jogadores
  where campeonato_id = p_campeonato_id
    and campeonato_equipe_id = p_campeonato_equipe_id
    and id_jogo = v_id_jogo
    and status <> 'deletado'
  limit 1;

  if v_campeonato_jogador_id is null then
    insert into public.campeonato_jogadores (
      campeonato_id,
      equipe_id,
      jogador_id,
      nick,
      foto_url,
      id_jogo,
      funcao,
      status,
      campeonato_equipe_id,
      line_id,
      origem,
      criado_automaticamente,
      criado_por
    )
    values (
      p_campeonato_id,
      v_participacao.equipe_id,
      v_jogador_id,
      coalesce(nullif(trim(p_nick), ''), v_id_jogo),
      null,
      v_id_jogo,
      coalesce(nullif(trim(p_funcao), ''), 'support'),
      'ativo',
      p_campeonato_equipe_id,
      v_participacao.line_id,
      v_origem,
      true,
      p_criado_por
    )
    returning id into v_campeonato_jogador_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'campeonato_jogador_id', v_campeonato_jogador_id,
    'jogador_id', v_jogador_id,
    'campeonato_equipe_id', p_campeonato_equipe_id,
    'id_jogo', v_id_jogo
  );
end;
$$;

create or replace view public.campeonato_classificacao_lines as
select
  resultado.campeonato_id,
  resultado.fase_id,
  resultado.grupo_id,
  resultado.campeonato_equipe_id,
  participacao.equipe_id,
  participacao.line_id,
  coalesce(participacao.nome_exibicao, line.nome, equipe.nome) as nome_exibicao,
  equipe.nome as equipe_nome,
  equipe.tag as equipe_tag,
  equipe.logo_url as equipe_logo_url,
  line.nome as line_nome,
  line.tag as line_tag,
  line.logo_url as line_logo_url,
  count(distinct resultado.partida_id)::integer as quedas,
  count(*) filter (where resultado.booyah)::integer as booyahs,
  sum(resultado.abates)::integer as abates,
  sum(resultado.pontos_posicao) as pontos_posicao,
  sum(resultado.pontos_abates) as pontos_abates,
  sum(resultado.pontos_total) as pontos_total,
  min(resultado.posicao) as melhor_posicao,
  max(resultado.updated_at) as updated_at
from public.campeonato_resultados_equipes resultado
join public.campeonato_equipes participacao on participacao.id = resultado.campeonato_equipe_id
left join public.equipes equipe on equipe.id = participacao.equipe_id
left join public.equipe_lines line on line.id = participacao.line_id
group by
  resultado.campeonato_id,
  resultado.fase_id,
  resultado.grupo_id,
  resultado.campeonato_equipe_id,
  participacao.equipe_id,
  participacao.line_id,
  participacao.nome_exibicao,
  equipe.nome,
  equipe.tag,
  equipe.logo_url,
  line.nome,
  line.tag,
  line.logo_url;

create or replace view public.campeonato_classificacao_mvp as
select
  resultado.campeonato_id,
  resultado.fase_id,
  resultado.grupo_id,
  resultado.campeonato_equipe_id,
  resultado.campeonato_jogador_id,
  jogador.jogador_id,
  jogador.equipe_id,
  jogador.line_id,
  coalesce(jogador.nick, resultado.nick_snapshot) as nick,
  coalesce(jogador.id_jogo, resultado.id_jogo_snapshot) as id_jogo,
  jogador.foto_url,
  jogador.origem,
  count(distinct resultado.partida_id)::integer as quedas,
  sum(resultado.abates)::integer as abates,
  sum(resultado.dano)::integer as dano,
  sum(resultado.assistencias)::integer as assistencias,
  sum(resultado.revives)::integer as revives,
  max(resultado.updated_at) as updated_at
from public.campeonato_resultados_jogadores resultado
join public.campeonato_jogadores jogador on jogador.id = resultado.campeonato_jogador_id
group by
  resultado.campeonato_id,
  resultado.fase_id,
  resultado.grupo_id,
  resultado.campeonato_equipe_id,
  resultado.campeonato_jogador_id,
  jogador.jogador_id,
  jogador.equipe_id,
  jogador.line_id,
  jogador.nick,
  resultado.nick_snapshot,
  jogador.id_jogo,
  resultado.id_jogo_snapshot,
  jogador.foto_url,
  jogador.origem;

alter table public.campeonato_partidas enable row level security;
alter table public.matchresult_vinculos_equipes enable row level security;
alter table public.campeonato_resultados_equipes enable row level security;
alter table public.campeonato_resultados_jogadores enable row level security;
