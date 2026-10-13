-- CANDIDATE ONLY. Install revised permissions + mirror + plan first. No production activation.
-- Team ownership/window/block rules live in the primitive; admin may override the choice window.
create function public.fn_escolher_grupo_atomico(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,
  p_scope text,p_action text,p_participation_id uuid,p_expected_source_slot_id uuid,
  p_group_id uuid default null,p_slot_id uuid default null,p_history_id uuid default null,p_note text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions
as $fn$
declare
  v_part public.campeonato_equipes%rowtype;v_team public.equipes%rowtype;
  v_target public.campeonato_slots%rowtype;v_old public.campeonato_slots%rowtype;
  v_history public.campeonato_grupo_escolha_historico%rowtype;
  v_target_id uuid;v_group_id uuid;v_groups uuid[];v_team_id uuid;
  v_intent text;v_plan jsonb;v_result jsonb;v_receipt record;v_kind text;v_title text;v_body text;v_recipient uuid;v_phase uuid;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_request_id is null or p_participation_id is null or p_scope is null or p_scope not in('team','admin')
    or p_action is null or p_action not in('assign','cancel','restore') or length(coalesce(p_note,''))>500
    or (p_action='assign' and (p_group_id is null or p_slot_id is null or p_history_id is not null))
    or (p_action='cancel' and (p_expected_source_slot_id is null or p_group_id is not null or p_slot_id is not null or p_history_id is not null))
    or (p_action='restore' and (p_expected_source_slot_id is not null or p_history_id is null or p_group_id is not null or p_slot_id is not null)) then
    raise exception using errcode='22023',message='Dados de escolha inválidos.';
  end if;
  perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,case when p_scope='team' then 'team' else 'manage' end);
  perform pg_advisory_xact_lock(hashtextextended('slots:'||p_actor_id::text||':'||p_request_id::text,0));
  -- Lock team before groups/slots, including receipt replay ownership validation.
  select equipe_id into v_team_id from public.campeonato_equipes
    where id=p_participation_id and campeonato_id=p_campeonato_id and status='ativo';
  select * into v_team from public.equipes where id=v_team_id for update;
  if not found or v_team.status is distinct from 'ativo' then
    raise exception using errcode='42501',message='Participação indisponível para escolha.';
  end if;
  if p_scope='team' and not coalesce(v_team.auth_user_id=p_actor_id or v_team.dono_auth_user_id=p_actor_id,false) then
    raise exception using errcode='42501',message='Esta participação não pertence à sua equipe.';
  end if;
  v_intent:=encode(extensions.digest(jsonb_build_object('campeonato_id',p_campeonato_id,'scope',p_scope,'choice_action',p_action,
    'participation_id',p_participation_id,'expected_source_slot_id',p_expected_source_slot_id,
    'group_id',p_group_id,'slot_id',p_slot_id,'history_id',p_history_id,'note',nullif(trim(p_note),''))::text,'sha256'),'hex');
  select * into v_receipt from public.movimentacao_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_receipt.intent_fingerprint is distinct from v_intent then
      raise exception using errcode='23505',message='Chave de repetição vinculada a outra escolha.';
    end if;
    return v_receipt.resultado||jsonb_build_object('repetida',true);
  end if;
  select * into v_part from public.campeonato_equipes where id=p_participation_id
    and campeonato_id=p_campeonato_id and status='ativo';
  if not found or v_part.equipe_id is distinct from v_team_id or v_part.slot_id is distinct from p_expected_source_slot_id then
    raise exception using errcode='40001',message='A participação mudou. Atualize o plano.';
  end if;
  if p_action='restore' then
    if v_part.grupo_id is not null then raise exception using errcode='22023',message='Cancele a escolha atual antes de restaurar outra.';end if;
    select * into v_history from public.campeonato_grupo_escolha_historico where campeonato_id=p_campeonato_id
      and campeonato_equipe_id=p_participation_id and grupo_novo_id is null and grupo_anterior_id is not null
      and slot_anterior_id is not null order by created_at desc,id desc limit 1;
    if not found or v_history.id is distinct from p_history_id then
      raise exception using errcode='40001',message='O histórico mudou. Atualize o acompanhamento.';
    end if;
    v_target_id:=v_history.slot_anterior_id;v_group_id:=v_history.grupo_anterior_id;
  elsif p_action='assign' then v_target_id:=p_slot_id;v_group_id:=p_group_id;
  end if;
  v_groups:=array[v_part.grupo_id,v_group_id];
  perform 1 from public.campeonato_grupos where id=any(v_groups) order by id for update;
  perform 1 from public.campeonato_slots where id in(v_part.slot_id,v_target_id) order by id for update;
  if v_target_id is not null then
    select * into v_target from public.campeonato_slots where id=v_target_id and campeonato_id=p_campeonato_id and grupo_id=v_group_id;
    if not found then raise exception using errcode='22023',message='Grupo ou slot fora do campeonato.';end if;
    if v_target_id=v_part.slot_id or v_target.status is distinct from 'livre' or v_target.line_id is not null or v_target.equipe_id is not null then
      raise exception using errcode='23505',message='Destino ocupado ou reservado fora do plano.';
    end if;
  end if;
  -- The primitive rechecks the snapshot, topology, ownership and self-service policy under locks.
  v_plan:=jsonb_build_array(jsonb_build_object('id',v_part.id,'expected_updated_at',v_part.updated_at,
    'expected_slot_id',v_part.slot_id,'expected_grupo_id',v_part.grupo_id,'expected_slot_numero',v_part.slot_numero,
    'expected_equipe_id',v_part.equipe_id,'expected_line_id',v_part.line_id,'target_slot_id',v_target_id));
  v_result:=public.fn_aplicar_plano_slots_atomico(p_actor_id,p_request_id,p_campeonato_id,p_action,v_plan,
    case when p_scope='admin' then p_note else 'Escolha '||p_action||' pela equipe.' end,
    case when p_scope='team' then 'team' else 'manage' end,v_intent);
  v_kind:=case when p_action='cancel' then 'cancelada' when p_action='restore' then 'restaurada'
    when v_part.grupo_id is not null then 'editada' else 'confirmada' end;
  v_title:='Escolha de grupo '||v_kind;
  v_body:=case when p_scope='admin' then 'A administração atualizou a escolha de grupo e slot da sua equipe. Consulte a Central do Campeonato.'
    else 'Sua escolha de grupo e slot foi registrada com sucesso.' end;
  v_recipient:=case when p_scope='team' then p_actor_id else coalesce(v_team.dono_auth_user_id,v_team.auth_user_id) end;
  if v_recipient is not null then
    insert into public.notificacoes(destinatario_auth_user_id,remetente_auth_user_id,tipo,titulo,corpo,payload,status,referencia_tipo,referencia_id)
      values(v_recipient,p_actor_id,'escolha_grupo_'||v_kind||case when p_scope='admin' then '_admin' else '' end,
        v_title,v_body,jsonb_build_object('campeonato_id',p_campeonato_id,'campeonato_equipe_id',p_participation_id,
          'grupo_id',v_group_id,'slot_id',v_target_id),'nao_lida','campeonato_escolha_grupo',p_participation_id);
  end if;
  if p_scope='team' then
    select fase_id into v_phase from public.campeonato_grupos where id=coalesce(v_group_id,v_part.grupo_id);
    perform public.dz_assert_team_choice_window(p_campeonato_id,v_phase,
      v_part.grupo_id is not null or p_action in('cancel','restore'),v_group_id,v_target_id);
  end if;
  v_result:=v_result||jsonb_build_object('choice_action',p_action,'scope',p_scope,'participation_id',p_participation_id,
    'source_slot_id',p_expected_source_slot_id,'target_slot_id',v_target_id,'history_id',p_history_id,'mensagem',v_title||'.');
  update public.movimentacao_recibos set resultado=v_result where actor_id=p_actor_id and request_id=p_request_id;
  return v_result;
end;
$fn$;
revoke all on function public.fn_escolher_grupo_atomico(uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.fn_escolher_grupo_atomico(uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text) to service_role;
