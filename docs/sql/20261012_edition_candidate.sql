-- CANDIDATE ONLY, NOT APPLIED. Requires reviewed dz_assert_slot_permission helper.
-- User rule: shared franchise metadata requires managing every linked championship.
begin;
create table public.edicao_recibos(
 actor_id uuid not null references auth.users(id),request_id uuid not null,campeonato_id uuid not null references public.campeonatos(id),
 fingerprint text not null,source_championship_id uuid references public.campeonatos(id),franchise_id uuid not null references public.campeonato_franquias(id),
 changed_franchise boolean not null,authorized_members jsonb not null,anterior jsonb not null,posterior jsonb not null,resultado jsonb not null,
 created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
alter table public.edicao_recibos enable row level security;
revoke all on public.edicao_recibos from public,anon,authenticated,service_role;
grant select on public.edicao_recibos to service_role;

create function public.dz_edition_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare a jsonb;b jsonb;v uuid;
begin
 if TG_OP<>'INSERT' then a:=to_jsonb(OLD);end if;if TG_OP<>'DELETE' then b:=to_jsonb(NEW);end if;
 for v in select distinct value::uuid from(select case when TG_TABLE_NAME='campeonato_franquias' then a->>'id' else a->>'franquia_id' end value
  union all select case when TG_TABLE_NAME='campeonato_franquias' then b->>'id' else b->>'franquia_id' end) x where value is not null order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('season:franchise:'||v::text,0));
 end loop;
 if TG_TABLE_NAME='campeonato_edicoes' then
  for v in select distinct value::uuid from(select a->>'campeonato_id' value union all select b->>'campeonato_id') x where value is not null order by 1 loop
   perform pg_advisory_xact_lock(hashtextextended('edition:champ:'||v::text,0));
   perform pg_advisory_xact_lock(hashtextextended('season:champ:'||v::text,0));
  end loop;
 end if;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger dz_edition_franchise_guard before insert or update or delete on public.campeonato_franquias for each row execute function public.dz_edition_guard();
create trigger dz_edition_membership_guard before insert or update or delete on public.campeonato_edicoes for each row execute function public.dz_edition_guard();

create function public.dz_edition_projection(value jsonb,p_franchise boolean default false) returns jsonb
language plpgsql stable set search_path=pg_catalog as $fn$
begin
 if value is null or value='null' then return 'null';end if;
 if p_franchise then return jsonb_build_object('id',(value->>'id')::uuid,'nome',value->>'nome','descricao',value->>'descricao','status',value->>'status','criado_por',(value->>'criado_por')::uuid,'updated_at',(value->>'updated_at')::timestamptz);end if;
 return jsonb_build_object('id',(value->>'id')::uuid,'franquia_id',(value->>'franquia_id')::uuid,'campeonato_id',(value->>'campeonato_id')::uuid,'numero_edicao',(value->>'numero_edicao')::integer,
  'temporada',value->>'temporada','titulo_publico',value->>'titulo_publico','status',value->>'status','updated_at',(value->>'updated_at')::timestamptz);
end;
$fn$;
create function public.dz_edition_assert_members(p_actor uuid,p_franchise uuid,p_creator uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare members jsonb;v uuid;
begin
 if(select count(*)>1000 from public.campeonato_edicoes where franquia_id=p_franchise) then raise exception using errcode='54000',message='Franquia excede o limite de edições.';end if;
 select coalesce(jsonb_agg(campeonato_id order by campeonato_id),'[]') into members from public.campeonato_edicoes where franquia_id=p_franchise;
 if members='[]' and p_creator is distinct from p_actor then raise exception using errcode='42501',message='Franquia sem vínculo não autorizada.';end if;
 for v in select value::uuid from jsonb_array_elements_text(members) loop perform public.dz_assert_slot_permission(p_actor,v,'manage');end loop;
 return members;
end;
$fn$;

create function public.fn_salvar_edicao_atomica(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_values jsonb,p_expected jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,extensions as $fn$
declare receipt public.edicao_recibos%rowtype;current_edition public.campeonato_edicoes%rowtype;source_edition public.campeonato_edicoes%rowtype;fr public.campeonato_franquias%rowtype;
 first_current jsonb;first_source jsonb;before jsonb;after jsonb;fingerprint text;out jsonb;members jsonb:='[]';v uuid;fr_id uuid;source_id uuid;explicit_fr uuid;
 changed boolean;new_fr boolean;new_edition boolean;source_created boolean:=false;name text;description text;fr_status text;number integer;season text;title text;ed_status text;
begin
 set local lock_timeout='3s';
 if coalesce(auth.role(),current_setting('role',true))<>'service_role' then raise exception using errcode='42501',message='Operação somente pelo backend.';end if;
 if p_actor_id is null or p_request_id is null or p_campeonato_id is null or jsonb_typeof(p_values) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object'
  or not(p_expected?'edition') or not(p_values?'edition_number' and p_values?'season' and p_values?'public_title') or octet_length(p_values::text)+octet_length(p_expected::text)>4194304 then raise exception using errcode='22023',message='Dados de edição inválidos.';end if;
 name:=btrim(p_values->>'franchise_name');explicit_fr:=(p_values->>'franchise_id')::uuid;source_id:=(p_values->>'source_championship_id')::uuid;
 if coalesce(name,'')='' or length(name)>180 or source_id=p_campeonato_id then raise exception using errcode='22023',message='Nome ou origem da edição inválido.';end if;
 number:=(p_values->>'edition_number')::integer;if number is not null and number<1 then raise exception using errcode='22023',message='Número da edição inválido.';end if;
 season:=nullif(btrim(p_values->>'season'),'');title:=nullif(btrim(p_values->>'public_title'),'');
 if length(season)>80 or length(title)>180 or length(p_values->>'franchise_description')>1200 or coalesce(p_values->>'franchise_status','ativo') not in('ativo','inativo','arquivado')
  or coalesce(p_values->>'edition_status','planejada') not in('planejada','ativa','encerrada','cancelada','arquivada') then raise exception using errcode='22023',message='Campos da edição inválidos.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');
 perform pg_advisory_xact_lock(hashtextextended('edition:request:'||p_actor_id::text||':'||p_request_id::text,0));
 fingerprint:=encode(extensions.digest(jsonb_build_object('championship',p_campeonato_id,'values',p_values,'expected',p_expected)::text,'sha256'),'hex');
 select * into receipt from public.edicao_recibos where actor_id=p_actor_id and request_id=p_request_id;
 if found then
  if receipt.campeonato_id is distinct from p_campeonato_id or receipt.fingerprint is distinct from fingerprint then raise exception using errcode='23505',message='Chave vinculada a outra edição.';end if;
  if receipt.source_championship_id is not null then perform public.dz_assert_slot_permission(p_actor_id,receipt.source_championship_id,'manage');end if;
  if receipt.changed_franchise then
   for v in select value::uuid from jsonb_array_elements_text(receipt.authorized_members) loop perform public.dz_assert_slot_permission(p_actor_id,v,'manage');end loop;
   perform public.dz_edition_assert_members(p_actor_id,receipt.franchise_id,(select criado_por from public.campeonato_franquias where id=receipt.franchise_id));
  end if;
  return receipt.resultado||jsonb_build_object('repetida',true);
 end if;
 if source_id is not null then
  perform public.dz_assert_slot_permission(p_actor_id,source_id,'manage');
  if (select tipo from public.campeonatos where id=source_id) is distinct from(select tipo from public.campeonatos where id=p_campeonato_id) then raise exception using errcode='23514',message='A origem possui outro formato.';end if;
 end if;
 select * into current_edition from public.campeonato_edicoes where campeonato_id=p_campeonato_id;first_current:=public.dz_edition_projection(to_jsonb(current_edition));
 if source_id is not null then select * into source_edition from public.campeonato_edicoes where campeonato_id=source_id;end if;first_source:=public.dz_edition_projection(to_jsonb(source_edition));
 -- Empty row composites have null IDs, unlike SQL NULL; normalize absence explicitly.
 if current_edition.id is null then first_current:='null';end if;if source_edition.id is null then first_source:='null';end if;
 fr_id:=coalesce(explicit_fr,current_edition.franquia_id,source_edition.franquia_id);new_fr:=fr_id is null;if new_fr then fr_id:=gen_random_uuid();end if;
 if current_edition.id is not null and current_edition.franquia_id is distinct from fr_id then raise exception using errcode='23514',message='Mudança de franquia exige operação própria.';end if;
 if source_edition.id is not null and source_edition.franquia_id is distinct from fr_id then raise exception using errcode='23514',message='A origem não pertence à franquia selecionada.';end if;
 for v in select distinct value from unnest(array[fr_id,current_edition.franquia_id,source_edition.franquia_id]) value where value is not null order by 1 loop perform pg_advisory_xact_lock(hashtextextended('season:franchise:'||v::text,0));end loop;
 for v in select distinct value from unnest(array[p_campeonato_id,source_id]) value where value is not null order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('edition:champ:'||v::text,0));perform pg_advisory_xact_lock(hashtextextended('season:champ:'||v::text,0));
 end loop;
 select * into current_edition from public.campeonato_edicoes where campeonato_id=p_campeonato_id;
 if source_id is not null then select * into source_edition from public.campeonato_edicoes where campeonato_id=source_id;end if;
 if (case when current_edition.id is null then 'null'::jsonb else public.dz_edition_projection(to_jsonb(current_edition)) end) is distinct from first_current
  or (case when source_edition.id is null then 'null'::jsonb else public.dz_edition_projection(to_jsonb(source_edition)) end) is distinct from first_source then raise exception using errcode='40001',message='A edição mudou durante a confirmação.';end if;
 if first_current is distinct from public.dz_edition_projection(p_expected->'edition') then raise exception using errcode='40001',message='A edição apresentada mudou.';end if;
 if source_id is not null and ((p_expected->'source'->>'campeonato_id')::uuid is distinct from source_id or first_source is distinct from public.dz_edition_projection(p_expected->'source'->'edition')) then raise exception using errcode='40001',message='A origem apresentada mudou.';end if;
 if p_expected->'franchise'->>'id' is not null and (p_expected->'franchise'->>'id')::uuid is distinct from fr_id then raise exception using errcode='40001',message='A franquia apresentada mudou.';end if;
 select * into fr from public.campeonato_franquias where id=fr_id;
 if not new_fr and fr.id is null then raise exception using errcode='23514',message='Franquia indisponível.';end if;
 if not new_fr and fr.nome=p_values->>'franchise_name' then name:=fr.nome;end if;
 description:=case when p_values?'franchise_description' then nullif(btrim(p_values->>'franchise_description'),'') else fr.descricao end;
 fr_status:=case when p_values?'franchise_status' then p_values->>'franchise_status' else coalesce(fr.status,'ativo') end;
 ed_status:=case when p_values?'edition_status' then p_values->>'edition_status' else coalesce(current_edition.status,'planejada') end;
 changed:=new_fr or fr.nome is distinct from name or fr.descricao is distinct from description or fr.status is distinct from fr_status;
 if not new_fr and(changed or current_edition.id is null and source_edition.id is null) then members:=public.dz_edition_assert_members(p_actor_id,fr_id,fr.criado_por);end if;
 if not new_fr and changed and public.dz_edition_projection(to_jsonb(fr),true) is distinct from public.dz_edition_projection(p_expected->'franchise',true) then raise exception using errcode='40001',message='Atualize a franquia antes de alterar os dados compartilhados.';end if;
 before:=jsonb_build_object('edition',first_current,'source',first_source,'franchise',case when new_fr then 'null'::jsonb else public.dz_edition_projection(to_jsonb(fr),true) end);
 if new_fr then
  insert into public.campeonato_franquias(id,nome,descricao,status,criado_por) values(fr_id,name,description,fr_status,p_actor_id) returning * into fr;
 elsif changed then update public.campeonato_franquias set nome=name,descricao=description,status=fr_status where id=fr_id returning * into fr;end if;
 if source_id is not null and source_edition.id is null then
  insert into public.campeonato_edicoes(franquia_id,campeonato_id,numero_edicao,temporada,titulo_publico,status) values(fr_id,source_id,1,null,name,'encerrada') returning * into source_edition;source_created:=true;
 end if;
 new_edition:=current_edition.id is null;
 if new_edition then insert into public.campeonato_edicoes(franquia_id,campeonato_id,numero_edicao,temporada,titulo_publico,status) values(fr_id,p_campeonato_id,number,season,title,ed_status) returning * into current_edition;
 else update public.campeonato_edicoes set numero_edicao=number,temporada=season,titulo_publico=title,status=ed_status where id=current_edition.id returning * into current_edition;end if;
 if current_edition.campeonato_id is distinct from p_campeonato_id or current_edition.franquia_id is distinct from fr_id or current_edition.numero_edicao is distinct from number
  or current_edition.temporada is distinct from season or current_edition.titulo_publico is distinct from title or current_edition.status is distinct from ed_status
  or fr.nome is distinct from name or fr.descricao is distinct from description or fr.status is distinct from fr_status
  or fr.criado_por is distinct from(case when new_fr then p_actor_id else (before->'franchise'->>'criado_por')::uuid end)
  or source_created and(source_edition.campeonato_id is distinct from source_id or source_edition.franquia_id is distinct from fr_id or source_edition.numero_edicao is distinct from 1 or source_edition.status is distinct from 'encerrada') then raise exception using errcode='23514',message='Dados de edição alterados durante a gravação.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');if source_id is not null then perform public.dz_assert_slot_permission(p_actor_id,source_id,'manage');end if;
 if changed then members:=public.dz_edition_assert_members(p_actor_id,fr_id,fr.criado_por);end if;
 after:=jsonb_build_object('edition',public.dz_edition_projection(to_jsonb(current_edition)),'source',case when source_edition.id is null then 'null'::jsonb else public.dz_edition_projection(to_jsonb(source_edition)) end,'franchise',public.dz_edition_projection(to_jsonb(fr),true));
 out:=jsonb_build_object('ok',true,'operation_confirmed',true,'actor_id',p_actor_id,'request_id',p_request_id,'campeonato_id',p_campeonato_id,'edition_action','save','edition',after->'edition','franchise',after->'franchise','source_created',source_created);
 insert into public.edicao_recibos values(p_actor_id,p_request_id,p_campeonato_id,fingerprint,source_id,fr_id,changed,members,before,after,out,now());
 if public.dz_edition_projection((select to_jsonb(x) from public.campeonato_edicoes x where id=current_edition.id)) is distinct from after->'edition'
  or public.dz_edition_projection((select to_jsonb(x) from public.campeonato_franquias x where id=fr_id),true) is distinct from after->'franchise'
  or source_id is not null and public.dz_edition_projection((select to_jsonb(x) from public.campeonato_edicoes x where id=source_edition.id)) is distinct from after->'source' then raise exception using errcode='23514',message='Edição mudou durante a confirmação.';end if;
 perform public.dz_assert_slot_permission(p_actor_id,p_campeonato_id,'manage');if source_id is not null then perform public.dz_assert_slot_permission(p_actor_id,source_id,'manage');end if;
 if changed then perform public.dz_edition_assert_members(p_actor_id,fr_id,fr.criado_por);end if;
 if changed and (select coalesce(jsonb_agg(campeonato_id order by campeonato_id),'[]') from public.campeonato_edicoes where franquia_id=fr_id) is distinct from members then raise exception using errcode='23514',message='Os campeonatos vinculados mudaram durante a confirmação.';end if;
 return out;
end;
$fn$;
revoke all on function public.dz_edition_guard(),public.dz_edition_projection(jsonb,boolean),public.dz_edition_assert_members(uuid,uuid,uuid),public.fn_salvar_edicao_atomica(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.fn_salvar_edicao_atomica(uuid,uuid,uuid,jsonb,jsonb) to service_role;
commit;
