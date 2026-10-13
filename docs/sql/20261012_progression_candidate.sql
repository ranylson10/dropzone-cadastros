-- CANDIDATE ONLY. NOT APPLIED. Requires dz_assert_slot_permission and the current detail view.
-- Apply/reverse and their private receipts/images are one transaction. Service execution only.
-- Parent guards cover ordinary stage-link/phase/rule/result DML, including legacy API writers.
-- Row-trigger lock inversions can abort with 40P01; retry the same immutable request, never compensate.
-- Historical executions without these private images are deliberately refused by atomic reversal.
begin;

-- The current function references campeonatos.campeonato_id, which does not exist.
-- Refuse unknown definitions instead of replacing an unreviewed published validator.
do $guard$
declare v_definition text;
begin
  select pg_get_functiondef('public.fn_validar_campeonato_etapa_equipe_85c()'::regprocedure) into v_definition;
  if md5(v_definition) is distinct from '601c899761abdf8dafbd0878199187c1'
    or strpos(v_definition,'select ce.campeonato_id, e.capacidade_total')=0 then
    raise exception 'Definição de validação de etapa desconhecida; revisão necessária.';
  end if;
  execute replace(v_definition,'select ce.campeonato_id, e.capacidade_total','select ce.id, e.capacidade_total');
end;
$guard$;

alter table public.campeonato_etapa_equipes add column progressao_revisao bigint not null default 0
  check (progressao_revisao between 0 and 9007199254740991);
create table public.progressao_recibos (
  actor_id uuid not null references auth.users(id), request_id uuid not null,
  fingerprint text not null, resultado jsonb not null, created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
create table public.progressao_auditoria (
  execucao_id uuid primary key references public.campeonato_progressao_execucoes(id),
  campeonato_id uuid not null references public.campeonatos(id), origem_id uuid not null, destino_id uuid not null,
  execucao_aplicada jsonb not null, itens_aplicados jsonb not null, execucao_revertida jsonb,
  created_at timestamptz not null default now()
);
create table public.progressao_vinculos (
  execucao_id uuid not null references public.progressao_auditoria(execucao_id) deferrable initially deferred,
  campeonato_equipe_id uuid not null, etapa_id uuid not null, papel text not null check(papel in('origem','destino')),
  anterior jsonb, posterior jsonb, apos_reversao jsonb,
  primary key(execucao_id,campeonato_equipe_id,papel)
);
alter table public.progressao_recibos enable row level security;
alter table public.progressao_auditoria enable row level security;
alter table public.progressao_vinculos enable row level security;
revoke all on public.progressao_recibos,public.progressao_auditoria,public.progressao_vinculos from public,anon,authenticated,service_role;
grant select on public.progressao_recibos,public.progressao_auditoria,public.progressao_vinculos to service_role;

create function public.dz_progression_stage_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare v_old jsonb;v_new jsonb;v_ids uuid[];
begin
  if TG_OP<>'INSERT' then v_old:=to_jsonb(OLD);end if;
  if TG_OP<>'DELETE' then v_new:=to_jsonb(NEW);end if;
  select array_agg(distinct value::uuid order by value::uuid) into v_ids from (
    select v_old->>'etapa_id' value union all select v_new->>'etapa_id'
    union all select v_old->>'etapa_origem_id' union all select v_new->>'etapa_origem_id'
    union all select v_old->>'etapa_destino_id' union all select v_new->>'etapa_destino_id'
  ) ids where value is not null;
  perform 1 from public.campeonato_etapas where id=any(v_ids) order by id for no key update;
  if TG_TABLE_NAME='campeonato_etapa_equipes' then
    if TG_OP='INSERT' then NEW.progressao_revisao:=0;
    elsif TG_OP='UPDATE' then
      if OLD.progressao_revisao>=9007199254740991 then raise exception using errcode='22003',message='Limite de revisão do vínculo atingido.';end if;
      NEW.progressao_revisao:=OLD.progressao_revisao+1;
    end if;
  end if;
  if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger dz_progression_stage_guard before insert or update or delete on public.campeonato_etapa_equipes
  for each row execute function public.dz_progression_stage_guard();
create trigger dz_progression_phase_guard before insert or update or delete on public.campeonato_fases
  for each row execute function public.dz_progression_stage_guard();
create trigger dz_progression_rule_guard before insert or update or delete on public.campeonato_progressao_regras
  for each row execute function public.dz_progression_stage_guard();
create function public.dz_progression_result_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare v_old uuid;v_new uuid;
begin
  if TG_OP<>'INSERT' then v_old:=OLD.fase_id;end if;
  if TG_OP<>'DELETE' then v_new:=NEW.fase_id;end if;
  perform 1 from public.campeonato_fases where id in(v_old,v_new) order by id for no key update;
  if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger dz_progression_result_guard before insert or update or delete on public.campeonato_resultados_equipes
  for each row execute function public.dz_progression_result_guard();

-- Reversal checks the complete public execution/items journal. Ordinary legacy history writers
-- must acquire the same stage parents, including old/new execution or rule references.
create function public.dz_progression_history_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare v_old jsonb;v_new jsonb;v_rules uuid[];
begin
  if TG_OP<>'INSERT' then v_old:=to_jsonb(OLD);end if;
  if TG_OP<>'DELETE' then v_new:=to_jsonb(NEW);end if;
  if TG_TABLE_NAME='campeonato_progressao_execucoes' then
    v_rules:=array[(v_old->>'regra_id')::uuid,(v_new->>'regra_id')::uuid];
  else
    select array_agg(regra_id) into v_rules from public.campeonato_progressao_execucoes
      where id in((v_old->>'execucao_id')::uuid,(v_new->>'execucao_id')::uuid);
  end if;
  perform 1 from public.campeonato_etapas where id in (
    select etapa_origem_id from public.campeonato_progressao_regras where id=any(v_rules)
    union select etapa_destino_id from public.campeonato_progressao_regras where id=any(v_rules)
  ) order by id for no key update;
  if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger dz_progression_execution_guard before insert or update or delete on public.campeonato_progressao_execucoes
  for each row execute function public.dz_progression_history_guard();
create trigger dz_progression_item_guard before insert or update or delete on public.campeonato_progressao_execucao_itens
  for each row execute function public.dz_progression_history_guard();

create function public.dz_progression_plan(p_camp uuid,p_rule uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare
  r public.campeonato_progressao_regras%rowtype;s public.campeonato_etapas%rowtype;d public.campeonato_etapas%rowtype;
  f public.campeonato_fases%rowtype;v_source uuid;v_destination uuid;v_start bigint;v_end bigint;
  v_ranking jsonb;v_candidates jsonb;v_destination_links jsonb;v_destination_all jsonb;v_source_links jsonb;v_participants jsonb;
  v_selected bigint;v_new bigint;v_conflicts bigint;v_applied bigint;v_occupied bigint;v_available bigint;v_execution jsonb;
begin
  select * into r from public.campeonato_progressao_regras where id=p_rule;
  if not found or r.etapa_destino_id is null or r.etapa_origem_id=r.etapa_destino_id then
    raise exception using errcode='22023',message='Regra de progressão inválida.';
  end if;
  v_source:=r.etapa_origem_id;v_destination:=r.etapa_destino_id;
  perform 1 from public.campeonato_etapas where id in(v_source,v_destination) order by id for no key update;
  select * into r from public.campeonato_progressao_regras where id=p_rule for share;
  if not found or r.etapa_origem_id is distinct from v_source or r.etapa_destino_id is distinct from v_destination then
    raise exception using errcode='40001',message='A regra mudou. Atualize a prévia.';
  end if;
  select * into s from public.campeonato_etapas where id=v_source;
  select * into d from public.campeonato_etapas where id=v_destination;
  perform 1 from public.campeonato_edicoes where id in(s.edicao_id,d.edicao_id) order by id for share;
  if s.id is null or d.id is null or not exists(select 1 from public.campeonato_edicoes where id=s.edicao_id and campeonato_id=p_camp)
    or not exists(select 1 from public.campeonato_edicoes where id=d.edicao_id and campeonato_id=p_camp) then
    raise exception using errcode='22023',message='Regra fora deste campeonato.';
  end if;
  v_start:=coalesce(r.posicao_inicio,1);
  if v_start<1 or (r.quantidade is not null and r.quantidade<1) then raise exception using errcode='22023',message='Faixa de progressão inválida.';end if;
  v_end:=coalesce(r.posicao_fim,case when r.quantidade is null then v_start else v_start+r.quantidade::bigint-1 end);
  if v_end<v_start or v_end>9007199254740991 or d.capacidade_total<0 then raise exception using errcode='22023',message='Faixa ou capacidade inválida.';end if;
  select * into f from public.campeonato_fases where campeonato_id=p_camp and etapa_id=s.id order by ordem desc,id limit 1 for share;
  if not found then raise exception using errcode='22023',message='Vincule uma fase com resultados à etapa de origem.';end if;
  if (select count(*)>50000 from public.campeonato_estatisticas_equipes_detalhe where campeonato_id=p_camp and fase_id=f.id) then
    raise exception using errcode='54000',message='A classificação excede o limite de leitura.';
  end if;
  if exists(select 1 from public.campeonato_estatisticas_equipes_detalhe x left join public.campeonato_equipes ce on ce.id=x.campeonato_equipe_id
    where x.campeonato_id=p_camp and x.fase_id=f.id and ce.campeonato_id is distinct from p_camp) then
    raise exception using errcode='23514',message='Classificação incompatível com o campeonato.';
  end if;
  -- Match the existing JS stable sort: aggregate in resultado_id order, then first occurrence on a complete tie.
  with totals as (
    select x.campeonato_equipe_id,min(x.resultado_id::text) first_result,
      count(*)::integer quedas,sum(case when x.booyah then 1 else 0 end)::integer booyahs,
      sum(coalesce(x.abates,0)::double precision order by x.resultado_id) abates,
      sum(coalesce(x.pontos_posicao,0)::double precision order by x.resultado_id) pontos_posicao,
      sum(coalesce(x.pontos_abates,0)::double precision order by x.resultado_id) pontos_abates,
      sum(coalesce(x.pontos_total,0)::double precision order by x.resultado_id) pontos_total,
      min(coalesce(x.posicao,0)) melhor_posicao
    from public.campeonato_estatisticas_equipes_detalhe x where x.campeonato_id=p_camp and x.fase_id=f.id group by x.campeonato_equipe_id
  ),ranked as (
    select t.*,row_number() over(order by pontos_total desc,booyahs desc,abates desc,coalesce(melhor_posicao,999),first_result) colocacao
    from totals t
  ),display as (
    select distinct on(x.campeonato_equipe_id) x.* from public.campeonato_estatisticas_equipes_detalhe x
    where x.campeonato_id=p_camp and x.fase_id=f.id order by x.campeonato_equipe_id,x.resultado_id
  )
  select coalesce(jsonb_agg((to_jsonb(t)-'first_result')||jsonb_build_object('equipe_id',x.equipe_id,'line_id',x.line_id,
    'nome',coalesce(nullif(x.nome_exibicao,''),nullif(x.line_nome,''),nullif(x.equipe_nome,''),'Equipe'),
    'tag',coalesce(nullif(x.line_tag,''),nullif(x.equipe_tag,'')),'logo_url',coalesce(nullif(x.line_logo_url,''),nullif(x.equipe_logo_url,'')),
    'grupo_id',x.grupo_id,'line_public_id',l.public_id) order by t.colocacao),'[]'::jsonb) into v_ranking
  from ranked t join display x using(campeonato_equipe_id) left join public.equipe_lines l on l.id=x.line_id;
  if jsonb_array_length(v_ranking)>1000 or exists(select 1 from jsonb_array_elements(v_ranking) x
    where x->>'pontos_total' in('NaN','Infinity','-Infinity') or x->>'abates' in('NaN','Infinity','-Infinity')) then
    raise exception using errcode='54000',message='A classificação exige revisão antes da progressão.';
  end if;
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into v_destination_all
    from public.campeonato_etapa_equipes x where etapa_id=d.id and campeonato_id=p_camp;
  select coalesce(jsonb_agg(x),'[]'::jsonb) into v_destination_links from jsonb_array_elements(v_destination_all) x where x->>'status'<>'retirada';
  if exists(select 1 from public.campeonato_etapa_equipes where etapa_id in(s.id,d.id) and campeonato_id is distinct from p_camp)
    or jsonb_array_length(v_destination_all)>2000 then raise exception using errcode='23514',message='Vínculos de etapa incompatíveis.';end if;
  select coalesce(jsonb_agg(x||jsonb_build_object('alreadyApplied',coalesce(y->>'regra_progressao_id'=p_rule::text,false),
    'conflict',y is not null and y->>'regra_progressao_id' is distinct from p_rule::text,'existingDestination',y) order by (x->>'colocacao')::integer),'[]'::jsonb)
    into v_candidates from jsonb_array_elements(v_ranking) x left join lateral
      (select y from jsonb_array_elements(v_destination_links) y where y->>'campeonato_equipe_id'=x->>'campeonato_equipe_id') dest on true
    where (x->>'colocacao')::bigint between v_start and v_end;
  perform 1 from public.campeonato_equipes where id in(select (x->>'campeonato_equipe_id')::uuid from jsonb_array_elements(v_candidates) x) order by id for share;
  if exists(select 1 from jsonb_array_elements(v_candidates) x left join public.campeonato_equipes ce on ce.id=(x->>'campeonato_equipe_id')::uuid
    where ce.campeonato_id is distinct from p_camp or ce.status is distinct from 'ativo') then
    raise exception using errcode='23514',message='Participação alterada ou inativa. Atualize a prévia.';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',ce.id,'campeonato_id',ce.campeonato_id,'equipe_id',ce.equipe_id,'line_id',ce.line_id,'status',ce.status,'updated_at',ce.updated_at) order by ce.id),'[]'::jsonb)
    into v_participants from public.campeonato_equipes ce where id in(select (x->>'campeonato_equipe_id')::uuid from jsonb_array_elements(v_candidates) x);
  select coalesce(jsonb_agg(to_jsonb(x) order by x.id),'[]'::jsonb) into v_source_links from public.campeonato_etapa_equipes x
    where etapa_id=s.id and campeonato_id=p_camp and campeonato_equipe_id in(select (x->>'campeonato_equipe_id')::uuid from jsonb_array_elements(v_candidates) x);
  select count(*),count(*) filter(where not (x->>'alreadyApplied')::boolean and not (x->>'conflict')::boolean),
    count(*) filter(where (x->>'conflict')::boolean),count(*) filter(where (x->>'alreadyApplied')::boolean)
    into v_selected,v_new,v_conflicts,v_applied from jsonb_array_elements(v_candidates) x;
  v_occupied:=jsonb_array_length(v_destination_links);v_available:=case when d.capacidade_total is null then null else greatest(0,d.capacidade_total-v_occupied) end;
  select jsonb_build_object('id',x.id,'regra_id',x.regra_id,'status',x.status,'created_at',x.created_at) into v_execution
    from public.campeonato_progressao_execucoes x where campeonato_id=p_camp and regra_id=p_rule and status='aplicada' order by created_at desc,id limit 1;
  return jsonb_build_object('rule',to_jsonb(r)||jsonb_build_object('origem',to_jsonb(s),'destino',to_jsonb(d)),
    'phase',to_jsonb(f),'candidates',v_candidates,'activeExecution',v_execution,
    'summary',jsonb_build_object('selected',v_selected,'newCount',v_new,'conflictCount',v_conflicts,'alreadyApplied',v_applied,
      'capacity',d.capacidade_total,'occupied',v_occupied,'available',v_available,'canApply',(v_available is null or v_new<=v_available) and v_conflicts=0),
    'fence',jsonb_build_object('rule',to_jsonb(r),'source',to_jsonb(s),'destination',to_jsonb(d),'phase',to_jsonb(f),
      'ranking',v_ranking,'source_links',v_source_links,'destination_links',v_destination_all,'participants',v_participants));
end;
$fn$;

create function public.fn_operar_progressao_atomica(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions set lock_timeout='3s' as $fn$
declare
  v_fingerprint text;v_receipt record;v_plan jsonb;v_final jsonb;v_result jsonb;v_rule uuid;v_exec uuid;v_replace boolean;
  v_source uuid;v_destination uuid;v_candidate jsonb;v_part uuid;v_status text;v_count integer:=0;
  v_src public.campeonato_etapa_equipes%rowtype;v_dst public.campeonato_etapa_equipes%rowtype;
  v_before_source jsonb;v_before_destination jsonb;v_after_source jsonb;v_after_destination jsonb;
  v_execution public.campeonato_progressao_execucoes%rowtype;v_audit public.progressao_auditoria%rowtype;
  v_image public.progressao_vinculos%rowtype;v_current jsonb;v_before public.campeonato_etapa_equipes%rowtype;v_items jsonb;
begin
  if not coalesce(public.fn_is_service_role(),false) then raise exception using errcode='42501',message='Operação exclusiva do backend.';end if;
  if p_actor_id is null or p_campeonato_id is null or p_action is null or p_action not in('preview','apply','reverse')
    or jsonb_typeof(p_args) is distinct from 'object' or octet_length(p_args::text)>4194304
    or (p_action<>'preview' and p_request_id is null) then raise exception using errcode='22023',message='Dados de progressão inválidos.';end if;
  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
  if p_action='preview' then return jsonb_build_object('ok',true,'actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'progression_action','preview','preview',public.dz_progression_plan(p_campeonato_id,(p_args->>'rule_id')::uuid));end if;
  perform pg_advisory_xact_lock(hashtextextended('progression:'||p_actor_id::text||':'||p_request_id::text,0));
  v_fingerprint:=encode(extensions.digest(jsonb_build_object('champ',p_campeonato_id,'action',p_action,'args',p_args)::text,'sha256'),'hex');
  select * into v_receipt from public.progressao_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_receipt.fingerprint is distinct from v_fingerprint then raise exception using errcode='23505',message='Chave de repetição vinculada a outra progressão.';end if;
    return v_receipt.resultado||jsonb_build_object('repetida',true);
  end if;
  if p_action='apply' then
    v_rule:=(p_args->>'rule_id')::uuid;
    if v_rule is null or jsonb_typeof(p_args->'replace_conflicts') is distinct from 'boolean' or jsonb_typeof(p_args->'expected') is distinct from 'object' then
      raise exception using errcode='22023',message='Acompanhamento de progressão inválido.';
    end if;
    v_replace:=(p_args->>'replace_conflicts')::boolean;v_plan:=public.dz_progression_plan(p_campeonato_id,v_rule);
    if v_plan->'fence' is distinct from p_args->'expected' then raise exception using errcode='40001',message='A classificação ou estrutura mudou. Atualize a prévia.';end if;
    v_source:=(v_plan->'rule'->>'etapa_origem_id')::uuid;v_destination:=(v_plan->'rule'->>'etapa_destino_id')::uuid;
    if (v_plan->'summary'->>'conflictCount')::integer>0 and not v_replace then raise exception using errcode='23514',message='Revise os conflitos ou autorize a substituição.';end if;
    if v_plan->'summary'->>'capacity' is not null and
      (v_plan->'summary'->>'occupied')::integer+(v_plan->'summary'->>'newCount')::integer>(v_plan->'summary'->>'capacity')::integer then
      raise exception using errcode='23514',message='A etapa de destino não possui vagas suficientes.';
    end if;
    if not exists(select 1 from jsonb_array_elements(v_plan->'candidates') x where not (x->>'alreadyApplied')::boolean) then
      v_result:=jsonb_build_object('ok',true,'operation_confirmed',true,'applied',0,'execution_id',v_plan->'activeExecution'->'id','preview',v_plan);
    else
      insert into public.campeonato_progressao_execucoes(campeonato_id,regra_id,fase_id,status,previa_snapshot,aplicada_por,aplicada_em)
        values(p_campeonato_id,v_rule,(v_plan->'phase'->>'id')::uuid,'aplicada',v_plan-'fence',p_actor_id,clock_timestamp()) returning * into v_execution;
      v_exec:=v_execution.id;v_status:=case when v_plan->'rule'->>'tipo'='promocao' then 'promovida' else 'classificada' end;
      for v_candidate in select x from jsonb_array_elements(v_plan->'candidates') x where not (x->>'alreadyApplied')::boolean order by (x->>'campeonato_equipe_id')::uuid loop
        v_part:=(v_candidate->>'campeonato_equipe_id')::uuid;
        select * into v_src from public.campeonato_etapa_equipes where campeonato_id=p_campeonato_id and etapa_id=v_source and campeonato_equipe_id=v_part for update;
        v_before_source:=case when found then to_jsonb(v_src) else null end;
        select * into v_dst from public.campeonato_etapa_equipes where campeonato_id=p_campeonato_id and etapa_id=v_destination and campeonato_equipe_id=v_part for update;
        v_before_destination:=case when found then to_jsonb(v_dst) else null end;
        insert into public.campeonato_etapa_equipes(campeonato_id,etapa_id,campeonato_equipe_id,tipo_origem,etapa_origem_id,posicao_origem,status,observacao,regra_progressao_id,progressao_execucao_id)
          values(p_campeonato_id,v_destination,v_part,case when v_status='promovida' then 'promocao' else 'outra_etapa' end,v_source,
            (v_candidate->>'colocacao')::integer,v_status,'Progressão aplicada pela regra '||v_rule::text||'.',v_rule,v_exec)
          on conflict(etapa_id,campeonato_equipe_id) do update set tipo_origem=excluded.tipo_origem,etapa_origem_id=excluded.etapa_origem_id,
            posicao_origem=excluded.posicao_origem,status=excluded.status,observacao=excluded.observacao,regra_progressao_id=excluded.regra_progressao_id,
            progressao_execucao_id=excluded.progressao_execucao_id returning * into v_dst;
        v_after_destination:=to_jsonb(v_dst);v_after_source:=null;
        if v_before_source is not null then
          update public.campeonato_etapa_equipes set status=v_status,posicao_origem=(v_candidate->>'colocacao')::integer,
            regra_progressao_id=v_rule,progressao_execucao_id=v_exec where id=v_src.id returning * into v_src;
          v_after_source:=to_jsonb(v_src);
        end if;
        insert into public.progressao_vinculos values(v_exec,v_part,v_source,'origem',v_before_source,v_after_source,null),
          (v_exec,v_part,v_destination,'destino',v_before_destination,v_after_destination,null);
        insert into public.campeonato_progressao_execucao_itens(execucao_id,campeonato_equipe_id,vinculo_origem_id,vinculo_destino_id,posicao_origem,status_origem_anterior,destino_anterior,resultado)
          values(v_exec,v_part,(v_before_source->>'id')::uuid,v_dst.id,(v_candidate->>'colocacao')::integer,v_before_source->>'status',v_before_destination,
            case when (v_candidate->>'conflict')::boolean then 'substituida' else 'incluida' end);
        v_count:=v_count+1;
      end loop;
      v_final:=public.dz_progression_plan(p_campeonato_id,v_rule);
      update public.campeonato_progressao_execucoes set resultado_snapshot=v_final-'fence' where id=v_exec returning * into v_execution;
      select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) into v_items from public.campeonato_progressao_execucao_itens x where execucao_id=v_exec;
      insert into public.progressao_auditoria values(v_exec,p_campeonato_id,v_source,v_destination,to_jsonb(v_execution),v_items,null,now());
      v_result:=jsonb_build_object('ok',true,'operation_confirmed',true,'applied',v_count,'execution_id',v_exec,'preview',v_final);
    end if;
  else
    v_exec:=(p_args->>'execution_id')::uuid;
    select * into v_audit from public.progressao_auditoria where execucao_id=v_exec and campeonato_id=p_campeonato_id;
    if not found then raise exception using errcode='23514',message='Execução anterior sem acompanhamento transacional. Revise antes de reverter.';end if;
    perform 1 from public.campeonato_etapas where id in(v_audit.origem_id,v_audit.destino_id) order by id for no key update;
    select * into v_execution from public.campeonato_progressao_execucoes where id=v_exec and campeonato_id=p_campeonato_id for update;
    if not found or v_execution.status<>'aplicada' or to_jsonb(v_execution) is distinct from v_audit.execucao_aplicada then
      raise exception using errcode='40001',message='A execução mudou. Atualize o acompanhamento.';
    end if;
    select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) into v_items from public.campeonato_progressao_execucao_itens x where execucao_id=v_exec;
    if v_items is distinct from v_audit.itens_aplicados then raise exception using errcode='40001',message='O histórico mudou. Revise antes de reverter.';end if;
    -- Check every image before any restoration. Locks/fences also cover absence and ABA through the revision.
    for v_image in select * from public.progressao_vinculos where execucao_id=v_exec order by etapa_id,campeonato_equipe_id loop
      select * into v_dst from public.campeonato_etapa_equipes where campeonato_id=p_campeonato_id and etapa_id=v_image.etapa_id and campeonato_equipe_id=v_image.campeonato_equipe_id for update;
      v_current:=case when found then to_jsonb(v_dst) else null end;
      if v_current is distinct from v_image.posterior then raise exception using errcode='40001',message='Outro escritor alterou um vínculo. A reversão foi recusada.';end if;
    end loop;
    if (select count(*) from public.progressao_vinculos where execucao_id=v_exec)<>2*jsonb_array_length(v_items) then
      raise exception using errcode='23514',message='Acompanhamento de reversão incompleto.';
    end if;
    for v_image in select * from public.progressao_vinculos where execucao_id=v_exec order by etapa_id,campeonato_equipe_id loop
      v_current:=null;
      if v_image.anterior is not null then
        select * into v_before from jsonb_populate_record(null::public.campeonato_etapa_equipes,v_image.anterior);
        update public.campeonato_etapa_equipes set tipo_origem=v_before.tipo_origem,etapa_origem_id=v_before.etapa_origem_id,
          posicao_origem=v_before.posicao_origem,status=v_before.status,observacao=v_before.observacao,
          regra_progressao_id=v_before.regra_progressao_id,progressao_execucao_id=v_before.progressao_execucao_id
          where id=(v_image.posterior->>'id')::uuid returning to_jsonb(campeonato_etapa_equipes) into v_current;
      elsif v_image.posterior is not null then
        update public.campeonato_etapa_equipes set status='retirada' where id=(v_image.posterior->>'id')::uuid
          returning to_jsonb(campeonato_etapa_equipes) into v_current;
      end if;
      update public.progressao_vinculos set apos_reversao=v_current where execucao_id=v_exec and campeonato_equipe_id=v_image.campeonato_equipe_id and papel=v_image.papel;
    end loop;
    update public.campeonato_progressao_execucoes set status='revertida',revertida_por=p_actor_id,revertida_em=clock_timestamp(),
      motivo_reversao=nullif(left(btrim(p_args->>'reason'),500),'') where id=v_exec returning * into v_execution;
    update public.progressao_auditoria set execucao_revertida=to_jsonb(v_execution) where execucao_id=v_exec;
    v_result:=jsonb_build_object('ok',true,'operation_confirmed',true,'reversed',jsonb_array_length(v_items),'execution_id',v_exec);
  end if;
  v_result:=v_result||jsonb_build_object('actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'progression_action',p_action,'request_id',p_request_id);
  insert into public.progressao_recibos values(p_actor_id,p_request_id,v_fingerprint,v_result,now());
  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
  if p_action='apply' and public.dz_progression_plan(p_campeonato_id,v_rule)->'fence' is distinct from v_result->'preview'->'fence' then
    raise exception using errcode='23514',message='A prévia mudou durante a confirmação.';
  end if;
  if v_exec is not null and exists(select 1 from public.progressao_vinculos image left join public.campeonato_etapa_equipes ce
    on ce.etapa_id=image.etapa_id and ce.campeonato_equipe_id=image.campeonato_equipe_id and ce.campeonato_id=p_campeonato_id
    where image.execucao_id=v_exec and to_jsonb(ce) is distinct from case when p_action='reverse' then image.apos_reversao else image.posterior end) then
    raise exception using errcode='23514',message='Os vínculos mudaram durante a confirmação.';
  end if;
  if v_exec is not null and (select to_jsonb(x) from public.campeonato_progressao_execucoes x where id=v_exec) is distinct from to_jsonb(v_execution) then
    raise exception using errcode='23514',message='A execução mudou durante a confirmação.';
  end if;
  if v_exec is not null and (select coalesce(jsonb_agg(to_jsonb(x) order by id),'[]'::jsonb) from public.campeonato_progressao_execucao_itens x where execucao_id=v_exec) is distinct from v_items then
    raise exception using errcode='23514',message='O histórico mudou durante a confirmação.';
  end if;
  return v_result;
end;
$fn$;
revoke all on function public.dz_progression_stage_guard(),public.dz_progression_result_guard(),public.dz_progression_history_guard(),public.dz_progression_plan(uuid,uuid),
  public.fn_operar_progressao_atomica(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.fn_operar_progressao_atomica(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
