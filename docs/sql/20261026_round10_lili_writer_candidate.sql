-- DROPZONE R10 / CANDIDATE. NOT a production migration.
-- Prerequisites: deployed fn_is_service_role(), R09 atomic slot plan, R02 mirror guard,
-- and a staging restore. ALL writers must lock group -> slot before eligibility reads.
-- Install alongside round10_block_writer_candidate.sql in STAGING first.
-- Adds fn_lili_reservar_slot_r10 with the SAME inputs/return type; does not replace legacy.
begin;

create function public.fn_lili_reservar_slot_r10(
  p_codigo text,p_campeonato_id uuid,p_grupo_id uuid,p_slot_id uuid,
  p_auth_user_id uuid,p_equipe_id uuid,p_line_id uuid,p_nome_line text,
  p_convite_token text,p_metodo text,p_minutos integer,p_meta jsonb default '{}'::jsonb
) returns public.lili_reservas_slot
language plpgsql security definer
set search_path = pg_catalog, public
as $r10$
declare
  v_group public.campeonato_grupos%rowtype;
  v_slot public.campeonato_slots%rowtype;
  v_reserva public.lili_reservas_slot%rowtype;
  v_expira timestamptz;
  v_expired_count integer:=0;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_codigo is null or nullif(btrim(p_codigo),'') is null or p_campeonato_id is null
    or p_grupo_id is null or p_slot_id is null or p_auth_user_id is null
    or p_equipe_id is null or p_metodo not in ('pix','cartao','paypal','whatsapp')
    or p_metodo is null or jsonb_typeof(coalesce(p_meta,'{}'::jsonb)) <> 'object' then
    raise exception using errcode='22023',message='Dados de reserva inválidos.';
  end if;
  v_expira:=clock_timestamp()+make_interval(mins=>greatest(1,least(coalesce(p_minutos,15),120)));

  -- Lock ORDER: group first, then slot; same as atomic enrollment and movement.
  -- This serializes a cooperating admin block against the reservation.
  select * into v_group from public.campeonato_grupos
    where id=p_grupo_id and campeonato_id=p_campeonato_id for update;
  if not found or v_group.fase_id is null then
    raise exception using errcode='22023',message='Grupo inválido para a reserva.';
  end if;
  select * into v_slot from public.campeonato_slots
    where id=p_slot_id and grupo_id=p_grupo_id and campeonato_id=p_campeonato_id for update;
  if not found or v_slot.fase_id is distinct from v_group.fase_id then
    raise exception using errcode='22023',message='Slot fora da fase selecionada.';
  end if;
  if v_slot.equipe_id is not null or v_slot.line_id is not null or v_slot.status='ocupado' then
    raise exception using errcode='23505',message='Slot já ocupado.';
  end if;
  if exists(select 1 from public.campeonato_grupo_escolha_bloqueios b
       where b.campeonato_id=p_campeonato_id and b.fase_id=v_group.fase_id
         and b.ativo and (b.grupo_id=p_grupo_id or b.slot_id=p_slot_id)) then
    raise exception using errcode='23505',message='Grupo ou slot bloqueado.';
  end if;
  if exists(select 1 from public.tokens t where t.slot_id=p_slot_id
       and t.campeonato_id=p_campeonato_id
       and t.tipo in ('team_invite','convite_equipe_campeonato')
       and t.status='ativo' and coalesce(t.usado,false)=false
       and (t.expira_em is null or t.expira_em>clock_timestamp())
       and (p_convite_token is null or t.token is distinct from p_convite_token
         or (t.equipe_id is not null and t.equipe_id is distinct from p_equipe_id)
         or (t.equipe_destino_id is not null and t.equipe_destino_id is distinct from p_equipe_id)
         or (t.line_destino_id is not null and t.line_destino_id is distinct from p_line_id))) then
    raise exception using errcode='23505',message='Slot reservado para outro convite.';
  end if;

  -- Expire only this slot after locking it. A global UPDATE before the group
  -- lock causes lock-order inversion with enrollment and admin writers.
  update public.lili_reservas_slot set status='expirada',updated_at=clock_timestamp()
    where slot_id=p_slot_id and status='ativa' and expira_em<=clock_timestamp();
  get diagnostics v_expired_count = row_count;
  select * into v_reserva from public.lili_reservas_slot
    where slot_id=p_slot_id and status='ativa' and expira_em>clock_timestamp() for update;
  if found and v_reserva.auth_user_id is distinct from p_auth_user_id then
    raise exception using errcode='23505',message='Slot reservado por outra conta.';
  end if;
  -- A reserved slot may be renewed only by its active Lili reservation,
  -- or by presenting the matching active invitation token.
  if v_slot.status='reservado' and not found and v_expired_count=0
     and not exists(select 1 from public.tokens t where t.slot_id=p_slot_id
       and t.campeonato_id=p_campeonato_id and t.token=p_convite_token
       and (t.equipe_id is null or t.equipe_id=p_equipe_id)
       and (t.equipe_destino_id is null or t.equipe_destino_id=p_equipe_id)
       and (t.line_destino_id is null or t.line_destino_id=p_line_id)
       and t.tipo in ('team_invite','convite_equipe_campeonato')
       and t.status='ativo' and coalesce(t.usado,false)=false
       and (t.expira_em is null or t.expira_em>clock_timestamp())) then
    raise exception using errcode='23505',message='Slot reservado por outro fluxo.';
  end if;
  if v_slot.status not in ('livre','reservado') or v_slot.status is null then
    raise exception using errcode='23505',message='Slot indisponível.';
  end if;
  if found then
    update public.lili_reservas_slot
      set equipe_id=p_equipe_id,line_id=p_line_id,nome_line=p_nome_line,
          convite_token=p_convite_token,metodo=p_metodo,expira_em=v_expira,
          meta=coalesce(p_meta,'{}'::jsonb),updated_at=clock_timestamp()
      where id=v_reserva.id returning * into v_reserva;
  else
    insert into public.lili_reservas_slot(codigo,campeonato_id,grupo_id,slot_id,
      auth_user_id,equipe_id,line_id,nome_line,convite_token,metodo,expira_em,meta)
      values(p_codigo,p_campeonato_id,p_grupo_id,p_slot_id,p_auth_user_id,p_equipe_id,
      p_line_id,p_nome_line,p_convite_token,p_metodo,v_expira,coalesce(p_meta,'{}'::jsonb))
      returning * into v_reserva;
  end if;
  update public.campeonato_slots set status='reservado',updated_at=clock_timestamp()
    where id=p_slot_id and equipe_id is null and line_id is null and status in ('livre','reservado');
  if not found then raise exception using errcode='40001',message='Slot alterado durante a reserva.'; end if;
  return v_reserva;
end;
$r10$;
revoke all on function public.fn_lili_reservar_slot_r10(text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,integer,jsonb)
 from public,anon,authenticated;
grant execute on function public.fn_lili_reservar_slot_r10(text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,integer,jsonb)
 to service_role;
commit;
