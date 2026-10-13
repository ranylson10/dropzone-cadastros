-- CANDIDATE ONLY. Revised permission helper + mirror + slot plan are prerequisites.
-- HTTP move/swap only. Replay checks the immutable UI intent BEFORE rebuilding a plan.
-- Expected participant IDs prevent a stale board from moving a replacement occupant.
create function public.fn_transferir_slots_atomico(
  p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_mode text,
  p_source_slot_id uuid,p_target_slot_id uuid,p_source_participation_id uuid,
  p_target_participation_id uuid default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $fn$
declare
  v_source public.campeonato_slots%rowtype;v_target public.campeonato_slots%rowtype;
  v_source_part public.campeonato_equipes%rowtype;v_target_part public.campeonato_equipes%rowtype;
  v_teams uuid[];v_groups uuid[];v_plan jsonb;v_result jsonb;v_intent text;v_receipt record;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_request_id is null or p_mode is null or p_mode not in('move','swap')
    or p_source_slot_id is null or p_target_slot_id is null or p_source_slot_id=p_target_slot_id
    or p_source_participation_id is null
    or (p_mode='swap' and (p_target_participation_id is null or p_target_participation_id=p_source_participation_id))
    or (p_mode='move' and p_target_participation_id is not null) then
    raise exception using errcode='22023',message='Dados de movimentação inválidos.';
  end if;
  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
  perform pg_advisory_xact_lock(hashtextextended('slots:'||p_actor_id::text||':'||p_request_id::text,0));
  v_intent:=encode(extensions.digest(jsonb_build_object('campeonato_id',p_campeonato_id,'mode',p_mode,
    'source_slot_id',p_source_slot_id,'target_slot_id',p_target_slot_id,
    'source_participation_id',p_source_participation_id,'target_participation_id',p_target_participation_id)::text,'sha256'),'hex');
  select * into v_receipt from public.movimentacao_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_receipt.intent_fingerprint is distinct from v_intent then
      raise exception using errcode='23505',message='Chave de repetição vinculada a outro movimento.';
    end if;
    return v_receipt.resultado||jsonb_build_object('repetida',true);
  end if;

  select * into v_source from public.campeonato_slots where id=p_source_slot_id and campeonato_id=p_campeonato_id;
  if not found then raise exception using errcode='22023',message='Slots fora do campeonato.';end if;
  select * into v_target from public.campeonato_slots where id=p_target_slot_id and campeonato_id=p_campeonato_id;
  if not found then raise exception using errcode='22023',message='Slots fora do campeonato.';end if;
  v_groups:=array[v_source.grupo_id,v_target.grupo_id];
  select * into v_source_part from public.campeonato_equipes where id=p_source_participation_id
    and campeonato_id=p_campeonato_id and slot_id=p_source_slot_id and status='ativo';
  if not found then raise exception using errcode='40001',message='O ocupante mudou. Atualize o acompanhamento.';end if;
  if p_mode='swap' then
    select * into v_target_part from public.campeonato_equipes where id=p_target_participation_id
      and campeonato_id=p_campeonato_id and slot_id=p_target_slot_id and status='ativo';
    if not found then raise exception using errcode='40001',message='O ocupante mudou. Atualize o acompanhamento.';end if;
  end if;
  v_teams:=array[v_source_part.equipe_id,v_target_part.equipe_id];
  -- Cooperating enrollment also locks teams before group/slot. No group-then-team cycle.
  perform 1 from public.equipes where id=any(v_teams) order by id for update;
  perform 1 from public.campeonato_grupos where id=any(v_groups) order by id for update;
  perform 1 from public.campeonato_slots where id in(p_source_slot_id,p_target_slot_id) order by id for update;
  select * into v_source from public.campeonato_slots where id=p_source_slot_id and campeonato_id=p_campeonato_id;
  if not found or not coalesce(v_source.grupo_id=any(v_groups),false) then
    raise exception using errcode='40001',message='A estrutura mudou. Atualize o acompanhamento.';
  end if;
  select * into v_target from public.campeonato_slots where id=p_target_slot_id and campeonato_id=p_campeonato_id;
  if not found or not coalesce(v_target.grupo_id=any(v_groups),false) then
    raise exception using errcode='40001',message='A estrutura mudou. Atualize o acompanhamento.';
  end if;
  select * into v_source_part from public.campeonato_equipes where id=p_source_participation_id
    and campeonato_id=p_campeonato_id and slot_id=p_source_slot_id and status='ativo';
  if not found or not coalesce(v_source_part.equipe_id=any(v_teams),false) then
    raise exception using errcode='40001',message='O ocupante mudou. Atualize o acompanhamento.';
  end if;
  if p_mode='swap' then
    select * into v_target_part from public.campeonato_equipes where id=p_target_participation_id
      and campeonato_id=p_campeonato_id and slot_id=p_target_slot_id and status='ativo';
    if not found or not coalesce(v_target_part.equipe_id=any(v_teams),false) then
      raise exception using errcode='40001',message='O ocupante mudou. Atualize o acompanhamento.';
    end if;
  end if;
  select jsonb_agg(jsonb_build_object('id',ce.id,'expected_updated_at',ce.updated_at,
    'expected_slot_id',ce.slot_id,'expected_grupo_id',ce.grupo_id,'expected_slot_numero',ce.slot_numero,
    'expected_equipe_id',ce.equipe_id,'expected_line_id',ce.line_id,'target_slot_id',
      case when ce.id=p_source_participation_id then p_target_slot_id else p_source_slot_id end) order by ce.id)
    into v_plan from public.campeonato_equipes ce where ce.id in(v_source_part.id,v_target_part.id);
  v_result:=public.fn_aplicar_plano_slots_atomico(p_actor_id,p_request_id,p_campeonato_id,p_mode,v_plan,null,'manage',v_intent);
  v_result:=v_result||jsonb_build_object('source_slot_id',p_source_slot_id,'target_slot_id',p_target_slot_id,
    'source_participation_id',p_source_participation_id,'target_participation_id',p_target_participation_id,'mode',p_mode,
    'mensagem',case when p_mode='swap' then 'Posições trocadas.' else 'Line movida.' end);
  update public.movimentacao_recibos set resultado=v_result where actor_id=p_actor_id and request_id=p_request_id;
  return v_result;
end;
$fn$;
revoke all on function public.fn_transferir_slots_atomico(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.fn_transferir_slots_atomico(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid) to service_role;
