-- DROPZONE R11 / CANDIDATA PARA STAGING. NAO EXECUTAR DIRETO EM PRODUCAO.
-- Dependencias: fn_is_service_role(), dz_assert_slot_permission() (R09),
-- triggers atuais de tokens/slots, R10 bloqueios e escritor Lili homologados.
-- A RPC protege APENAS os chamadores que optarem pelo modo atomico.
-- Todo escritor de tokens precisa migrar para a ordem grupo -> slot -> token.
begin;

create table public.campeonato_convite_recibos (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  fingerprint text not null,
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
alter table public.campeonato_convite_recibos enable row level security;
revoke all on public.campeonato_convite_recibos from public,anon,authenticated;
grant select,insert on public.campeonato_convite_recibos to service_role;

create function public.fn_alterar_convite_slot_r11(
  p_actor_id uuid, p_request_id uuid, p_campeonato_id uuid,
  p_token_id uuid, p_action text
) returns jsonb language plpgsql security definer
set search_path=pg_catalog,public,extensions
as $r11$
declare
 v_before public.tokens%rowtype;
 v_token public.tokens%rowtype;
 v_new public.tokens%rowtype;
 v_group public.campeonato_grupos%rowtype;
 v_slot public.campeonato_slots%rowtype;
 v_group_id uuid;
 v_fingerprint text;
 v_previous record;
 v_result jsonb;
 v_now timestamptz;
 v_new_token text;
begin
 if not coalesce(public.fn_is_service_role(),false) then
   raise exception using errcode='42501',message='Operação exclusiva do backend.';
 end if;
 if p_actor_id is null or p_request_id is null or p_campeonato_id is null or
   p_token_id is null or p_action is null or p_action not in ('cancel','renew') then
   raise exception using errcode='22023',message='Parâmetros de convite inválidos.';
 end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 perform pg_advisory_xact_lock(hashtextextended('invite:'||p_actor_id::text||':'||p_request_id::text,0));
 v_fingerprint:=encode(extensions.digest(jsonb_build_object('campeonato',p_campeonato_id,
    'token',p_token_id,'action',p_action)::text,'sha256'),'hex');
 select * into v_previous from public.campeonato_convite_recibos
   where actor_id=p_actor_id and request_id=p_request_id;
 if found then
   if v_previous.fingerprint is distinct from v_fingerprint then
     raise exception using errcode='23505',message='Chave já utilizada em outro convite.';
   end if;
   return v_previous.resultado||jsonb_build_object('repetida',true);
 end if;

 -- Leitura preliminar SEM bloqueio, usada SOMENTE para localizar o grupo.
 -- O token e seu relacionamento com o slot são revalidados após obter os locks.
 select * into v_before from public.tokens
   where id=p_token_id and campeonato_id=p_campeonato_id;
 if not found or v_before.tipo not in ('convite_equipe_campeonato','team_invite') then
   raise exception using errcode='22023',message='Convite de equipe inexistente.';
 end if;
 v_group_id:=v_before.grupo_id;
 if v_before.slot_id is not null then
   select grupo_id into v_group_id from public.campeonato_slots
    where id=v_before.slot_id and campeonato_id=p_campeonato_id;
   if not found then raise exception using errcode='22023',message='Slot inválido.'; end if;
 end if;
 if v_group_id is null then raise exception using errcode='22023',message='Convite sem grupo.'; end if;

 -- ORDEM COOPERATIVA: grupo -> slot -> token.
 select * into v_group from public.campeonato_grupos
   where id=v_group_id and campeonato_id=p_campeonato_id for update;
 if not found then raise exception using errcode='22023',message='Grupo não encontrado.'; end if;
 if v_before.slot_id is not null then
   select * into v_slot from public.campeonato_slots
     where id=v_before.slot_id and campeonato_id=p_campeonato_id
       and grupo_id=v_group_id for update;
   if not found or v_slot.fase_id is distinct from v_group.fase_id then
     raise exception using errcode='22023',message='Slot fora da fase selecionada.';
   end if;
 end if;
 select * into v_token from public.tokens
   where id=p_token_id and campeonato_id=p_campeonato_id for update;
 if not found or v_token.slot_id is distinct from v_before.slot_id
   or v_token.grupo_id is distinct from v_before.grupo_id
   or v_token.tipo not in ('convite_equipe_campeonato','team_invite') then
   raise exception using errcode='40001',message='Convite alterado durante a operação.';
 end if;
 if v_token.usado or v_token.status is distinct from 'ativo' then
   raise exception using errcode='23505',message='Convite não está mais ativo.';
 end if;
 -- Renewing must obey the same admin group/slot blocks as first enrollment.
 -- Cancellation stays permitted so an admin can remove an obsolete invitation.
 if p_action='renew' and exists (
   select 1 from public.campeonato_grupo_escolha_bloqueios b
   where b.campeonato_id=p_campeonato_id and b.fase_id=v_group.fase_id
     and b.ativo and (b.grupo_id=v_group_id or
       (v_token.slot_id is not null and b.slot_id=v_token.slot_id))
 ) then raise exception using errcode='23505',message='Grupo ou slot bloqueado para renovação.'; end if;
 if v_token.slot_id is not null and p_action='renew' and
   (v_slot.equipe_id is not null or v_slot.line_id is not null or v_slot.status='ocupado') then
   raise exception using errcode='23505',message='O slot já está ocupado.';
 end if;
 if p_action='renew' and v_token.slot_id is not null and exists (
   select 1 from public.lili_reservas_slot r where r.slot_id=v_token.slot_id
   and r.status='ativa' and r.expira_em>clock_timestamp()
 ) then raise exception using errcode='23505',message='Slot reservado pela Lili.'; end if;

 v_now:=clock_timestamp();
 if p_action='renew' then
   v_new_token:=encode(extensions.gen_random_bytes(18),'hex');
   insert into public.tokens(token,tipo,produtora_id,campeonato_id,fase_id,grupo_id,
     slot_id,equipe_id,equipe_destino_id,line_destino_id,nome_equipe_reservada,
     nome_line_reservada,criado_por,usado,expira_em,status)
   values(v_new_token,v_token.tipo,v_token.produtora_id,p_campeonato_id,
     v_token.fase_id,v_group_id,v_token.slot_id,v_token.equipe_id,
     v_token.equipe_destino_id,v_token.line_destino_id,
     v_token.nome_equipe_reservada,v_token.nome_line_reservada,
     p_actor_id,false,v_now+interval '24 hours','ativo') returning * into v_new;
 end if;
 -- Trigger legado executa nesta instrução; após ele, reconcilia-se o slot.
 update public.tokens set status='cancelado',updated_at=v_now
   where id=v_token.id and status='ativo' and usado=false;
 if not found then raise exception using errcode='40001',message='O convite mudou.'; end if;

 if v_token.slot_id is not null and v_slot.status<>'ocupado'
   and v_slot.equipe_id is null and v_slot.line_id is null then
   update public.campeonato_slots s set
     status=case when exists(select 1 from public.tokens t where t.slot_id=s.id
          and t.tipo in ('convite_equipe_campeonato','team_invite')
          and t.status='ativo' and not coalesce(t.usado,false)
          and (t.expira_em is null or t.expira_em>v_now))
       or exists(select 1 from public.lili_reservas_slot r where r.slot_id=s.id
          and r.status='ativa' and r.expira_em>v_now)
       then 'reservado' else 'livre' end,
     updated_at=v_now
     where s.id=v_token.slot_id and s.equipe_id is null and s.line_id is null
       and s.status<>'ocupado';
 end if;
 v_result:=jsonb_build_object('ok',true,'action',p_action,
   'campeonato_id',p_campeonato_id,'token_id',v_token.id,
   'convite',case when p_action='renew' then to_jsonb(v_new) else null end);
 insert into public.campeonato_convite_recibos(actor_id,request_id,fingerprint,resultado)
   values(p_actor_id,p_request_id,v_fingerprint,v_result);
 return v_result;
end;
$r11$;
revoke all on function public.fn_alterar_convite_slot_r11(uuid,uuid,uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.fn_alterar_convite_slot_r11(uuid,uuid,uuid,uuid,text)
  to service_role;
commit;
