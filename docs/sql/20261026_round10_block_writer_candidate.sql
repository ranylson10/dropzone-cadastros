-- DROPZONE R10 / CANDIDATE. NOT applied. Requires dz_assert_slot_permission(),
-- fn_is_service_role(), and R09 atomic slot functions in staging first.
-- Backend must authenticate requester; DB checks championship management again.
-- The receipt is transactionally committed with the block operation.
begin;
create table public.campeonato_bloqueio_recibos (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  fingerprint text not null,
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
alter table public.campeonato_bloqueio_recibos enable row level security;
revoke all on public.campeonato_bloqueio_recibos from public,anon,authenticated;
grant select on public.campeonato_bloqueio_recibos to service_role;

create function public.fn_alterar_bloqueio_grupo_atomico(
 p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_action text,
 p_fase_id uuid default null,p_grupo_id uuid default null,p_slot_id uuid default null,
 p_block_id uuid default null,p_reason text default null
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $r10$
declare
 v_group public.campeonato_grupos%rowtype;
 v_slot public.campeonato_slots%rowtype;
 v_block public.campeonato_grupo_escolha_bloqueios%rowtype;
 v_group_id uuid;v_slot_id uuid;v_phase uuid;
 v_fingerprint text;v_receipt record;v_result jsonb;
begin
 if not coalesce(public.fn_is_service_role(),false) then
   raise exception using errcode='42501',message='Operação exclusiva do backend.';
 end if;
 if p_actor_id is null or p_request_id is null or p_campeonato_id is null
   or p_action not in ('block','unblock') or p_action is null
   or length(coalesce(p_reason,''))>300
   or (p_action='block' and (p_fase_id is null or (p_grupo_id is null)=(p_slot_id is null) or p_block_id is not null))
   or (p_action='unblock' and (p_block_id is null or p_fase_id is not null or p_grupo_id is not null or p_slot_id is not null)) then
   raise exception using errcode='22023',message='Bloqueio inválido.';
 end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 perform pg_advisory_xact_lock(hashtextextended('group_block:'||p_actor_id::text||':'||p_request_id::text,0));
 v_fingerprint:=encode(extensions.digest(jsonb_build_object('campeonato',p_campeonato_id,
   'action',p_action,'fase',p_fase_id,'grupo',p_grupo_id,'slot',p_slot_id,
   'block',p_block_id,'reason',nullif(btrim(p_reason),''))::text,'sha256'),'hex');
 select * into v_receipt from public.campeonato_bloqueio_recibos
   where actor_id=p_actor_id and request_id=p_request_id;
 if found then
   if v_receipt.fingerprint is distinct from v_fingerprint then
     raise exception using errcode='23505',message='Chave de repetição vinculada a outro bloqueio.';
   end if;
   return v_receipt.resultado||jsonb_build_object('repetida',true);
 end if;
 if p_action='unblock' then
   select * into v_block from public.campeonato_grupo_escolha_bloqueios
     where id=p_block_id and campeonato_id=p_campeonato_id;
   if not found then raise exception using errcode='22023',message='Bloqueio não encontrado.'; end if;
   v_slot_id:=v_block.slot_id;
   v_group_id:=v_block.grupo_id;
   v_phase:=v_block.fase_id;
 else
   v_slot_id:=p_slot_id;v_group_id:=p_grupo_id;v_phase:=p_fase_id;
 end if;
 -- Resolve slot's parent WITHOUT locking, then lock actual group -> slot.
 if v_slot_id is not null then
   select grupo_id into v_group_id from public.campeonato_slots where id=v_slot_id and campeonato_id=p_campeonato_id;
   if not found then raise exception using errcode='22023',message='Slot inválido para bloqueio.'; end if;
 end if;
 select * into v_group from public.campeonato_grupos
   where id=v_group_id and campeonato_id=p_campeonato_id for update;
 if not found or v_group.fase_id is distinct from v_phase then
   raise exception using errcode='22023',message='Grupo ou fase incompatíveis.';
 end if;
 if v_slot_id is not null then
   select * into v_slot from public.campeonato_slots
     where id=v_slot_id and campeonato_id=p_campeonato_id and grupo_id=v_group_id for update;
   if not found or v_slot.fase_id is distinct from v_phase then
     raise exception using errcode='22023',message='Slot fora da fase.';
   end if;
 end if;
 if p_action='block' then
   insert into public.campeonato_grupo_escolha_bloqueios
     (campeonato_id,fase_id,grupo_id,slot_id,motivo,criado_por)
     values(p_campeonato_id,v_phase,case when v_slot_id is null then v_group_id else null end,
       v_slot_id,nullif(btrim(p_reason),''),p_actor_id)
     returning * into v_block;
 else
   update public.campeonato_grupo_escolha_bloqueios
     set ativo=false,removido_por=p_actor_id,removed_at=clock_timestamp()
     where id=p_block_id and campeonato_id=p_campeonato_id and ativo=true
       and fase_id=v_phase and grupo_id is not distinct from v_block.grupo_id
       and slot_id is not distinct from v_block.slot_id
     returning * into v_block;
   if not found then raise exception using errcode='40001',message='Bloqueio já removido ou alterado.'; end if;
 end if;
 v_result:=jsonb_build_object('ok',true,'campeonato_id',p_campeonato_id,
   'action',p_action,'block_id',v_block.id,'ativo',v_block.ativo);
 insert into public.campeonato_bloqueio_recibos(actor_id,request_id,fingerprint,resultado)
   values(p_actor_id,p_request_id,v_fingerprint,v_result);
 return v_result;
end;
$r10$;
revoke all on function public.fn_alterar_bloqueio_grupo_atomico(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.fn_alterar_bloqueio_grupo_atomico(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid,text)
  to service_role;
commit;
