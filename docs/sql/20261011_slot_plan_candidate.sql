-- CANDIDATE ONLY. Narrow HTTP wrappers opt-in; no production application.
-- Owner is the default; 'manage' requires the reviewed permission helper.
-- No full behavior parity for current routes. Apply permissions + mirror guards first.
-- Caller supplies a complete snapshot, a plan and a persisted UUID request key.
-- No token/payment/quota mutation; cancel means location only, not enrollment removal.
begin;

create table public.movimentacao_recibos (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  fingerprint text not null,
  intent_fingerprint text,
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
alter table public.movimentacao_recibos enable row level security;
revoke all on public.movimentacao_recibos from public,anon,authenticated,service_role;
grant select on public.movimentacao_recibos to service_role;

create function public.fn_aplicar_plano_slots_atomico(
  p_actor_id uuid, p_request_id uuid, p_campeonato_id uuid,
  p_action text, p_plan jsonb, p_note text default null,
  p_permission text default 'owner',p_intent_fingerprint text default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $fn$
declare
  v_part public.campeonato_equipes%rowtype;
  v_slot public.campeonato_slots%rowtype;
  v_item record; v_receipt record;
  v_plan jsonb; v_fingerprint text; v_result jsonb;
  v_count integer; v_ids uuid[]; v_teams uuid[]; v_groups uuid[]; v_slots uuid[]; v_lines uuid[];
  v_target uuid; v_target_group uuid; v_target_number integer; v_phase uuid;
  v_note text:=nullif(trim(p_note),'');
  v_self_phase uuid;v_self_group uuid;v_self_slot uuid;v_self_change boolean;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_actor_id is null or p_request_id is null or p_campeonato_id is null
    or p_action is null or p_action not in ('move','swap','shuffle','distribute','assign','cancel','restore')
    or jsonb_typeof(p_plan) is distinct from 'array' or length(coalesce(v_note,''))>500
    or (p_intent_fingerprint is not null and p_intent_fingerprint !~ '^[0-9a-f]{64}$') then
    raise exception using errcode='22023',message='Plano de slots inválido.';
  end if;
  v_count:=jsonb_array_length(p_plan);
  if v_count<1 or v_count>1000 then
    raise exception using errcode='22023',message='Plano de slots inválido.';
  end if;
  if exists(select 1 from jsonb_array_elements(p_plan) e where jsonb_typeof(e)<>'object'
    or not (e ?& array['id','expected_updated_at','expected_slot_id','expected_grupo_id',
      'expected_slot_numero','expected_equipe_id','expected_line_id','target_slot_id'])
    or e->>'id' is null or e->>'expected_updated_at' is null
    or e->>'expected_equipe_id' is null or e->>'expected_line_id' is null) then
    raise exception using errcode='22023',message='Snapshot de participação incompleto.';
  end if;
  select jsonb_agg(to_jsonb(t) order by t.id),array_agg(t.id order by t.id),
    array_agg(distinct t.expected_equipe_id),array_agg(distinct t.expected_line_id)
    into v_plan,v_ids,v_teams,v_lines
    from jsonb_to_recordset(p_plan) as t(id uuid,expected_updated_at timestamptz,
      expected_slot_id uuid,expected_grupo_id uuid,expected_slot_numero integer,
      expected_equipe_id uuid,expected_line_id uuid,target_slot_id uuid);
  if (select count(distinct t.id) from jsonb_to_recordset(v_plan) as t(id uuid))<>v_count
    or (select count(t.target_slot_id)<>count(distinct t.target_slot_id)
      from jsonb_to_recordset(v_plan) as t(target_slot_id uuid)) then
    raise exception using errcode='22023',message='Participação ou destino repetido no plano.';
  end if;
  if (p_action in ('move','assign','cancel','restore') and v_count<>1)
    or (p_action='swap' and v_count<>2)
    or exists(select 1 from jsonb_to_recordset(v_plan) as t(expected_slot_id uuid,target_slot_id uuid)
      where (p_action='cancel' and (t.target_slot_id is not null or t.expected_slot_id is null))
        or (p_action='move' and t.expected_slot_id is null)
        or (p_action<>'cancel' and t.target_slot_id is null)
        or (p_action='restore' and t.expected_slot_id is not null))
    or (p_action='swap' and exists(select 1 from jsonb_to_recordset(v_plan) as t(expected_slot_id uuid,target_slot_id uuid)
      where t.expected_slot_id is null or t.target_slot_id=t.expected_slot_id
        or not exists(select 1 from jsonb_to_recordset(v_plan) as other(expected_slot_id uuid)
          where other.expected_slot_id=t.target_slot_id))) then
    raise exception using errcode='22023',message='Ação incompatível com o plano.';
  end if;

  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,p_permission);
  -- The wrapper and primitive both take the request lock BEFORE team/group locks.
  perform pg_advisory_xact_lock(hashtextextended('slots:'||p_actor_id::text||':'||p_request_id::text,0));
  -- Same broad order as enrollment: teams, championship, groups, slots, lines, participations.
  -- Other writers (including line transfer) still need a separate lock-order review.
  perform 1 from public.equipes where id=any(v_teams) order by id for update;
  if p_permission='team' then
    if v_count<>1 or p_action not in('assign','move','cancel','restore') then
      raise exception using errcode='22023',message='Ação de escolha inválida.';
    end if;
    if not exists(select 1 from public.equipes where id=v_teams[1] and status='ativo'
      and (auth_user_id=p_actor_id or dono_auth_user_id=p_actor_id)) then
      raise exception using errcode='42501',message='Esta participação não pertence à sua equipe.';
    end if;
  end if;
  v_fingerprint:=encode(extensions.digest(jsonb_build_object('campeonato_id',p_campeonato_id,
    'action',p_action,'plan',v_plan,'note',v_note,'permission',p_permission,'intent',p_intent_fingerprint)::text,'sha256'),'hex');
  select * into v_receipt from public.movimentacao_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_receipt.fingerprint<>v_fingerprint then
      raise exception using errcode='23505',message='Chave de repetição vinculada a outro plano.';
    end if;
    return v_receipt.resultado||jsonb_build_object('repetida',true);
  end if;

  select array_agg(distinct s),array_agg(distinct g) into v_slots,v_groups from (
    select expected_slot_id s,expected_grupo_id g from jsonb_to_recordset(v_plan)
      as t(expected_slot_id uuid,expected_grupo_id uuid)
    union all
    select s.id,s.grupo_id from public.campeonato_slots s
      join jsonb_to_recordset(v_plan) as t(target_slot_id uuid) on s.id=t.target_slot_id
  ) all_locations;
  perform 1 from public.campeonato_grupos where id=any(v_groups) order by id for update;
  perform 1 from public.campeonato_slots where id=any(v_slots) order by id for update;
  perform 1 from public.equipe_lines where id=any(v_lines) order by id for update;
  perform 1 from public.campeonato_equipes where id=any(v_ids) order by id for update;

  for v_item in select * from jsonb_to_recordset(v_plan) as t(id uuid,expected_updated_at timestamptz,
    expected_slot_id uuid,expected_grupo_id uuid,expected_slot_numero integer,
    expected_equipe_id uuid,expected_line_id uuid,target_slot_id uuid) order by id loop
    select * into v_part from public.campeonato_equipes where id=v_item.id;
    if not found or v_part.campeonato_id is distinct from p_campeonato_id or v_part.status is distinct from 'ativo'
      or v_part.updated_at is distinct from v_item.expected_updated_at
      or v_part.slot_id is distinct from v_item.expected_slot_id
      or v_part.grupo_id is distinct from v_item.expected_grupo_id
      or v_part.slot_numero is distinct from v_item.expected_slot_numero
      or v_part.equipe_id is distinct from v_item.expected_equipe_id
      or v_part.line_id is distinct from v_item.expected_line_id then
      raise exception using errcode='40001',message='A participação mudou. Atualize o plano.';
    end if;
    if not exists(select 1 from public.equipe_lines l join public.equipes e on e.id=l.equipe_id
      where l.id=v_part.line_id and l.equipe_id=v_part.equipe_id and l.status='ativo' and e.status='ativo') then
      raise exception using errcode='23514',message='Line ou equipe incompatível com a participação.';
    end if;
    if v_part.slot_id is null then
      if v_part.grupo_id is not null or v_part.slot_numero is not null then
        raise exception using errcode='23514',message='Localização legada exige reconciliação.';
      end if;
    else
      select * into v_slot from public.campeonato_slots where id=v_part.slot_id;
      if not found or v_slot.campeonato_id is distinct from p_campeonato_id
        or v_slot.grupo_id is distinct from v_part.grupo_id or v_slot.slot_numero is distinct from v_part.slot_numero
        or v_slot.equipe_id is distinct from v_part.equipe_id or v_slot.line_id is distinct from v_part.line_id
        or v_slot.status is distinct from 'ocupado'
        or not exists(select 1 from public.campeonato_grupos g where g.id=v_slot.grupo_id
          and g.campeonato_id=p_campeonato_id and g.fase_id is not distinct from v_slot.fase_id) then
        raise exception using errcode='23514',message='Espelho de origem exige reconciliação.';
      end if;
    end if;
    if v_item.target_slot_id is not null then
      select * into v_slot from public.campeonato_slots where id=v_item.target_slot_id;
      if not found or v_slot.campeonato_id is distinct from p_campeonato_id
        or not exists(select 1 from public.campeonato_grupos g where g.id=v_slot.grupo_id
          and g.campeonato_id=p_campeonato_id and g.fase_id is not distinct from v_slot.fase_id) then
        raise exception using errcode='23514',message='Destino fora da estrutura do campeonato.';
      end if;
      if not ((v_slot.status='livre' and v_slot.line_id is null and v_slot.equipe_id is null)
        or (v_slot.status='ocupado' and exists(select 1 from jsonb_to_recordset(v_plan)
          as other(expected_slot_id uuid,expected_line_id uuid,expected_equipe_id uuid)
          where other.expected_slot_id=v_slot.id and other.expected_line_id=v_slot.line_id
            and other.expected_equipe_id=v_slot.equipe_id))) then
        raise exception using errcode='23505',message='Destino ocupado ou reservado fora do plano.';
      end if;
      if exists(select 1 from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id
        and ce.status='ativo' and (ce.slot_id=v_slot.id or (ce.grupo_id=v_slot.grupo_id and ce.slot_numero=v_slot.slot_numero))
        and not (ce.id=any(v_ids))) then
        raise exception using errcode='23505',message='Destino ocupado ou reservado fora do plano.';
      end if;
      if p_action='restore' and not exists(select 1 from (
        select slot_anterior_id from public.campeonato_grupo_escolha_historico
          where campeonato_id=p_campeonato_id and campeonato_equipe_id=v_item.id
          and grupo_novo_id is null and grupo_anterior_id is not null and slot_anterior_id is not null
          order by created_at desc,id desc limit 1
      ) h where h.slot_anterior_id=v_item.target_slot_id) then
        raise exception using errcode='22023',message='Destino diferente do último cancelamento.';
      end if;
    end if;
    if p_permission='team' then
      v_self_group:=case when v_item.target_slot_id is not null then v_slot.grupo_id else v_part.grupo_id end;
      v_self_slot:=v_item.target_slot_id;
      select fase_id into v_self_phase from public.campeonato_grupos where id=v_self_group and campeonato_id=p_campeonato_id;
      v_self_change:=v_part.grupo_id is not null or p_action in('cancel','restore');
      perform public.dz_assert_team_choice_window(p_campeonato_id,v_self_phase,v_self_change,v_self_group,v_self_slot);
    end if;
  end loop;

  -- Clear the COMPLETE tuple. Clearing slot_id alone is undone by the BEFORE trigger.
  -- All selected participants detach before any attach, satisfying non-deferrable indexes.
  update public.campeonato_equipes set grupo_id=null,slot_id=null,slot_numero=null
    where id=any(v_ids) and campeonato_id=p_campeonato_id;
  for v_item in select * from jsonb_to_recordset(v_plan) as t(id uuid,expected_slot_id uuid,
    expected_grupo_id uuid,target_slot_id uuid) order by id loop
    v_target:=v_item.target_slot_id; v_target_group:=null; v_target_number:=null; v_phase:=null;
    if v_target is not null then
      select grupo_id,slot_numero,fase_id into v_target_group,v_target_number,v_phase
        from public.campeonato_slots where id=v_target;
      update public.campeonato_equipes set slot_id=v_target,grupo_id=v_target_group,slot_numero=v_target_number
        where id=v_item.id and campeonato_id=p_campeonato_id;
    else
      select fase_id into v_phase from public.campeonato_grupos where id=v_item.expected_grupo_id;
    end if;
    insert into public.campeonato_grupo_escolha_historico(campeonato_id,fase_id,campeonato_equipe_id,
      grupo_anterior_id,grupo_novo_id,slot_anterior_id,slot_novo_id,origem,alterado_por,observacao)
      values(p_campeonato_id,v_phase,v_item.id,v_item.expected_grupo_id,v_target_group,
        v_item.expected_slot_id,v_target,case when p_permission='team' then 'equipe' else 'administrador' end,
        p_actor_id,coalesce(v_note,'Movimentação: '||p_action));
  end loop;
  -- Fail closed if the installed mirror trigger is incompatible with the candidate.
  if exists(select 1 from jsonb_to_recordset(v_plan) as t(id uuid,target_slot_id uuid)
    join public.campeonato_equipes ce on ce.id=t.id
    left join public.campeonato_slots s on s.id=t.target_slot_id
    where ce.slot_id is distinct from t.target_slot_id or (t.target_slot_id is not null
      and (s.equipe_id is distinct from ce.equipe_id or s.line_id is distinct from ce.line_id or s.status is distinct from 'ocupado')))
    or exists(select 1 from jsonb_to_recordset(v_plan) as t(expected_slot_id uuid)
      join public.campeonato_slots s on s.id=t.expected_slot_id
      where not exists(select 1 from jsonb_to_recordset(v_plan) as dest(target_slot_id uuid) where dest.target_slot_id=s.id)
      and (s.line_id is not null or s.equipe_id is not null or s.status is distinct from 'livre')) then
    raise exception using errcode='23514',message='Gatilho de slots incompatível com a movimentação.';
  end if;
  select jsonb_build_object('ok',true,'campeonato_id',p_campeonato_id,'action',p_action,
    'participacoes',jsonb_agg(jsonb_build_object('id',ce.id,'equipe_id',ce.equipe_id,'line_id',ce.line_id,
      'grupo_id',ce.grupo_id,'slot_id',ce.slot_id,'slot_numero',ce.slot_numero,'updated_at',ce.updated_at) order by ce.id))
    into v_result from public.campeonato_equipes ce where ce.id=any(v_ids);
  if p_permission='team' then
    -- Recheck elapsed time after participation/history/agenda trigger work as well.
    perform public.dz_assert_team_choice_window(p_campeonato_id,v_self_phase,v_self_change,v_self_group,v_self_slot);
  end if;
  insert into public.movimentacao_recibos(actor_id,request_id,fingerprint,intent_fingerprint,resultado)
    values(p_actor_id,p_request_id,v_fingerprint,p_intent_fingerprint,v_result);
  return v_result;
end;
$fn$;
revoke all on function public.fn_aplicar_plano_slots_atomico(uuid,uuid,uuid,text,jsonb,text,text,text) from public,anon,authenticated;
grant execute on function public.fn_aplicar_plano_slots_atomico(uuid,uuid,uuid,text,jsonb,text,text,text) to service_role;
commit;
