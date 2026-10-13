-- CANDIDATE ONLY. NOT APPLIED. Requires reviewed dz_assert_slot_permission.
-- Private revision covers supported input writers, including ordinary legacy DML.
-- Row/advisory lock inversions with other candidates can abort; retry only an
-- unchanged UUID/body after a known-aborted transaction, never compensate.
begin;

create table public.lifecycle_versoes (
 campeonato_id uuid primary key references public.campeonatos(id) on delete cascade deferrable initially deferred,
 revisao bigint not null check(revisao between 0 and 9007199254740991)
);
create table public.lifecycle_publicacoes (
 id uuid primary key, campeonato_id uuid not null references public.campeonatos(id), edicao_id uuid not null,
 actor_id uuid not null references auth.users(id), anterior jsonb not null, posterior jsonb not null,
 plano jsonb not null, reaberta boolean not null default false, apos_reabertura jsonb,
 created_at timestamptz not null default now()
);
create unique index lifecycle_publicacao_aberta on public.lifecycle_publicacoes(campeonato_id) where not reaberta;
create table public.lifecycle_recibos (
 actor_id uuid not null references auth.users(id), request_id uuid not null, campeonato_id uuid not null references public.campeonatos(id),
 fingerprint text not null, resultado jsonb not null, created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
alter table public.lifecycle_versoes enable row level security;
alter table public.lifecycle_publicacoes enable row level security;
alter table public.lifecycle_recibos enable row level security;
revoke all on public.lifecycle_versoes,public.lifecycle_publicacoes,public.lifecycle_recibos from public,anon,authenticated,service_role;
grant select on public.lifecycle_versoes,public.lifecycle_publicacoes,public.lifecycle_recibos to service_role;

create function public.dz_lifecycle_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare a jsonb;b jsonb;ed_ids uuid[];ids uuid[];again uuid[];v uuid;
begin
 if TG_OP<>'INSERT' then a:=to_jsonb(OLD);end if;if TG_OP<>'DELETE' then b:=to_jsonb(NEW);end if;
 if TG_TABLE_NAME in('campeonato_etapas','campeonato_divisoes') then
  ed_ids:=array[(a->>'edicao_id')::uuid,(b->>'edicao_id')::uuid];
  select array_agg(distinct campeonato_id order by campeonato_id) into ids from public.campeonato_edicoes where id=any(ed_ids);
 else
  select array_agg(distinct value::uuid order by value::uuid) into ids from (
   select case when TG_TABLE_NAME='campeonatos' then a->>'id' else a->>'campeonato_id' end value
   union all select case when TG_TABLE_NAME='campeonatos' then b->>'id' else b->>'campeonato_id' end
  ) x where value is not null;
 end if;
 foreach v in array coalesce(ids,'{}') loop
  perform pg_advisory_xact_lock(hashtextextended('lifecycle:champ:'||v::text,0));
 end loop;
 if ed_ids is not null then
  select array_agg(distinct campeonato_id order by campeonato_id) into again from public.campeonato_edicoes where id=any(ed_ids);
  if again is distinct from ids then raise exception using errcode='40001',message='O campeonato da estrutura mudou.';end if;
 end if;
 foreach v in array coalesce(ids,'{}') loop
  insert into public.lifecycle_versoes(campeonato_id,revisao) values(v,1)
   on conflict(campeonato_id) do update set revisao=lifecycle_versoes.revisao+1;
 end loop;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
-- z ordering preserves earlier season/edition/progression trigger coordination.
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonatos for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_edicoes for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_etapas for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_divisoes for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_configuracoes for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_fases for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_grupos for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_jogos for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_partidas for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_resultados_equipes for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_equipes for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_fases_configuracoes for each row execute function public.dz_lifecycle_guard();
create trigger zz_dz_lifecycle_guard before insert or update or delete on public.campeonato_fases_bonus_equipes for each row execute function public.dz_lifecycle_guard();

create function public.dz_lifecycle_image(p_camp uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare ed public.campeonato_edicoes%rowtype;out jsonb;
begin
 select * into ed from public.campeonato_edicoes where campeonato_id=p_camp;
 if not found then raise exception using errcode='22023',message='Cadastre a edição antes de encerrar.';end if;
 if (select count(*)>1000 from public.campeonato_etapas where edicao_id=ed.id)
  or (select count(*)>1000 from public.campeonato_divisoes where edicao_id=ed.id) then raise exception using errcode='54000',message='Estrutura excede o limite de encerramento.';end if;
 select jsonb_build_object('edition',to_jsonb(ed),
  'stages',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.campeonato_etapas s where s.edicao_id=ed.id),'[]'),
  'divisions',coalesce((select jsonb_agg(to_jsonb(d) order by d.id) from public.campeonato_divisoes d where d.edicao_id=ed.id),'[]'),
  'config',(select to_jsonb(c) from public.campeonato_configuracoes c where c.campeonato_id=p_camp),
  'revision',coalesce((select revisao from public.lifecycle_versoes where campeonato_id=p_camp),0)) into out;
 if out->'config'='null' or out->'config' is null or octet_length(out::text)>4194304 then raise exception using errcode='54000',message='Configuração ausente ou estrutura excessiva.';end if;
 return out;
end;
$fn$;

create function public.dz_lifecycle_ranking(p_camp uuid,p_phase uuid default null,p_game uuid default null,p_group uuid default null,p_bonus boolean default false) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare ranking jsonb;
begin
 with totals as (
  select r.campeonato_equipe_id,min(r.id::text) first_result,count(*)::integer quedas,
   sum(case when r.booyah then 1 else 0 end)::integer booyahs,
   sum(r.abates::double precision order by r.id) abates,
   sum(r.pontos_total::double precision order by r.id) pontos_total,min(r.posicao) melhor_posicao
  from public.campeonato_resultados_equipes r where r.campeonato_id=p_camp
   and(p_phase is null or r.fase_id=p_phase) and(p_game is null or r.jogo_id=p_game) and(p_group is null or r.grupo_id=p_group)
  group by r.campeonato_equipe_id
 ),bonus as (
  select t.*,t.pontos_total+coalesce(b.pontos_bonus::double precision,0) final_points
  from totals t left join public.campeonato_fases_bonus_equipes b on p_bonus and b.campeonato_id=p_camp and b.fase_id=p_phase and b.campeonato_equipe_id=t.campeonato_equipe_id
 ),ranked as (
  select b.*,row_number() over(order by final_points desc,booyahs desc,abates desc,coalesce(melhor_posicao,999),first_result) colocacao from bonus b
 ) select coalesce(jsonb_agg((to_jsonb(x)-'first_result'-'final_points'-'pontos_total')||jsonb_build_object('pontos_total',x.final_points) order by colocacao),'[]') into ranking from ranked x;
 if jsonb_array_length(ranking)>1000 or exists(select 1 from jsonb_array_elements(ranking) x where x->>'pontos_total' in('NaN','Infinity','-Infinity') or x->>'abates' in('NaN','Infinity','-Infinity')) then raise exception using errcode='54000',message='Classificação inválida ou excessiva.';end if;
 return ranking;
end;
$fn$;

create function public.dz_lifecycle_plan(p_camp uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare kind text;ed public.campeonato_edicoes%rowtype;cfg public.campeonato_fases_configuracoes%rowtype;
 fase uuid;decisive uuid;champion uuid;champion_name text;ranking jsonb;groups jsonb:='[]';g record;r record;fall record;
 total bigint;points jsonb:='{}';before_points double precision;bonus_mode boolean:=false;gold boolean:=false;winner_fall uuid;seen int:=0;out jsonb;
begin
 select tipo into kind from public.campeonatos where id=p_camp;
 kind:=lower(coalesce(kind,''));
 select * into ed from public.campeonato_edicoes where campeonato_id=p_camp;
 if ed.id is null or ed.status not in('ativa','planejada') then raise exception using errcode='22023',message='A edição não está disponível para encerramento.';end if;
 if(select count(*)>50000 from public.campeonato_resultados_equipes where campeonato_id=p_camp)
  or(select count(*)>5000 from public.campeonato_partidas where campeonato_id=p_camp)
  or(select count(*)>1000 from public.campeonato_grupos where campeonato_id=p_camp) then raise exception using errcode='54000',message='Campeonato excede o limite de encerramento.';end if;
 select count(*) into total from public.campeonato_partidas where campeonato_id=p_camp;
 if total=0 or exists(select 1 from public.campeonato_partidas where campeonato_id=p_camp and status<>'finalizada') then raise exception using errcode='22023',message='Finalize todas as quedas antes de encerrar.';end if;
 if exists(select 1 from public.campeonato_partidas p left join public.campeonato_jogos j on j.id=p.jogo_id left join public.campeonato_fases f on f.id=p.fase_id
  where p.campeonato_id=p_camp and(j.campeonato_id is distinct from p_camp or p.fase_id is distinct from j.fase_id or(p.fase_id is not null and f.campeonato_id is distinct from p_camp))) then raise exception using errcode='23514',message='Quedas com referências incompatíveis.';end if;
 if exists(select 1 from public.campeonato_etapas s join public.campeonato_edicoes e on e.id=s.edicao_id left join public.campeonato_divisoes d on d.id=s.divisao_id
  where e.campeonato_id=p_camp and s.divisao_id is not null and d.edicao_id is distinct from e.id) then raise exception using errcode='23514',message='Etapa com divisão incompatível.';end if;
 if exists(select 1 from public.campeonato_fases_bonus_equipes b left join public.campeonato_equipes e on e.id=b.campeonato_equipe_id left join public.campeonato_fases f on f.id=b.fase_id
  where b.campeonato_id=p_camp and(e.campeonato_id is distinct from p_camp or f.campeonato_id is distinct from p_camp or b.pontos_bonus::text in('NaN','Infinity','-Infinity'))) then raise exception using errcode='23514',message='Bônus com referências incompatíveis.';end if;
 -- Use raw authoritative result values, and reject mismatched parents hidden by view joins.
 if exists(select 1 from public.campeonato_resultados_equipes x
  left join public.campeonato_partidas p on p.id=x.partida_id left join public.campeonato_jogos j on j.id=x.jogo_id
  left join public.campeonato_equipes e on e.id=x.campeonato_equipe_id left join public.campeonato_fases f on f.id=x.fase_id
  left join public.campeonato_grupos g0 on g0.id=x.grupo_id
  where x.campeonato_id=p_camp and(p.campeonato_id is distinct from p_camp or j.campeonato_id is distinct from p_camp or e.campeonato_id is distinct from p_camp
   or p.jogo_id is distinct from x.jogo_id or p.fase_id is distinct from x.fase_id or j.fase_id is distinct from x.fase_id
   or(x.fase_id is not null and f.campeonato_id is distinct from p_camp) or(x.grupo_id is not null and g0.campeonato_id is distinct from p_camp)
   or x.pontos_total::text in('NaN','Infinity','-Infinity'))) then raise exception using errcode='23514',message='Resultados com referências incompatíveis.';end if;
 if kind='liga' then
  for g in select id,nome from public.campeonato_grupos where campeonato_id=p_camp order by id loop
   ranking:=public.dz_lifecycle_ranking(p_camp,null,null,g.id);
   if ranking='[]' then raise exception using errcode='22023',message='Agrupamento da Liga sem classificação.';end if;
   groups:=groups||jsonb_build_array(jsonb_build_object('id',g.id,'nome',g.nome,'total_equipes',jsonb_array_length(ranking),'ranking',ranking));
  end loop;
  if groups='[]' then raise exception using errcode='22023',message='Liga sem agrupamentos.';end if;
  select sum((x->>'total_equipes')::integer) into seen from jsonb_array_elements(groups) x;
 else
  if(select count(*)>1 from public.campeonato_fases where campeonato_id=p_camp and tipo='grande_final') then raise exception using errcode='22023',message='Grande Final ambígua.';end if;
  select id into fase from public.campeonato_fases where campeonato_id=p_camp and tipo='grande_final';
  if fase is not null then
   if not exists(select 1 from public.campeonato_partidas where campeonato_id=p_camp and fase_id=fase) then raise exception using errcode='22023',message='Grande Final sem quedas.';end if;
   select * into cfg from public.campeonato_fases_configuracoes where campeonato_id=p_camp and fase_id=fase;
   bonus_mode:=coalesce(cfg.modo_acumulacao,'acumulado')='bonus_por_ranking';
   if bonus_mode then
    decisive:=cfg.jogo_decisivo_id;
    if decisive is null or not exists(select 1 from public.campeonato_jogos where id=decisive and campeonato_id=p_camp and fase_id=fase) then raise exception using errcode='22023',message='Jogo decisivo inválido.';end if;
   end if;
   if cfg.modo_decisao='booyah_ouro' and(cfg.booyah_ouro_queda_minima is not null or cfg.booyah_ouro_desempate_final<>'maior_pontuacao') then raise exception using errcode='22023',message='Configuração de Booyah Ouro exige revisão antes de encerrar.';end if;
  end if;
  ranking:=public.dz_lifecycle_ranking(p_camp,fase,decisive,null,bonus_mode);
  if ranking='[]' then raise exception using errcode='22023',message='Classificação final ausente.';end if;
  select count(distinct campeonato_equipe_id) into seen from public.campeonato_resultados_equipes where campeonato_id=p_camp and(fase is null or fase_id=fase);
  champion:=(ranking->0->>'campeonato_equipe_id')::uuid;
  if cfg.modo_decisao='booyah_ouro' and coalesce(cfg.booyah_ouro_pontos_limite,0)>0 then
   if bonus_mode then
    select coalesce(jsonb_object_agg(campeonato_equipe_id::text,pontos_bonus::double precision),'{}') into points from public.campeonato_fases_bonus_equipes where campeonato_id=p_camp and fase_id=fase;
   end if;
   for fall in select p.id from public.campeonato_partidas p join public.campeonato_jogos j on j.id=p.jogo_id
    where p.campeonato_id=p_camp and p.fase_id=fase and(not bonus_mode or p.jogo_id=decisive)
    order by j.dia_final,j.data_jogo,j.id,p.numero_partida,p.id loop
    for r in select * from public.campeonato_resultados_equipes where campeonato_id=p_camp and partida_id=fall.id order by id loop
     before_points:=coalesce((points->>r.campeonato_equipe_id::text)::double precision,0);
     if r.booyah and before_points>=cfg.booyah_ouro_pontos_limite then champion:=r.campeonato_equipe_id;winner_fall:=fall.id;gold:=true;exit;end if;
    end loop;
    exit when gold;
    for r in select * from public.campeonato_resultados_equipes where campeonato_id=p_camp and partida_id=fall.id order by id loop
     points:=jsonb_set(points,array[r.campeonato_equipe_id::text],to_jsonb(coalesce((points->>r.campeonato_equipe_id::text)::double precision,0)+r.pontos_total::double precision));
    end loop;
   end loop;
   if not exists(select 1 from jsonb_array_elements(ranking) x where x->>'campeonato_equipe_id'=champion::text) then raise exception using errcode='23514',message='Campeão incompatível com a classificação.';end if;
  end if;
  select coalesce(nullif(e.nome_exibicao,''),nullif(l.nome,''),nullif(t.nome,''),'Equipe') into champion_name from public.campeonato_equipes e left join public.equipe_lines l on l.id=e.line_id left join public.equipes t on t.id=e.equipe_id where e.id=champion;
 end if;
 out:=jsonb_build_object('falls',total,'total_equipes',seen,'groups',groups,'ranking',case when kind='liga' then '[]'::jsonb else ranking end,
  'champion_id',champion,'champion_name',champion_name,'phase_id',fase,'decisive_game_id',decisive,'gold_reached',gold,'winner_fall_id',winner_fall);
 if octet_length(out::text)>4194304 then raise exception using errcode='54000',message='Classificação excede o limite.';end if;
 return out;
end;
$fn$;

create function public.fn_lifecycle_atomico(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_action text,p_expected jsonb default '{}') returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $fn$
declare receipt public.lifecycle_recibos%rowtype;publication public.lifecycle_publicacoes%rowtype;
 ed public.campeonato_edicoes%rowtype;fr uuid;ed_id uuid;fingerprint text;image jsonb;after_image jsonb;plan jsonb;fence jsonb;metadata jsonb;out jsonb;pub_id uuid;
 stamped timestamptz;before_row jsonb;after_row jsonb;wanted jsonb;kind text;publishing boolean;preview boolean;
begin
 set local lock_timeout='3s';
 if coalesce(auth.role(),current_setting('role',true))<>'service_role' then raise exception using errcode='42501',message='Operação somente pelo backend.';end if;
 if p_actor_id is null or p_request_id is null or p_campeonato_id is null or p_action is null
  or p_action not in('preview_publish_final','preview_reopen_final','publish_final','reopen_final')
  or jsonb_typeof(p_expected) is distinct from 'object' or octet_length(p_expected::text)>8192 then raise exception using errcode='22023',message='Confirmação de encerramento inválida.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 preview:=p_action in('preview_publish_final','preview_reopen_final');publishing:=p_action in('preview_publish_final','publish_final');
 perform pg_advisory_xact_lock(hashtextextended('lifecycle:request:'||p_actor_id::text||':'||p_request_id::text,0));
 fingerprint:=encode(extensions.digest(jsonb_build_object('championship',p_campeonato_id,'action',p_action,'expected',p_expected)::text,'sha256'),'hex');
 if not preview then
  select * into receipt from public.lifecycle_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
   if receipt.fingerprint<>fingerprint or receipt.campeonato_id<>p_campeonato_id then raise exception using errcode='23505',message='Chave usada para outra confirmação.';end if;
   perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
   return receipt.resultado||jsonb_build_object('repetida',true);
  end if;
 end if;
 select id,franquia_id into ed_id,fr from public.campeonato_edicoes where campeonato_id=p_campeonato_id;
 if ed_id is null then raise exception using errcode='22023',message='Edição não encontrada.';end if;
 perform pg_advisory_xact_lock(hashtextextended('season:franchise:'||fr::text,0));
 perform pg_advisory_xact_lock(hashtextextended('edition:champ:'||p_campeonato_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('season:champ:'||p_campeonato_id::text,0));
 perform pg_advisory_xact_lock(hashtextextended('lifecycle:champ:'||p_campeonato_id::text,0));
 select * into ed from public.campeonato_edicoes where campeonato_id=p_campeonato_id;
 if ed.id is distinct from ed_id or ed.franquia_id is distinct from fr then raise exception using errcode='40001',message='A edição ou a franquia mudou.';end if;
 image:=public.dz_lifecycle_image(p_campeonato_id);
 if jsonb_typeof(image->'edition'->'metadados') is distinct from 'object' then raise exception using errcode='22023',message='Metadados da edição exigem revisão.';end if;
 select * into publication from public.lifecycle_publicacoes where campeonato_id=p_campeonato_id and not reaberta;
 if publishing then
  if publication.id is not null then raise exception using errcode='40001',message='Já existe publicação vigente.';end if;
  plan:=public.dz_lifecycle_plan(p_campeonato_id);
 else
  if ed.status<>'encerrada' or publication.id is null or publication.edicao_id<>ed.id then raise exception using errcode='22023',message='Publicação histórica sem imagem de restauração ou edição não encerrada.';end if;
  if image is distinct from publication.posterior then raise exception using errcode='40001',message='Dados alterados após a publicação; concilie antes de reabrir.';end if;
  plan:=publication.plano;
 end if;
 fence:=jsonb_build_object('edition_id',ed.id,'revision',image->'revision','publication_id',publication.id,
  'plan_hash',encode(extensions.digest(jsonb_build_object('image',image,'plan',plan,'publication',publication.id)::text,'sha256'),'hex'));
 if preview then
  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
  return jsonb_build_object('mode','atomic','actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'request_id',p_request_id,'action',p_action,
   'preview',jsonb_build_object('fence',fence,'edition',jsonb_build_object('id',ed.id,'status',ed.status,'data_fim',ed.data_fim),
    'plan',plan,'stages',jsonb_array_length(image->'stages'),'divisions',jsonb_array_length(image->'divisions')));
 end if;
 if p_expected is distinct from fence then raise exception using errcode='40001',message='Atualize e confira a prévia de encerramento.';end if;
 stamped:=clock_timestamp();
 if publishing then
  pub_id:=gen_random_uuid();
  metadata:=ed.metadados||jsonb_build_object('final_publicado_em',stamped,'final_publicado_por',p_actor_id,'final_publicacao_id',pub_id,
   'final_total_equipes',plan->'total_equipes','final_campeao_campeonato_equipe_id',plan->'champion_id');
  update public.campeonato_etapas set status='encerrada',updated_at=stamped where edicao_id=ed.id and status not in('encerrada','cancelada');
  update public.campeonato_divisoes set status='encerrada',updated_at=stamped where edicao_id=ed.id and status not in('encerrada','cancelada');
  update public.campeonato_edicoes set status='encerrada',data_fim=(stamped at time zone 'UTC')::date,metadados=metadata,updated_at=stamped where id=ed.id and campeonato_id=p_campeonato_id;
  update public.campeonato_configuracoes set aceita_novas_inscricoes_equipes=false where campeonato_id=p_campeonato_id and aceita_novas_inscricoes_equipes;
 else
  pub_id:=publication.id;
  -- User rule: activate ALL closed stages/divisions; registrations remain closed.
  metadata:=(publication.anterior->'edition'->'metadados')||jsonb_build_object('final_publicado_em',null,'final_publicado_por',null,'final_publicacao_id',null,
   'final_total_equipes',null,'final_campeao_campeonato_equipe_id',null,'final_reaberto_em',stamped,'final_reaberto_por',p_actor_id);
  update public.campeonato_etapas set status='ativa',updated_at=stamped where edicao_id=ed.id and status='encerrada';
  update public.campeonato_divisoes set status='ativa',updated_at=stamped where edicao_id=ed.id and status='encerrada';
  update public.campeonato_edicoes set status='ativa',data_fim=null,metadados=metadata,updated_at=stamped where id=ed.id and campeonato_id=p_campeonato_id;
 end if;
 after_image:=public.dz_lifecycle_image(p_campeonato_id);
 wanted:=((image->'edition')-'status'-'data_fim'-'metadados'-'updated_at')||jsonb_build_object('status',case when publishing then 'encerrada' else 'ativa' end,
  'data_fim',case when publishing then to_jsonb((stamped at time zone 'UTC')::date) else 'null'::jsonb end,'metadados',metadata);
 if (after_image->'edition')-'updated_at' is distinct from wanted then raise exception using errcode='40001',message='Pós-condição da edição falhou.';end if;
 if publishing and (image->'config'->>'aceita_novas_inscricoes_equipes')::boolean then
  wanted:=((image->'config')-'updated_at')||jsonb_build_object('aceita_novas_inscricoes_equipes',false);
  if (after_image->'config')-'updated_at' is distinct from wanted then raise exception using errcode='40001',message='Pós-condição das inscrições falhou.';end if;
 else
  if after_image->'config' is distinct from image->'config' then raise exception using errcode='40001',message='Configuração modificada inesperadamente.';end if;
 end if;
 foreach kind in array array['stages','divisions'] loop
  if jsonb_array_length(after_image->kind)<>jsonb_array_length(image->kind) then raise exception using errcode='40001',message='Estrutura modificada inesperadamente.';end if;
  for before_row in select value from jsonb_array_elements(image->kind) loop
   select value into after_row from jsonb_array_elements(after_image->kind) where value->>'id'=before_row->>'id';
   if publishing then
    wanted:=before_row||jsonb_build_object('status',case when before_row->>'status'='cancelada' then 'cancelada' else 'encerrada' end);
   else
    wanted:=before_row||jsonb_build_object('status',case when before_row->>'status'='encerrada' then 'ativa' else before_row->>'status' end);
   end if;
   if before_row->>'status'=wanted->>'status' then
    if after_row is distinct from wanted then raise exception using errcode='40001',message='Estado preservado foi alterado.';end if;
   elsif after_row-'updated_at' is distinct from wanted-'updated_at' then raise exception using errcode='40001',message='Pós-condição da estrutura falhou.';end if;
  end loop;
 end loop;
 if publishing then
  insert into public.lifecycle_publicacoes(id,campeonato_id,edicao_id,actor_id,anterior,posterior,plano) values(pub_id,p_campeonato_id,ed.id,p_actor_id,image,after_image,plan);
 else
  update public.lifecycle_publicacoes set reaberta=true,apos_reabertura=after_image where id=pub_id and not reaberta;
  if not found then raise exception using errcode='40001',message='A publicação já foi reaberta.';end if;
 end if;
 out:=jsonb_build_object('mode','atomic','actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'request_id',p_request_id,'action',p_action,
  'operation_confirmed',true,'repetida',false,'publication_id',pub_id,'revision',after_image->'revision',
  'edition',jsonb_build_object('id',ed.id,'campeonato_id',p_campeonato_id,'status',after_image->'edition'->'status','data_fim',after_image->'edition'->'data_fim'),
  'registrations_open',false,'total_equipes',plan->'total_equipes','champion_id',case when publishing then plan->'champion_id' else 'null'::jsonb end);
 if public.dz_lifecycle_image(p_campeonato_id) is distinct from after_image then raise exception using errcode='40001',message='Dados mudaram depois da auditoria.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 insert into public.lifecycle_recibos(actor_id,request_id,campeonato_id,fingerprint,resultado) values(p_actor_id,p_request_id,p_campeonato_id,fingerprint,out);
 if public.dz_lifecycle_image(p_campeonato_id) is distinct from after_image then raise exception using errcode='40001',message='Dados mudaram depois do recibo.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 return out;
end;
$fn$;
revoke execute on function public.dz_lifecycle_guard(),public.dz_lifecycle_image(uuid),public.dz_lifecycle_ranking(uuid,uuid,uuid,uuid,boolean),public.dz_lifecycle_plan(uuid),public.fn_lifecycle_atomico(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.fn_lifecycle_atomico(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
