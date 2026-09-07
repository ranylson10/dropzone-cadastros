-- R11: ingestão única, idempotente e transacional do resultado final do DPZ Live Engine.

create table if not exists public.dpz_engine_resultados (
  id uuid primary key default gen_random_uuid(),
  campeonato_id uuid not null references public.campeonatos(id) on delete cascade,
  fase_id uuid references public.campeonato_fases(id) on delete set null,
  jogo_id uuid not null references public.campeonato_jogos(id) on delete cascade,
  partida_id uuid not null references public.campeonato_partidas(id) on delete cascade,
  match_id text,
  idempotency_key text not null,
  payload_hash text not null,
  payload jsonb not null,
  source text not null default 'DPZ Live Engine',
  criado_por uuid references auth.users(id) on delete set null,
  processado_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint dpz_engine_resultados_source_check check (source = 'DPZ Live Engine'),
  constraint dpz_engine_resultados_idempotency_unique unique (campeonato_id, idempotency_key)
);

create unique index if not exists dpz_engine_resultados_partida_match_unique
  on public.dpz_engine_resultados(partida_id, match_id) where match_id is not null;

alter table public.garena_matchstats_importacoes
  add column if not exists consolidacao_oficial boolean not null default false,
  add column if not exists origem text not null default 'MatchStats Garena';

-- Conserva todas as linhas históricas e elege uma única consolidação oficial por partida/match.
with ranked as (
  select id, row_number() over (
    partition by partida_id, match_id
    order by (status = 'concluida') desc, concluida_em desc nulls last, created_at desc, id desc
  ) as ordem
  from public.garena_matchstats_importacoes
)
update public.garena_matchstats_importacoes importacao
set consolidacao_oficial = (ranked.ordem = 1 and importacao.status = 'concluida')
from ranked where ranked.id = importacao.id;

create unique index if not exists garena_matchstats_partida_match_oficial_unique
  on public.garena_matchstats_importacoes(partida_id, match_id) where consolidacao_oficial;

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
where importacao.status = 'concluida' and importacao.consolidacao_oficial
group by jogador.jogador_id, jogador.player_id;

create or replace function public.fn_ingerir_resultado_dpz_engine_v1(
  p_payload jsonb,
  p_payload_hash text,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campeonato_id uuid := (p_payload #>> '{context,campeonato_id}')::uuid;
  v_fase_id uuid := nullif(p_payload #>> '{context,fase_id}', '')::uuid;
  v_jogo_id uuid := (p_payload #>> '{context,jogo_id}')::uuid;
  v_partida_id uuid := (p_payload #>> '{context,partida_id}')::uuid;
  v_match_id text := nullif(btrim(p_payload->>'match_id'), '');
  v_key text := btrim(p_payload->>'idempotency_key');
  v_existing record;
  v_partida record;
  v_importacao_id uuid;
  v_player record;
  v_weapon jsonb;
  v_loadout jsonb;
  v_order integer;
begin
  if coalesce((p_payload->>'version')::integer, 0) <> 1 then raise exception 'Versao de resultado nao suportada.'; end if;
  if v_key = '' or jsonb_array_length(coalesce(p_payload->'teams', '[]'::jsonb)) = 0 then raise exception 'Resultado sem chave idempotente ou equipes.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_campeonato_id::text || ':' || v_key, 0));

  select * into v_existing from public.dpz_engine_resultados
  where campeonato_id = v_campeonato_id and idempotency_key = v_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash then raise exception 'Chave idempotente reutilizada com payload diferente.'; end if;
    return jsonb_build_object('ok', true, 'already_processed', true, 'result_id', v_existing.id,
      'partida_id', v_existing.partida_id, 'match_id', v_existing.match_id, 'processed_at', v_existing.processado_em);
  end if;

  if v_match_id is not null then
    select * into v_existing from public.dpz_engine_resultados where partida_id = v_partida_id and match_id = v_match_id;
    if found then
      if v_existing.payload_hash <> p_payload_hash then raise exception 'A partida/match ja possui outra consolidacao oficial.'; end if;
      return jsonb_build_object('ok', true, 'already_processed', true, 'result_id', v_existing.id,
        'partida_id', v_existing.partida_id, 'match_id', v_existing.match_id, 'processed_at', v_existing.processado_em);
    end if;
  end if;

  select id,campeonato_id,fase_id,jogo_id,grupo_id,status into v_partida
  from public.campeonato_partidas where id = v_partida_id for update;
  if not found or v_partida.campeonato_id <> v_campeonato_id or v_partida.jogo_id <> v_jogo_id
    or v_partida.fase_id is distinct from v_fase_id then raise exception 'Contexto competitivo nao corresponde a queda.'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_payload->'teams') as item(campeonato_equipe_id uuid, placement integer, kills integer)
    left join public.campeonato_equipes equipe on equipe.id=item.campeonato_equipe_id and equipe.campeonato_id=v_campeonato_id
    where equipe.id is null or item.placement is null or item.placement < 1 or item.kills is null or item.kills < 0
  ) then raise exception 'Equipe invalida ou fora do campeonato.'; end if;

  if exists (
    select 1 from jsonb_to_recordset(coalesce(p_payload->'players','[]'::jsonb)) as item(campeonato_jogador_id uuid, campeonato_equipe_id uuid, kills integer)
    left join public.campeonato_jogadores jogador on jogador.id=item.campeonato_jogador_id
      and jogador.campeonato_id=v_campeonato_id and jogador.campeonato_equipe_id=item.campeonato_equipe_id
    where jogador.id is null or item.kills is null or item.kills < 0
  ) then raise exception 'Jogador invalido, duplicado ou fora da equipe.'; end if;

  insert into public.campeonato_resultados_equipes (
    campeonato_id,fase_id,jogo_id,partida_id,grupo_id,campeonato_equipe_id,equipe_id,line_id,slot_numero,
    posicao,abates,booyah,origem,raw_team_name,observacoes,criado_por,updated_at
  )
  select v_campeonato_id,v_fase_id,v_jogo_id,v_partida_id,coalesce(equipe.grupo_id,v_partida.grupo_id),equipe.id,equipe.equipe_id,equipe.line_id,equipe.slot_numero,
    item.placement,item.kills,item.placement=1,'importacao',item.nome,'Ingestao oficial: DPZ Live Engine',p_user_id,now()
  from jsonb_to_recordset(p_payload->'teams') as item(campeonato_equipe_id uuid,placement integer,kills integer,nome text)
  join public.campeonato_equipes equipe on equipe.id=item.campeonato_equipe_id
  on conflict (partida_id,campeonato_equipe_id) do update set
    posicao=excluded.posicao,abates=excluded.abates,booyah=excluded.booyah,origem='importacao',raw_team_name=excluded.raw_team_name,
    observacoes=excluded.observacoes,criado_por=excluded.criado_por,updated_at=now();

  insert into public.campeonato_resultados_jogadores (
    campeonato_id,fase_id,jogo_id,partida_id,grupo_id,campeonato_equipe_id,campeonato_jogador_id,jogador_id,equipe_id,line_id,
    nick_snapshot,id_jogo_snapshot,abates,dano,assistencias,revives,origem,raw_player_name,criado_por,updated_at
  )
  select v_campeonato_id,v_fase_id,v_jogo_id,v_partida_id,coalesce(equipe.grupo_id,v_partida.grupo_id),equipe.id,jogador.id,jogador.jogador_id,jogador.equipe_id,jogador.line_id,
    jogador.nick,jogador.id_jogo,item.kills,coalesce(item.damage,0),coalesce(item.assists,0),coalesce(item.revives,0),'importacao',item.nick,p_user_id,now()
  from jsonb_to_recordset(coalesce(p_payload->'players','[]'::jsonb)) as item(
    campeonato_jogador_id uuid,campeonato_equipe_id uuid,nick text,kills integer,damage integer,assists integer,revives integer)
  join public.campeonato_jogadores jogador on jogador.id=item.campeonato_jogador_id
  join public.campeonato_equipes equipe on equipe.id=item.campeonato_equipe_id
  on conflict (partida_id,campeonato_jogador_id) do update set
    abates=excluded.abates,dano=excluded.dano,assistencias=excluded.assistencias,revives=excluded.revives,
    origem='importacao',raw_player_name=excluded.raw_player_name,criado_por=excluded.criado_por,updated_at=now();

  if v_match_id is not null then
    select id,partida_id into v_existing from public.garena_matchstats_importacoes where match_id=v_match_id for update;
    if found and v_existing.partida_id <> v_partida_id then raise exception 'match_id ja pertence a outra partida.'; end if;
    insert into public.garena_matchstats_importacoes (
      campeonato_id,jogo_id,partida_id,match_id,nome_arquivo,status,total_jogadores,consulta_em,concluida_em,dados_brutos,criado_por,consolidacao_oficial,origem,updated_at
    ) values (
      v_campeonato_id,v_jogo_id,v_partida_id,v_match_id,'DPZ-Live-Engine-'||v_match_id||'.json','concluida',jsonb_array_length(coalesce(p_payload->'players','[]'::jsonb)),
      now(),now(),p_payload,p_user_id,true,'DPZ Live Engine',now()
    ) on conflict (match_id) do update set status='concluida',total_jogadores=excluded.total_jogadores,consulta_em=now(),concluida_em=now(),
      dados_brutos=excluded.dados_brutos,criado_por=excluded.criado_por,consolidacao_oficial=true,origem='DPZ Live Engine',erro=null,updated_at=now()
    returning id into v_importacao_id;

    delete from public.garena_matchstats_armas where importacao_id=v_importacao_id;
    delete from public.garena_matchstats_habilidades where importacao_id=v_importacao_id;
    delete from public.garena_matchstats_jogadores where importacao_id=v_importacao_id;

    for v_player in
      select item.*, jogador.jogador_id, jogador.jogador_temporario_id, jogador.nick as nick_oficial
      from jsonb_to_recordset(coalesce(p_payload->'players','[]'::jsonb)) as item(
        campeonato_jogador_id uuid,campeonato_equipe_id uuid,player_id_externo text,nick text,kills integer,damage integer,assists integer,revives integer,
        headshots integer,knockdowns integer,survival_seconds integer,distance_moved integer,max_kill_distance integer)
      join public.campeonato_jogadores jogador on jogador.id=item.campeonato_jogador_id
    loop
      insert into public.garena_matchstats_jogadores (
        importacao_id,player_id,campeonato_jogador_id,jogador_id,jogador_temporario_id,campeonato_equipe_id,nick_snapshot,
        abates,assistencias,dano,headshots,knockdowns,sobrevivencia_segundos,distancia_movida,distancia_max_abate,revives,dados_brutos
      ) values (
        v_importacao_id,coalesce(v_player.player_id_externo,v_player.campeonato_jogador_id::text),v_player.campeonato_jogador_id,v_player.jogador_id,v_player.jogador_temporario_id,v_player.campeonato_equipe_id,
        coalesce(v_player.nick,v_player.nick_oficial),v_player.kills,coalesce(v_player.assists,0),coalesce(v_player.damage,0),coalesce(v_player.headshots,0),coalesce(v_player.knockdowns,0),
        coalesce(v_player.survival_seconds,0),coalesce(v_player.distance_moved,0),coalesce(v_player.max_kill_distance,0),coalesce(v_player.revives,0),to_jsonb(v_player)
      ) returning * into v_existing;

      v_order := 0;
      for v_weapon in select value from jsonb_array_elements(coalesce(p_payload->'weapons','[]'::jsonb))
        where value->>'campeonato_jogador_id'=v_player.campeonato_jogador_id::text
      loop
        v_order := v_order + 1;
        insert into public.garena_matchstats_armas(importacao_id,jogador_matchstats_id,player_id,ordem,weapon_id,arma,abates,dano,headshots,precisao_percentual,precisao_headshot_percentual,dados_brutos)
        values(v_importacao_id,v_existing.id,v_existing.player_id,v_order,v_weapon->>'weapon_id',v_weapon->>'weapon_name',coalesce((v_weapon->>'kills')::integer,0),
          coalesce((v_weapon->>'damage')::integer,0),coalesce((v_weapon->>'headshots')::integer,0),coalesce((v_weapon->>'accuracy')::numeric,0),coalesce((v_weapon->>'headshot_accuracy_rate')::numeric,0),v_weapon);
      end loop;

      select value into v_loadout from jsonb_array_elements(coalesce(p_payload->'loadouts','[]'::jsonb))
      where value->>'campeonato_jogador_id'=v_player.campeonato_jogador_id::text limit 1;
      if v_loadout is not null then
        insert into public.garena_matchstats_habilidades(importacao_id,jogador_matchstats_id,player_id,tipo,ordem,skill_id,personagem,habilidade,dados_brutos)
        values(v_importacao_id,v_existing.id,v_existing.player_id,'loadout',1,v_loadout->>'active_skill_id',v_loadout->>'active_character_name',v_loadout->>'active_skill_name',v_loadout);
      end if;
      v_loadout := null;
    end loop;
  end if;

  update public.campeonato_partidas set status='finalizada',updated_at=now() where id=v_partida_id;
  insert into public.dpz_engine_resultados(campeonato_id,fase_id,jogo_id,partida_id,match_id,idempotency_key,payload_hash,payload,criado_por)
  values(v_campeonato_id,v_fase_id,v_jogo_id,v_partida_id,v_match_id,v_key,p_payload_hash,p_payload,p_user_id)
  returning * into v_existing;

  return jsonb_build_object('ok',true,'already_processed',false,'result_id',v_existing.id,'partida_id',v_partida_id,
    'match_id',v_match_id,'processed_at',v_existing.processado_em);
end;
$$;

revoke all on table public.dpz_engine_resultados from anon, authenticated, public;
grant select,insert,update,delete on table public.dpz_engine_resultados to service_role;
revoke all on function public.fn_ingerir_resultado_dpz_engine_v1(jsonb,text,uuid) from public, anon, authenticated;
grant execute on function public.fn_ingerir_resultado_dpz_engine_v1(jsonb,text,uuid) to service_role;
