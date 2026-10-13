-- CANDIDATE ONLY, NOT APPLIED. Requires reviewed slot-permissions helper.
-- Bidirectional link replacement; refuses inconsistent legacy pairs and stale snapshots.
begin;
create table public.diario_vinculo_recibos(
 actor_id uuid not null references auth.users(id),request_id uuid not null,
 campeonato_id uuid not null references public.campeonatos(id),fingerprint text not null,
 anterior jsonb not null,posterior jsonb not null,resultado jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
alter table public.diario_vinculo_recibos enable row level security;
revoke all on public.diario_vinculo_recibos from public,anon,authenticated,service_role;
grant select on public.diario_vinculo_recibos to service_role;

create function public.dz_daily_link_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare a jsonb;b jsonb;v uuid;
begin
 if TG_OP<>'INSERT' then a:=to_jsonb(OLD);end if;if TG_OP<>'DELETE' then b:=to_jsonb(NEW);end if;
 for v in select distinct value::uuid from(select a->>'campeonato_id' value union all select b->>'campeonato_id') x where value is not null order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('daily:champ:'||v::text,0));
 end loop;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger dz_daily_group_guard before insert or update or delete on public.campeonato_grupos for each row execute function public.dz_daily_link_guard();
create trigger dz_daily_hour_guard before insert or update or delete on public.campeonato_diario_horarios for each row execute function public.dz_daily_link_guard();

create function public.dz_daily_link_snapshot(p_camp uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare groups jsonb;hours jsonb;
begin
 if (select count(*)>2000 from public.campeonato_grupos where campeonato_id=p_camp)
  or(select count(*)>2000 from public.campeonato_diario_horarios where campeonato_id=p_camp) then raise exception using errcode='54000',message='Estrutura do Diário excede o limite.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'diario_horario_id',diario_horario_id,'updated_at',updated_at) order by id),'[]') into groups from public.campeonato_grupos where campeonato_id=p_camp;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'campeonato_id',campeonato_id,'grupo_id',grupo_id,'updated_at',updated_at) order by id),'[]') into hours from public.campeonato_diario_horarios where campeonato_id=p_camp;
 return jsonb_build_object('groups',groups,'hours',hours);
end;
$fn$;
create function public.dz_daily_expected(p_camp uuid,p_value jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare groups jsonb;hours jsonb;item jsonb;
begin
 if jsonb_typeof(p_value) is distinct from 'object' or jsonb_typeof(p_value->'groups') is distinct from 'array' or jsonb_typeof(p_value->'hours') is distinct from 'array'
  or jsonb_array_length(p_value->'groups')>2000 or jsonb_array_length(p_value->'hours')>2000 then raise exception using errcode='22023',message='Snapshot do Diário inválido.';end if;
 for item in select * from jsonb_array_elements(p_value->'groups') union all select * from jsonb_array_elements(p_value->'hours') loop
  if (item->>'campeonato_id')::uuid is distinct from p_camp or item->>'id' is null or item->>'updated_at' is null then raise exception using errcode='22023',message='Snapshot do Diário fora do campeonato.';end if;
 end loop;
 if(select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_value->'groups')) or(select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_value->'hours')) then raise exception using errcode='22023',message='Snapshot do Diário duplicado.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',(x->>'id')::uuid,'campeonato_id',p_camp,'diario_horario_id',(x->>'diario_horario_id')::uuid,'updated_at',(x->>'updated_at')::timestamptz) order by (x->>'id')::uuid),'[]') into groups from jsonb_array_elements(p_value->'groups') x;
 select coalesce(jsonb_agg(jsonb_build_object('id',(x->>'id')::uuid,'campeonato_id',p_camp,'grupo_id',(x->>'grupo_id')::uuid,'updated_at',(x->>'updated_at')::timestamptz) order by (x->>'id')::uuid),'[]') into hours from jsonb_array_elements(p_value->'hours') x;
 return jsonb_build_object('groups',groups,'hours',hours);
end;
$fn$;
create function public.fn_vincular_diario_grupo_atomico(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_daily_hour_id uuid,p_group_id uuid,p_expected jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $fn$
declare receipt public.diario_vinculo_recibos%rowtype;expected jsonb;before jsonb;after jsonb;fingerprint text;out jsonb;
 old_group uuid;old_hour uuid;
begin
 set local lock_timeout='3s';
 if coalesce(auth.role(),current_setting('role',true))<>'service_role' then raise exception using errcode='42501',message='Operação somente pelo backend.';end if;
 if p_actor_id is null or p_request_id is null or p_campeonato_id is null or p_daily_hour_id is null or p_group_id is null or p_expected is null or octet_length(p_expected::text)>4194304 then raise exception using errcode='22023',message='Dados do vínculo inválidos.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 perform pg_advisory_xact_lock(hashtextextended('daily:request:'||p_actor_id::text||':'||p_request_id::text,0));
 expected:=public.dz_daily_expected(p_campeonato_id,p_expected);
 fingerprint:=encode(extensions.digest(jsonb_build_object('championship',p_campeonato_id,'hour',p_daily_hour_id,'group',p_group_id,'expected',expected)::text,'sha256'),'hex');
 select * into receipt from public.diario_vinculo_recibos where actor_id=p_actor_id and request_id=p_request_id;
 if found then
  if receipt.campeonato_id is distinct from p_campeonato_id or receipt.fingerprint is distinct from fingerprint then raise exception using errcode='23505',message='Chave vinculada a outra alteração.';end if;
  return receipt.resultado||jsonb_build_object('repetida',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('daily:champ:'||p_campeonato_id::text,0));
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 if not exists(select 1 from public.campeonatos where id=p_campeonato_id and tipo='diario') then raise exception using errcode='22023',message='Vínculo disponível somente para Diário.';end if;
 before:=public.dz_daily_link_snapshot(p_campeonato_id);
 if before is distinct from expected then raise exception using errcode='40001',message='A estrutura do Diário mudou.';end if;
 select grupo_id into old_group from public.campeonato_diario_horarios where id=p_daily_hour_id and campeonato_id=p_campeonato_id;
 if not found then raise exception using errcode='23514',message='Horário fora do campeonato.';end if;
 select diario_horario_id into old_hour from public.campeonato_grupos where id=p_group_id and campeonato_id=p_campeonato_id;
 if not found then raise exception using errcode='23514',message='Grupo fora do campeonato.';end if;
 if exists(select 1 from public.campeonato_grupos g left join public.campeonato_diario_horarios h on h.id=g.diario_horario_id where g.campeonato_id=p_campeonato_id and g.diario_horario_id is not null and(h.campeonato_id is distinct from p_campeonato_id or h.grupo_id is distinct from g.id))
  or exists(select 1 from public.campeonato_diario_horarios h left join public.campeonato_grupos g on g.id=h.grupo_id where h.campeonato_id=p_campeonato_id and h.grupo_id is not null and(g.campeonato_id is distinct from p_campeonato_id or g.diario_horario_id is distinct from h.id)) then raise exception using errcode='23514',message='Vínculos anteriores exigem reconciliação.';end if;
 if old_group is distinct from p_group_id or old_hour is distinct from p_daily_hour_id then
  -- Clear the two displaced endpoints first, preserving the published unique constraints.
  update public.campeonato_grupos set diario_horario_id=null where campeonato_id=p_campeonato_id and id=old_group and id<>p_group_id;
  update public.campeonato_diario_horarios set grupo_id=null where campeonato_id=p_campeonato_id and id=old_hour and id<>p_daily_hour_id;
  update public.campeonato_grupos set diario_horario_id=p_daily_hour_id where campeonato_id=p_campeonato_id and id=p_group_id;
  update public.campeonato_diario_horarios set grupo_id=p_group_id where campeonato_id=p_campeonato_id and id=p_daily_hour_id;
 end if;
 after:=public.dz_daily_link_snapshot(p_campeonato_id);
 out:=jsonb_build_object('ok',true,'operation_confirmed',true,'actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'request_id',p_request_id,'daily_group_action','link','daily_hour_id',p_daily_hour_id,'group_id',p_group_id,'snapshot',after);
 insert into public.diario_vinculo_recibos values(p_actor_id,p_request_id,p_campeonato_id,fingerprint,before,after,out,now());
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 if public.dz_daily_link_snapshot(p_campeonato_id) is distinct from after or not exists(select 1 from public.campeonato_grupos g join public.campeonato_diario_horarios h on h.id=g.diario_horario_id where g.id=p_group_id and h.id=p_daily_hour_id and h.grupo_id=g.id and g.campeonato_id=p_campeonato_id and h.campeonato_id=p_campeonato_id) then raise exception using errcode='23514',message='Vínculo mudou durante a confirmação.';end if;
 return out;
end;
$fn$;
revoke all on function public.dz_daily_link_guard(),public.dz_daily_link_snapshot(uuid),public.dz_daily_expected(uuid,jsonb),public.fn_vincular_diario_grupo_atomico(uuid,uuid,uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.fn_vincular_diario_grupo_atomico(uuid,uuid,uuid,uuid,uuid,jsonb) to service_role;
commit;
