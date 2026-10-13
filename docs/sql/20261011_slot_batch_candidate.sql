-- CANDIDATE ONLY, NOT APPLIED. Requires permission helper, mirror and slot-plan candidates.
-- Administrative shuffle/distribution; no invitation, payment or enrollment mutation.
-- Full expected occupied set protects against a stale board. Reserved slots are never targets.
create function public.fn_distribuir_slots_atomico(
  p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_mode text,
  p_phase_id uuid,p_group_ids uuid[],p_strategy text,p_expected jsonb
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $fn$
declare
  v_expected jsonb;v_ids uuid[];v_teams uuid[];v_actual uuid[];v_targets uuid[];
  v_sources uuid[];v_plan jsonb;v_result jsonb;v_intent text;v_receipt record;
  v_count integer;v_phase uuid;v_tmp uuid;v_groups integer;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_request_id is null or p_mode is null or p_mode not in('shuffle_group','distribute_phase')
    or p_group_ids is null or array_ndims(p_group_ids)<>1 or cardinality(p_group_ids) not between 1 and 100
    or array_position(p_group_ids,null) is not null
    or cardinality(p_group_ids)<>(select count(distinct g) from unnest(p_group_ids) g)
    or (p_mode='shuffle_group' and (cardinality(p_group_ids)<>1 or p_strategy is not null or p_phase_id is not null))
    or (p_mode='distribute_phase' and (cardinality(p_group_ids)<2 or p_phase_id is null
      or p_strategy is null or p_strategy not in('balanced','random')))
    or p_expected is null or jsonb_typeof(p_expected)<>'array' then
    raise exception using errcode='22023',message='Dados de distribuição inválidos.';
  end if;
  v_count:=jsonb_array_length(p_expected);
  if v_count not between 2 and 1000 or exists(select 1 from jsonb_array_elements(p_expected) x
    where jsonb_typeof(x)<>'object' or not (x ?& array['id','slot_id','updated_at','equipe_id','line_id'])
      or x->>'id' is null or x->>'slot_id' is null or x->>'updated_at' is null
      or x->>'equipe_id' is null or x->>'line_id' is null) then
    raise exception using errcode='22023',message='Acompanhamento de distribuição inválido.';
  end if;
  select jsonb_agg(to_jsonb(t) order by t.id),array_agg(t.id order by t.id),array_agg(distinct t.equipe_id)
    into v_expected,v_ids,v_teams from jsonb_to_recordset(p_expected)
      as t(id uuid,slot_id uuid,updated_at timestamptz,equipe_id uuid,line_id uuid);
  if (select count(distinct t.id)<>v_count or count(distinct t.slot_id)<>v_count
    from jsonb_to_recordset(v_expected) as t(id uuid,slot_id uuid)) then
    raise exception using errcode='22023',message='Acompanhamento de distribuição inválido.';
  end if;
  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
  perform pg_advisory_xact_lock(hashtextextended('slots:'||p_actor_id::text||':'||p_request_id::text,0));
  -- Ordered group IDs are meaningful for balanced distribution. Expected entries are canonicalized.
  v_intent:=encode(extensions.digest(jsonb_build_object('campeonato_id',p_campeonato_id,
    'mode',p_mode,'phase_id',p_phase_id,'group_ids',p_group_ids,'strategy',p_strategy,
    'expected',v_expected)::text,'sha256'),'hex');
  select * into v_receipt from public.movimentacao_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_receipt.intent_fingerprint is distinct from v_intent then
      raise exception using errcode='23505',message='Chave de repetição vinculada a outra distribuição.';
    end if;
    return v_receipt.resultado||jsonb_build_object('repetida',true);
  end if;
  -- Same cooperating order as enrollment and move: teams, groups, slots, lines, participations.
  perform 1 from public.equipes where id=any(v_teams) order by id for update;
  perform 1 from public.campeonato_grupos where id=any(p_group_ids) order by id for update;
  select count(*),min(fase_id::text)::uuid into v_groups,v_phase from public.campeonato_grupos
    where id=any(p_group_ids) and campeonato_id=p_campeonato_id
      and (p_mode='shuffle_group' or fase_id=p_phase_id);
  if v_groups<>cardinality(p_group_ids) then
    raise exception using errcode='22023',message='Grupos fora da fase ou campeonato.';
  end if;
  perform 1 from public.campeonato_fases where id in(select fase_id from public.campeonato_grupos where id=any(p_group_ids)) order by id for share;
  if exists(select 1 from public.campeonato_grupos g left join public.campeonato_fases f on f.id=g.fase_id
    where g.id=any(p_group_ids) and g.fase_id is not null
      and (f.id is null or f.campeonato_id is distinct from p_campeonato_id)) then
    raise exception using errcode='23514',message='Estrutura de distribuição exige reconciliação.';
  end if;
  perform 1 from public.campeonato_slots where grupo_id=any(p_group_ids) order by id for update;
  perform 1 from public.equipe_lines where id in(select t.line_id from jsonb_to_recordset(v_expected) as t(line_id uuid)) order by id for update;
  perform 1 from public.campeonato_equipes where id=any(v_ids) order by id for update;
  if exists(select 1 from public.campeonato_slots s join public.campeonato_grupos g on g.id=s.grupo_id
    where s.grupo_id=any(p_group_ids) and (s.campeonato_id is distinct from p_campeonato_id
      or s.fase_id is distinct from g.fase_id)) then
    raise exception using errcode='23514',message='Estrutura de distribuição exige reconciliação.';
  end if;
  select array_agg(id order by id) into v_actual from public.campeonato_equipes
    where campeonato_id=p_campeonato_id and status='ativo'
      and (grupo_id=any(p_group_ids) or slot_id in(select id from public.campeonato_slots where grupo_id=any(p_group_ids)));
  if v_actual is distinct from v_ids or exists(select 1 from jsonb_to_recordset(v_expected)
    as t(id uuid,slot_id uuid,updated_at timestamptz,equipe_id uuid,line_id uuid)
    left join public.campeonato_equipes ce on ce.id=t.id
    where ce.campeonato_id is distinct from p_campeonato_id or ce.status is distinct from 'ativo'
      or ce.slot_id is distinct from t.slot_id or ce.updated_at is distinct from t.updated_at
      or ce.equipe_id is distinct from t.equipe_id or ce.line_id is distinct from t.line_id
      or ce.grupo_id is null or not coalesce(ce.grupo_id=any(p_group_ids),false)) then
    raise exception using errcode='40001',message='As equipes mudaram. Atualize o acompanhamento.';
  end if;
  -- A corrupt mirror or reserved slot with an occupant must fail without broad clearing.
  if exists(select 1 from public.campeonato_slots s where s.grupo_id=any(p_group_ids)
    and not ((s.status in('livre','reservado') and s.equipe_id is null and s.line_id is null)
      or (s.status='ocupado' and exists(select 1 from public.campeonato_equipes ce
        where ce.id=any(v_ids) and ce.slot_id=s.id and ce.grupo_id=s.grupo_id
          and ce.slot_numero=s.slot_numero and ce.equipe_id=s.equipe_id and ce.line_id=s.line_id)))) then
    raise exception using errcode='23514',message='Espelho de distribuição exige reconciliação.';
  end if;
  -- Pseudorandom order fixed by request UUID; replay never creates a new draw.
  select array_agg(t.slot_id order by extensions.digest(p_request_id::text||':entry:'||t.id::text,'sha256'),t.id)
    into v_sources from jsonb_to_recordset(v_expected) as t(id uuid,slot_id uuid);
  if p_strategy='balanced' then
    -- Rank ONLY usable positions: a reserved early slot does not unbalance the groups.
    select array_agg(id order by position,group_order,id) into v_targets from (
      select s.id,array_position(p_group_ids,s.grupo_id) group_order,
        row_number() over(partition by s.grupo_id order by s.slot_numero,s.id) position
      from public.campeonato_slots s where s.grupo_id=any(p_group_ids) and s.status<>'reservado'
    ) usable;
  else
    select array_agg(id order by extensions.digest(p_request_id::text||':target:'||id::text,'sha256'),id)
      into v_targets from public.campeonato_slots where grupo_id=any(p_group_ids) and status<>'reservado';
  end if;
  if coalesce(cardinality(v_targets),0)<v_count then
    raise exception using errcode='23505',message='Vagas livres insuficientes para distribuição.';
  end if;
  v_targets:=v_targets[1:v_count];
  if p_mode='shuffle_group' and v_targets=v_sources then
    v_tmp:=v_targets[1];v_targets[1]:=v_targets[2];v_targets[2]:=v_tmp;
  end if;
  select jsonb_agg(jsonb_build_object('id',ce.id,'expected_updated_at',ce.updated_at,
    'expected_slot_id',ce.slot_id,'expected_grupo_id',ce.grupo_id,'expected_slot_numero',ce.slot_numero,
    'expected_equipe_id',ce.equipe_id,'expected_line_id',ce.line_id,
    'target_slot_id',v_targets[array_position(v_sources,ce.slot_id)]) order by ce.id)
    into v_plan from public.campeonato_equipes ce where ce.id=any(v_ids);
  v_result:=public.fn_aplicar_plano_slots_atomico(p_actor_id,p_request_id,p_campeonato_id,
    case when p_mode='shuffle_group' then 'shuffle' else 'distribute' end,v_plan,null,'manage',v_intent);
  v_result:=v_result||jsonb_build_object('mode',p_mode,'phase_id',p_phase_id,'group_ids',p_group_ids,
    'strategy',p_strategy,'expected_count',v_count,'distribuicao',(
      select jsonb_agg(jsonb_build_object('grupo_id',g,'equipes',(
        select count(*) from public.campeonato_equipes ce where ce.id=any(v_ids) and ce.grupo_id=g)) order by ord)
      from unnest(p_group_ids) with ordinality groups(g,ord)));
  update public.movimentacao_recibos set resultado=v_result where actor_id=p_actor_id and request_id=p_request_id;
  return v_result;
end;
$fn$;
revoke all on function public.fn_distribuir_slots_atomico(uuid,uuid,uuid,text,uuid,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.fn_distribuir_slots_atomico(uuid,uuid,uuid,text,uuid,uuid[],text,jsonb) to service_role;
