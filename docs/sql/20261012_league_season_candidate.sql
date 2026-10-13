-- CANDIDATE ONLY, NOT APPLIED. Requires Liga/rejoin/mirror/permissions/participation candidates.
-- Uses the saved current public detail view; all selected additions and receipts commit together.
-- Ordinary DML guards coordinate source/target snapshots. Row-lock inversions may abort with 40P01.
begin;
create table public.liga_season_recibos(
 actor_id uuid not null references auth.users(id),request_id uuid not null,campeonato_id uuid not null references public.campeonatos(id),
 previous_championship_id uuid not null references public.campeonatos(id),fingerprint text not null,resultado jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
alter table public.liga_season_recibos enable row level security;
revoke all on public.liga_season_recibos from public,anon,authenticated,service_role;
grant select on public.liga_season_recibos to service_role;

create function public.dz_season_write_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare a jsonb;b jsonb;v uuid;
begin
 if TG_OP<>'INSERT' then a:=to_jsonb(OLD);end if;if TG_OP<>'DELETE' then b:=to_jsonb(NEW);end if;
 if TG_TABLE_NAME='campeonato_edicoes' then
  for v in select distinct value::uuid from (select a->>'franquia_id' value union all select b->>'franquia_id') x where value is not null order by 1 loop
   perform pg_advisory_xact_lock(hashtextextended('season:franchise:'||v::text,0));
  end loop;
 end if;
 for v in select distinct value::uuid from (select a->>'campeonato_id' value union all select b->>'campeonato_id') x where value is not null order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('season:champ:'||v::text,0));
 end loop;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger dz_season_participant_guard before insert or update or delete on public.campeonato_equipes for each row execute function public.dz_season_write_guard();
create trigger dz_season_slot_guard before insert or update or delete on public.campeonato_slots for each row execute function public.dz_season_write_guard();
create trigger dz_season_group_guard before insert or update or delete on public.campeonato_grupos for each row execute function public.dz_season_write_guard();
create trigger dz_season_phase_guard before insert or update or delete on public.campeonato_fases for each row execute function public.dz_season_write_guard();
create trigger dz_season_config_guard before insert or update or delete on public.campeonato_configuracoes for each row execute function public.dz_season_write_guard();
create trigger dz_season_result_guard before insert or update or delete on public.campeonato_resultados_equipes for each row execute function public.dz_season_write_guard();
create trigger dz_season_edition_guard before insert or update or delete on public.campeonato_edicoes for each row execute function public.dz_season_write_guard();
create trigger dz_season_block_guard before insert or update or delete on public.campeonato_grupo_escolha_bloqueios for each row execute function public.dz_season_write_guard();

create function public.dz_season_quantity(value jsonb) returns bigint
language plpgsql immutable set search_path=pg_catalog as $fn$
declare n numeric;raw text;
begin
 raw:=value#>>'{}';
 if jsonb_typeof(value)='number' then n:=raw::numeric;
 elsif jsonb_typeof(value)='string' and btrim(raw) ~ '^[0-9]+$' then n:=btrim(raw)::numeric;
 else raise exception using errcode='22023',message='Quantidade da temporada inválida.';end if;
 if n<0 or n<>trunc(n) or n>9007199254740991 then raise exception using errcode='22023',message='Quantidade da temporada inválida.';end if;
 return n::bigint;
end;
$fn$;
create function public.dz_season_normalize_plan(value jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare d jsonb;e jsonb;out jsonb:='[]';entries jsonb;ids text[]:='{}';names text[]:='{}';name text;total bigint;
begin
 if jsonb_typeof(value) is distinct from 'array' or jsonb_array_length(value) not between 1 and 100 then raise exception using errcode='22023',message='Plano da temporada inválido.';end if;
 for d in select * from jsonb_array_elements(value) loop
  name:=lower(btrim(d->>'nome'));
  if jsonb_typeof(d->'nome') is distinct from 'string' or coalesce(d->>'id','')='' or coalesce(name,'')='' or d->>'id'=any(ids) or name=any(names)
   or jsonb_typeof(d->'entradas') is distinct from 'array' or jsonb_array_length(d->'entradas')>100 then raise exception using errcode='22023',message='Agrupamento da temporada ambíguo.';end if;
  ids:=array_append(ids,d->>'id');names:=array_append(names,name);entries:='[]';total:=0;
  for e in select * from jsonb_array_elements(d->'entradas') loop
   if coalesce(e->>'tipo','') not in('mantida','promovida','rebaixada','classificatoria_aberta','vaga_paga','convite_direto') then raise exception using errcode='22023',message='Origem da temporada inválida.';end if;
   total:=total+public.dz_season_quantity(e->'quantidade');if total>9007199254740991 then raise exception using errcode='22003',message='Limite de quantidade da temporada.';end if;
   entries:=entries||jsonb_build_array(jsonb_build_object('id',coalesce(e->>'id',''),'tipo',e->>'tipo','quantidade',public.dz_season_quantity(e->'quantidade')::text,'origem_agrupamento_id',coalesce(e->>'origem_agrupamento_id','')));
  end loop;
  out:=out||jsonb_build_array(jsonb_build_object('id',d->>'id','nome',d->>'nome','codigo',coalesce(d->>'codigo',''),'equipes',public.dz_season_quantity(d->'equipes')::text,'entradas',entries));
 end loop;
 return out;
end;
$fn$;

create function public.dz_season_plan(p_actor uuid,p_camp uuid,p_prepare boolean default true) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare
 ce public.campeonato_edicoes%rowtype;pe public.campeonato_edicoes%rowtype;fr uuid;v uuid;
 cc public.campeonato_configuracoes%rowtype;pc public.campeonato_configuracoes%rowtype;
 cp jsonb;pp jsonb;cg jsonb;pg jsonb;slots jsonb;parts jsonb;phases jsonb;blocks jsonb;rankings jsonb:='{}';needed text[]:='{}';
 promoted jsonb:='{}';relegated jsonb:='{}';po jsonb:='{}';ro jsonb:='{}';d jsonb;e jsonb;sd jsonb;g jsonb;rank jsonb;row jsonb;
 source text;kind text;q bigint;off bigint;floor bigint;ceiling bigint;last bigint;first bigint;selected jsonb;suggestions jsonb:='[]';pending jsonb:='[]';
 target_group uuid;free jsonb;used bigint;candidate jsonb;teams uuid[]:='{}';lines uuid[]:='{}';line_images jsonb;team_images jsonb;
 source_fence jsonb;target_structure jsonb;target_fence jsonb;
begin
 select * into ce from public.campeonato_edicoes where campeonato_id=p_camp;
 if not found or ce.numero_edicao<=1 then raise exception using errcode='22023',message='Temporada anterior indisponível.';end if;
 fr:=ce.franquia_id;perform pg_advisory_xact_lock(hashtextextended('season:franchise:'||fr::text,0));
 select * into ce from public.campeonato_edicoes where campeonato_id=p_camp;
 if not found or ce.franquia_id is distinct from fr then raise exception using errcode='40001',message='A edição mudou.';end if;
 select * into pe from public.campeonato_edicoes where franquia_id=fr and numero_edicao<ce.numero_edicao order by numero_edicao desc,id limit 1;
 if not found or pe.campeonato_id=p_camp then raise exception using errcode='22023',message='Temporada anterior indisponível.';end if;
 for v in select value from unnest(array[p_camp,pe.campeonato_id]) value order by value loop
  perform pg_advisory_xact_lock(hashtextextended('season:champ:'||v::text,0));
 end loop;
 perform public.dz_assert_slot_permission(p_actor,p_camp,'manage');perform public.dz_assert_slot_permission(p_actor,pe.campeonato_id,'manage');
 if exists(select 1 from public.campeonatos where id in(p_camp,pe.campeonato_id) and tipo is distinct from 'liga') then raise exception using errcode='22023',message='Temporada disponível somente para Ligas.';end if;
 select * into cc from public.campeonato_configuracoes where campeonato_id=p_camp;
 select * into pc from public.campeonato_configuracoes where campeonato_id=pe.campeonato_id;
 cp:=public.dz_season_normalize_plan(cc.liga_divisoes);pp:=public.dz_season_normalize_plan(pc.liga_divisoes);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'fase_id',fase_id,'nome',nome,'updated_at',updated_at) order by id),'[]') into cg from public.campeonato_grupos where campeonato_id=p_camp;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'fase_id',fase_id,'nome',nome,'updated_at',updated_at) order by id),'[]') into pg from public.campeonato_grupos where campeonato_id=pe.campeonato_id;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'nome',nome,'ordem',ordem,'updated_at',updated_at) order by id),'[]') into phases from public.campeonato_fases where campeonato_id=p_camp;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'fase_id',fase_id,'grupo_id',grupo_id,'slot_numero',slot_numero,'slot_letra',slot_letra,'equipe_id',equipe_id,'line_id',line_id,'status',status,'updated_at',updated_at) order by slot_numero,id),'[]') into slots from public.campeonato_slots where campeonato_id=p_camp;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'fase_id',fase_id,'grupo_id',grupo_id,'slot_id',slot_id,'ativo',ativo,'created_at',created_at,'removed_at',removed_at) order by id),'[]') into blocks from public.campeonato_grupo_escolha_bloqueios where campeonato_id=p_camp and ativo;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'equipe_id',equipe_id,'line_id',line_id,'status',status,'slot_id',slot_id,'grupo_id',grupo_id,'origem_entrada',origem_entrada,'updated_at',updated_at) order by id),'[]') into parts from public.campeonato_equipes where campeonato_id=p_camp;
 if jsonb_array_length(slots)>5000 or jsonb_array_length(cg)>1000 or jsonb_array_length(pg)>1000 or jsonb_array_length(parts)>5000 then raise exception using errcode='54000',message='Temporada excede o limite de leitura.';end if;
 if p_prepare and (exists(select 1 from jsonb_array_elements(parts) x where x->>'status'='ativo') or exists(select 1 from jsonb_array_elements(slots) x where x->>'status'='reservado')) then
  raise exception using errcode='23514',message='A temporada já possui equipes ou reservas.';
 end if;
 for d in select * from jsonb_array_elements(cp) loop
  for e in select * from jsonb_array_elements(d->'entradas') loop
   kind:=e->>'tipo';q:=public.dz_season_quantity(e->'quantidade');if q=0 or kind not in('mantida','promovida','rebaixada') then continue;end if;
   source:=case when kind='mantida' then d->>'id' else e->>'origem_agrupamento_id' end;
   if not(source=any(needed)) then needed:=array_append(needed,source);end if;
   if kind='promovida' then promoted:=promoted||jsonb_build_object(source,coalesce((promoted->>source)::bigint,0)+q);
   elsif kind='rebaixada' then relegated:=relegated||jsonb_build_object(source,coalesce((relegated->>source)::bigint,0)+q);end if;
  end loop;
 end loop;
 if exists(select 1 from jsonb_each_text(promoted) where value::numeric>9007199254740991) or exists(select 1 from jsonb_each_text(relegated) where value::numeric>9007199254740991) then raise exception using errcode='22003',message='Limite de quantidade da temporada.';end if;
 if (select count(*)>50000 from public.campeonato_estatisticas_equipes_detalhe where campeonato_id=pe.campeonato_id) then raise exception using errcode='54000',message='Classificação excede o limite de leitura.';end if;
 foreach source in array needed loop
  select value into sd from jsonb_array_elements(pp) where value->>'id'=source;
  if sd is null or (select count(*) from jsonb_array_elements(pg) x where lower(btrim(x->>'nome'))=lower(btrim(sd->>'nome')))<>1 then raise exception using errcode='23514',message='Origem da temporada ausente ou ambígua.';end if;
  select value into g from jsonb_array_elements(pg) where lower(btrim(value->>'nome'))=lower(btrim(sd->>'nome'));
  if exists(select 1 from public.campeonato_estatisticas_equipes_detalhe x left join public.campeonato_equipes c on c.id=x.campeonato_equipe_id
   where x.campeonato_id=pe.campeonato_id and x.grupo_id=(g->>'id')::uuid and c.campeonato_id is distinct from pe.campeonato_id) then raise exception using errcode='23514',message='Classificação fora da temporada.';end if;
  with totals as (
   select x.campeonato_equipe_id,min(x.resultado_id::text) first_result,count(*)::integer quedas,sum(case when x.booyah then 1 else 0 end)::integer booyahs,
    sum(coalesce(x.abates,0)::double precision order by resultado_id) abates,sum(coalesce(x.pontos_posicao,0)::double precision order by resultado_id) pontos_posicao,
    sum(coalesce(x.pontos_abates,0)::double precision order by resultado_id) pontos_abates,sum(coalesce(x.pontos_total,0)::double precision order by resultado_id) pontos_total,min(coalesce(x.posicao,0)) melhor_posicao
   from public.campeonato_estatisticas_equipes_detalhe x where campeonato_id=pe.campeonato_id and grupo_id=(g->>'id')::uuid group by x.campeonato_equipe_id
  ),r as(select t.*,row_number() over(order by pontos_total desc,booyahs desc,abates desc,coalesce(melhor_posicao,999),first_result) colocacao from totals t),
  display as(select distinct on(x.campeonato_equipe_id) x.* from public.campeonato_estatisticas_equipes_detalhe x where campeonato_id=pe.campeonato_id and grupo_id=(g->>'id')::uuid order by campeonato_equipe_id,resultado_id)
  select coalesce(jsonb_agg((to_jsonb(r)-'first_result')||jsonb_build_object('equipe_id',x.equipe_id,'line_id',x.line_id,'nome',coalesce(nullif(x.nome_exibicao,''),nullif(x.line_nome,''),nullif(x.equipe_nome,''),'Equipe'),
   'tag',coalesce(nullif(x.line_tag,''),nullif(x.equipe_tag,'')),'logo_url',coalesce(nullif(x.line_logo_url,''),nullif(x.equipe_logo_url,'')),'grupo_id',x.grupo_id,'line_public_id',l.public_id) order by r.colocacao),'[]') into rank
  from r join display x using(campeonato_equipe_id) left join public.equipe_lines l on l.id=x.line_id;
  if jsonb_array_length(rank)>1000 or exists(select 1 from jsonb_array_elements(rank) x where x->>'pontos_total' in('NaN','Infinity','-Infinity')) then raise exception using errcode='54000',message='Classificação inválida ou excessiva.';end if;
  rankings:=rankings||jsonb_build_object(source,rank);
 end loop;
 for d in select * from jsonb_array_elements(cp) loop
  for e in select * from jsonb_array_elements(d->'entradas') loop
   kind:=e->>'tipo';q:=public.dz_season_quantity(e->'quantidade');if q=0 or kind not in('mantida','promovida','rebaixada') then continue;end if;
   source:=case when kind='mantida' then d->>'id' else e->>'origem_agrupamento_id' end;rank:=rankings->source;
   select value into sd from jsonb_array_elements(pp) where value->>'id'=source;
   floor:=coalesce((promoted->>source)::bigint,0);ceiling:=greatest(0,jsonb_array_length(rank)-coalesce((relegated->>source)::bigint,0));
   if kind='promovida' then off:=coalesce((po->>source)::bigint,0);first:=off;last:=least(off+q,ceiling);po:=po||jsonb_build_object(source,off+q);
   elsif kind='rebaixada' then off:=coalesce((ro->>source)::bigint,0);last:=greatest(floor,jsonb_array_length(rank)-off);first:=greatest(floor,last-q);ro:=ro||jsonb_build_object(source,off+q);
   else first:=floor;last:=least(greatest(floor,ceiling),floor+q);end if;
   selected:='[]';
   for row in select value from jsonb_array_elements(rank) with ordinality x(value,n) where n>first and n<=last order by n loop
    if row->>'equipe_id' is null or row->>'line_id' is null or (row->>'equipe_id')::uuid=any(teams) or (row->>'line_id')::uuid=any(lines) then raise exception using errcode='23514',message='Equipe ou line duplicada nas sugestões.';end if;
    teams:=array_append(teams,(row->>'equipe_id')::uuid);lines:=array_append(lines,(row->>'line_id')::uuid);
    selected:=selected||jsonb_build_array(jsonb_build_object('equipe_id',row->'equipe_id','line_id',row->'line_id','nome',row->'nome','tag',row->'tag','logo_url',row->'logo_url','colocacao',row->'colocacao','grupo_origem_nome',sd->>'nome'));
   end loop;
   suggestions:=suggestions||jsonb_build_array(jsonb_build_object('divisao_id',d->>'id','divisao_nome',d->>'nome','tipo',kind,'origem_divisao_id',source,'origem_divisao_nome',sd->>'nome','quantidade_planejada',q,'candidatos',selected));
   if not p_prepare then continue;end if;
   if (select count(*) from jsonb_array_elements(cg) x where lower(btrim(x->>'nome'))=lower(btrim(d->>'nome')))<>1 then raise exception using errcode='23514',message='Destino da temporada ausente ou ambíguo.';end if;
   select (value->>'id')::uuid into target_group from jsonb_array_elements(cg) where lower(btrim(value->>'nome'))=lower(btrim(d->>'nome'));
   select coalesce(jsonb_agg(value order by n),'[]') into free from jsonb_array_elements(slots) with ordinality x(value,n)
    where (value->>'grupo_id')::uuid=target_group and value->>'status'='livre' and value->>'equipe_id' is null and value->>'line_id' is null
     and not exists(select 1 from jsonb_array_elements(blocks) block where block->>'slot_id'=x.value->>'id'
      or (block->>'slot_id' is null and block->>'grupo_id'=x.value->>'grupo_id')
      or (block->>'slot_id' is null and block->>'grupo_id' is null and block->>'fase_id'=x.value->>'fase_id'));
   select count(*) into used from jsonb_array_elements(pending) x where x->>'grupo_id'=target_group::text;
   if jsonb_array_length(free)-used<jsonb_array_length(selected) then raise exception using errcode='23514',message='Slots livres insuficientes na temporada.';end if;
   off:=used;
   for candidate in select * from jsonb_array_elements(selected) loop
    pending:=pending||jsonb_build_array(candidate||jsonb_build_object('slot_id',free->off::integer->>'id','grupo_id',target_group,'origem_entrada',kind));off:=off+1;
   end loop;
  end loop;
 end loop;
 if cardinality(teams)>1000 then raise exception using errcode='54000',message='Temporada excede o limite de aplicação.';end if;
 perform 1 from public.equipes where id=any(teams) order by id for share;
 perform 1 from public.equipe_lines where id=any(lines) order by id for share;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'equipe_id',equipe_id,'nome',nome,'tag',tag,'logo_url',logo_url,'status',status,'updated_at',updated_at) order by id),'[]') into line_images from public.equipe_lines where id=any(lines);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'nome',nome,'tag',tag,'logo_url',logo_url,'status',status,'updated_at',updated_at) order by id),'[]') into team_images from public.equipes where id=any(teams);
 source_fence:=jsonb_build_object('championship',(select jsonb_build_object('id',id,'tipo',tipo,'produtora_id',produtora_id,'status',status,'aprovacao_status',aprovacao_status,'updated_at',updated_at) from public.campeonatos where id=pe.campeonato_id),
  'edition',to_jsonb(pe),'configuration',jsonb_build_object('id',pc.id,'plan',pp,'updated_at',pc.updated_at),'groups',pg,'rankings',rankings,'lines',line_images,'teams',team_images);
 target_structure:=jsonb_build_object('championship',(select jsonb_build_object('id',id,'tipo',tipo,'produtora_id',produtora_id,'status',status,'aprovacao_status',aprovacao_status,'updated_at',updated_at) from public.campeonatos where id=p_camp),
  'edition',to_jsonb(ce),'configuration',jsonb_build_object('id',cc.id,'plan',cp,'updated_at',cc.updated_at),'groups',cg,'phases',phases,'blocks',blocks);
 target_fence:=target_structure||jsonb_build_object('slots',slots,'participations',parts);
 return jsonb_build_object('previous_championship_id',pe.campeonato_id,'previous_edition_number',pe.numero_edicao,'previous_season',pe.temporada,'previous_title',pe.titulo_publico,
  'current_edition_number',ce.numero_edicao,'current_season',ce.temporada,'suggestions',suggestions,'pending',pending,'source_fence',source_fence,'target_structure',target_structure,'fence',jsonb_build_object('source',source_fence,'target',target_fence));
end;
$fn$;

create function public.fn_operar_liga_season_atomica(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_action text,p_expected jsonb default null) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $fn$
declare plan jsonb;receipt public.liga_season_recibos%rowtype;fingerprint text;candidate jsonb;child uuid;item jsonb;results jsonb:='[]';out jsonb;after jsonb;count bigint;
begin
 set local lock_timeout='3s';
 if coalesce(auth.role(),current_setting('role',true))<>'service_role' then raise exception using errcode='42501',message='Operação somente pelo backend.';end if;
 if p_actor_id is null or p_campeonato_id is null or p_action is null or p_action not in('preview','apply') or (p_action='apply' and (p_request_id is null or jsonb_typeof(p_expected) is distinct from 'object'))
  or octet_length(coalesce(p_expected,'{}')::text)>4194304 then raise exception using errcode='22023',message='Dados da temporada inválidos.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 if p_action='preview' then plan:=public.dz_season_plan(p_actor_id,p_campeonato_id);return jsonb_build_object('ok',true,'actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'season_action','preview','preview',plan);end if;
 perform pg_advisory_xact_lock(hashtextextended('season:request:'||p_actor_id::text||':'||p_request_id::text,0));
 fingerprint:=encode(extensions.digest(jsonb_build_object('championship',p_campeonato_id,'expected',p_expected)::text,'sha256'),'hex');
 select * into receipt from public.liga_season_recibos where actor_id=p_actor_id and request_id=p_request_id;
 if found then
  if receipt.fingerprint<>fingerprint or receipt.campeonato_id<>p_campeonato_id then raise exception using errcode='23505',message='Chave da temporada vinculada a outros dados.';end if;
  perform public.dz_assert_slot_permission(p_actor_id,receipt.previous_championship_id,'manage');return receipt.resultado||jsonb_build_object('repetida',true);
 end if;
 plan:=public.dz_season_plan(p_actor_id,p_campeonato_id);
 if plan->'fence' is distinct from p_expected then raise exception using errcode='40001',message='A classificação ou estrutura da temporada mudou.';end if;
 count:=jsonb_array_length(plan->'pending');if count=0 then raise exception using errcode='23514',message='Nenhuma sugestão disponível para aplicar.';end if;
 if exists(select 1 from jsonb_array_elements(plan->'suggestions') x where jsonb_array_length(x->'candidatos')<(x->>'quantidade_planejada')::bigint) then raise exception using errcode='23514',message='Classificação insuficiente para as cotas da temporada.';end if;
 for candidate in select * from jsonb_array_elements(plan->'pending') loop
  child:=md5('season:'||p_actor_id::text||':'||p_request_id::text||':'||(candidate->>'line_id'))::uuid;
  if exists(select 1 from public.participacao_recibos where actor_id=p_actor_id and request_id=child) then raise exception using errcode='23505',message='Chave interna da temporada já utilizada.';end if;
  item:=public.fn_gravar_participacao_atomica(p_actor_id,child,p_campeonato_id,'add',jsonb_build_object('equipe_id',candidate->'equipe_id','line_id',candidate->'line_id','slot_id',candidate->'slot_id','nome_line',null,'origem_entrada',candidate->'origem_entrada'));
  if not coalesce((item->>'ok')::boolean,false) then raise exception using errcode='23514',message='Inclusão da temporada incompleta.';end if;
  results:=results||jsonb_build_array(jsonb_build_object('request_id',child,'participacao',item->'participacao'));
 end loop;
 out:=jsonb_build_object('ok',true,'operation_confirmed',true,'actor_id',p_actor_id,'request_id',p_request_id,'campeonato_id',p_campeonato_id,'season_action','apply','previous_championship_id',plan->'previous_championship_id','aplicadas',count,'participacoes',results);
 insert into public.liga_season_recibos values(p_actor_id,p_request_id,p_campeonato_id,(plan->>'previous_championship_id')::uuid,fingerprint,out,now());
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');perform public.dz_assert_slot_permission(p_actor_id,(plan->>'previous_championship_id')::uuid,'manage');
 after:=public.dz_season_plan(p_actor_id,p_campeonato_id,false);
 if after->'source_fence' is distinct from plan->'source_fence' or after->'target_structure' is distinct from plan->'target_structure' then raise exception using errcode='23514',message='Estrutura ou classificação mudou durante a confirmação.';end if;
 for item in select * from jsonb_array_elements(results) loop
  if (select to_jsonb(c) from public.campeonato_equipes c where id=(item->'participacao'->>'id')::uuid) is distinct from item->'participacao'
   or not exists(select 1 from public.campeonato_slots where id=(item->'participacao'->>'slot_id')::uuid and campeonato_id=p_campeonato_id and status='ocupado'
    and equipe_id=(item->'participacao'->>'equipe_id')::uuid and line_id=(item->'participacao'->>'line_id')::uuid) then raise exception using errcode='23514',message='Participação ou slot mudou durante a confirmação.';end if;
 end loop;
 return out;
end;
$fn$;
revoke all on function public.dz_season_write_guard(),public.dz_season_quantity(jsonb),public.dz_season_normalize_plan(jsonb),public.dz_season_plan(uuid,uuid,boolean),public.fn_operar_liga_season_atomica(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.fn_operar_liga_season_atomica(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
