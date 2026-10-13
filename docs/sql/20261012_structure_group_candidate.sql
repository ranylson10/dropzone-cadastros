-- CANDIDATE ONLY. NOT APPLIED. Group, physical slots and receipt in one transaction.
-- New structure permission helper preserves canOrganizeGroups precedence.
begin;
create function public.dz_assert_structure_group_permission(p_actor_id uuid,p_campeonato_id uuid)
returns void language plpgsql security definer
set search_path=pg_catalog,public
as $fn$
declare
  v_camp public.campeonatos%rowtype; v_producer public.produtoras%rowtype;
  v_workspace public.produtora_membros%rowtype; v_staff public.manager_produtora%rowtype;
  v_seller public.campeonato_vendedores%rowtype; v_token public.tokens%rowtype;
  v_manager_ids uuid[]; v_allowed boolean:=false;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_actor_id is null or p_campeonato_id is null then
    raise exception using errcode='22023',message='Permissão de movimentação inválida.';
  end if;
  perform 1 from auth.users where id=p_actor_id for share;
  if not found or exists(select 1 from public.sistema_restricoes_conta where auth_user_id=p_actor_id
    and ativo and (expira_em is null or expira_em>clock_timestamp())) then
    raise exception using errcode='42501',message='Conta indisponível para movimentação.';
  end if;
  select * into v_camp from public.campeonatos where id=p_campeonato_id for share;
  if not found or v_camp.deleted_at is not null then
    raise exception using errcode='42501',message='Campeonato indisponível para movimentação.';
  end if;
  select * into v_producer from public.produtoras where id=v_camp.produtora_id for share;
  if v_camp.criado_por=p_actor_id or v_producer.auth_user_id=p_actor_id then return;end if;
  if v_producer.status is distinct from 'deletado' then
    select * into v_workspace from public.produtora_membros where produtora_id=v_camp.produtora_id
      and auth_user_id=p_actor_id and status='ativo' order by id limit 1 for share;
    if found and v_workspace.pode_ver then
      if v_workspace.pode_administrar or v_workspace.pode_operar then return;end if;
      raise exception using errcode='42501',message='Sem permissão para movimentar slots.';
    end if;
  end if;
  perform 1 from public.managers where auth_user_id=p_actor_id and status='ativo' order by id for share;
  select array_agg(id order by id) into v_manager_ids from public.managers where auth_user_id=p_actor_id and status='ativo';
  if v_manager_ids is not null then
    select * into v_staff from public.manager_produtora where manager_id=any(v_manager_ids)
      and produtora_id=v_camp.produtora_id and status='ativo' and (pode_ver or pode_gerenciar_campeonato)
      order by id limit 1 for share;
    if found then
      if v_staff.pode_gerenciar_campeonato then return;end if;
      raise exception using errcode='42501',message='Sem permissão para movimentar slots.';
    end if;
    select * into v_seller from public.campeonato_vendedores where manager_id=any(v_manager_ids)
      and campeonato_id=p_campeonato_id and status='ativo' order by id limit 1 for share;
    if found then
      v_allowed:=coalesce(v_seller.permissoes->'organizar_grupos'='true'::jsonb,false);
    else
      select * into v_token from public.tokens where manager_id=any(v_manager_ids)
        and campeonato_id=p_campeonato_id and tipo='manager_invite' and status='ativo' order by id limit 1 for share;
      v_allowed:=found and coalesce(v_token.manager_permissoes->'organizar_grupos'='true'::jsonb,false);
    end if;
  end if;
  if not v_allowed then raise exception using errcode='42501',message='Sem permissão para movimentar slots.';end if;
end;
$fn$;
revoke all on function public.dz_assert_structure_group_permission(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dz_assert_structure_group_permission(uuid,uuid) to service_role;


-- Current native slot status constraint permits livre/reservado/ocupado only.
-- No deployed capacity function replacement is needed for excluded rows that cannot exist.
create table public.structure_group_revisions (
 campeonato_id uuid primary key references public.campeonatos(id) on delete cascade deferrable initially deferred,
 revision bigint not null default 0 check(revision between 0 and 9007199254740991)
);
create table public.structure_group_receipts (
 actor_id uuid not null references auth.users(id), request_id uuid not null,
 campeonato_id uuid not null references public.campeonatos(id), fingerprint text not null,
 result jsonb not null, created_at timestamptz not null default now(), primary key(actor_id,request_id)
);
alter table public.structure_group_revisions enable row level security;
alter table public.structure_group_receipts enable row level security;
revoke all on public.structure_group_revisions,public.structure_group_receipts from public,anon,authenticated,service_role;
grant select on public.structure_group_revisions,public.structure_group_receipts to service_role;

create function public.dz_structure_group_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $fn$
declare a jsonb;b jsonb;c uuid;parent uuid;parent_phase uuid;
begin
 if TG_OP<>'INSERT' then a:=to_jsonb(OLD);end if;
 if TG_OP<>'DELETE' then b:=to_jsonb(NEW);end if;
 for c in select distinct value::uuid from (
  select case when TG_TABLE_NAME='campeonatos' then a->>'id' else a->>'campeonato_id' end value
  union all select case when TG_TABLE_NAME='campeonatos' then b->>'id' else b->>'campeonato_id' end
 ) x where value is not null order by 1 loop
  perform pg_advisory_xact_lock(hashtextextended('structure-group:champ:'||c::text,0));
  insert into public.structure_group_revisions(campeonato_id,revision) values(c,1)
   on conflict(campeonato_id) do update set revision=structure_group_revisions.revision+1;
 end loop;
 -- Re-read parent mapping AFTER waiting for the locks; never trust the pre-lock relationship.
 if b is not null and TG_TABLE_NAME in('campeonato_grupos','campeonato_slots') then
  c:=(b->>'campeonato_id')::uuid;
  if b->>'fase_id' is not null then
   select campeonato_id into parent from public.campeonato_fases where id=(b->>'fase_id')::uuid;
   if parent is distinct from c then raise exception using errcode='23514',message='Fase fora do campeonato.';end if;
  end if;
  if TG_TABLE_NAME='campeonato_slots' then
   select campeonato_id,fase_id into parent,parent_phase from public.campeonato_grupos where id=(b->>'grupo_id')::uuid;
   if parent is distinct from c or parent_phase is distinct from (b->>'fase_id')::uuid then
    raise exception using errcode='23514',message='Slot fora do grupo/fase do campeonato.';
   end if;
  end if;
 end if;
 if TG_OP='UPDATE' and TG_TABLE_NAME='campeonato_fases' and a->>'campeonato_id' is distinct from b->>'campeonato_id' then
  if exists(select 1 from public.campeonato_grupos where fase_id=(b->>'id')::uuid and campeonato_id is distinct from (b->>'campeonato_id')::uuid)
   or exists(select 1 from public.campeonato_slots where fase_id=(b->>'id')::uuid and campeonato_id is distinct from (b->>'campeonato_id')::uuid) then
   raise exception using errcode='23514',message='Reparent da fase exige reconciliação.';
  end if;
 end if;
 if TG_OP='UPDATE' and TG_TABLE_NAME='campeonato_grupos' then
  if exists(select 1 from public.campeonato_slots where grupo_id=(b->>'id')::uuid
   and (campeonato_id is distinct from (b->>'campeonato_id')::uuid or fase_id is distinct from (b->>'fase_id')::uuid)) then
   raise exception using errcode='23514',message='Reparent do grupo exige reconciliação.';
  end if;
 end if;
 if TG_OP='DELETE' then return OLD;end if;return NEW;
end;
$fn$;
create trigger aa_dz_structure_group_guard before insert or update or delete on public.campeonatos for each row execute function public.dz_structure_group_guard();
create trigger aa_dz_structure_group_guard before insert or update or delete on public.campeonato_configuracoes for each row execute function public.dz_structure_group_guard();
create trigger aa_dz_structure_group_guard before insert or update or delete on public.campeonato_fases for each row execute function public.dz_structure_group_guard();
create trigger aa_dz_structure_group_guard before insert or update or delete on public.campeonato_grupos for each row execute function public.dz_structure_group_guard();
create trigger aa_dz_structure_group_guard before insert or update or delete on public.campeonato_slots for each row execute function public.dz_structure_group_guard();

create function public.dz_structure_group_image(p_champ uuid,p_phase uuid) returns jsonb
language plpgsql volatile security definer set search_path=pg_catalog,public as $fn$
declare image jsonb;
begin
 if (select count(*) from public.campeonato_fases where campeonato_id=p_champ)>1000
  or (select count(*) from public.campeonato_slots where campeonato_id=p_champ)>50000 then
  raise exception using errcode='54000',message='Estrutura excessiva para criar grupo.';
 end if;
 select jsonb_build_object(
  'phase',(select to_jsonb(f) from public.campeonato_fases f where id=p_phase and campeonato_id=p_champ),
  'phases',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'ordem',ordem,'tipo',tipo,'updated_at',updated_at) order by id),'[]') from public.campeonato_fases where campeonato_id=p_champ),
  'config',(select jsonb_build_object('id',id,'numero_vagas',numero_vagas,'updated_at',updated_at) from public.campeonato_configuracoes where campeonato_id=p_champ),
  'slots',(select coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') from public.campeonato_slots s where campeonato_id=p_champ),
  'revision',coalesce((select revision from public.structure_group_revisions where campeonato_id=p_champ),0)
 ) into image;
 if octet_length(image::text)>4194304 then raise exception using errcode='54000',message='Estrutura excessiva para criar grupo.';end if;
 return image;
end;
$fn$;

create function public.fn_criar_grupo_atomico(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_action text,p_values jsonb,p_expected text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions as $fn$
declare receipt public.structure_group_receipts%rowtype;phase public.campeonato_fases%rowtype;grp public.campeonato_grupos%rowtype;
 before_image jsonb;after_image jsonb;expected_slots jsonb;created_slots jsonb;result jsonb;fingerprint text;fence text;phase_id uuid;
 name text;whatsapp text;slot_count integer;quota integer;existing bigint;entry_order integer;is_entry boolean;group_id uuid;actual_count bigint;
begin
 set local lock_timeout='3s';
 if coalesce(auth.role(),current_setting('role',true))<>'service_role' then raise exception using errcode='42501',message='Operação exclusiva do backend.';end if;
 if p_actor_id is null or p_request_id is null or p_campeonato_id is null or p_action is null or p_action not in('preview_create_group','create_group')
  or jsonb_typeof(p_values) is distinct from 'object' or octet_length(p_values::text)>8192 then
  raise exception using errcode='22023',message='Dados de grupo inválidos.';
 end if;
 phase_id:=(p_values->>'fase_id')::uuid;name:=btrim(p_values->>'nome');whatsapp:=nullif(btrim(p_values->>'whatsapp_url'),'');
 if phase_id is null or coalesce(name,'')='' or length(name)>180 or length(whatsapp)>2048
  or jsonb_typeof(p_values->'slots') is distinct from 'number' or (p_values->>'slots')::numeric <> trunc((p_values->>'slots')::numeric)
  or (p_values->>'slots')::numeric not between 1 and 52 then raise exception using errcode='22023',message='Dados de grupo inválidos.';end if;
 slot_count:=(p_values->>'slots')::integer;
 perform public.dz_assert_structure_group_permission(p_actor_id,p_campeonato_id);
 perform pg_advisory_xact_lock(hashtextextended('structure-group:request:'||p_actor_id::text||':'||p_request_id::text,0));
 fingerprint:=encode(extensions.digest(jsonb_build_object('champ',p_campeonato_id,'action',p_action,'values',p_values,'expected',p_expected)::text,'sha256'),'hex');
 select * into receipt from public.structure_group_receipts where actor_id=p_actor_id and request_id=p_request_id;
 if found then
  if receipt.campeonato_id is distinct from p_campeonato_id or receipt.fingerprint is distinct from fingerprint then
   raise exception using errcode='23505',message='Chave vinculada a outro grupo.';
  end if;
  return receipt.result||jsonb_build_object('repetida',true);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('structure-group:champ:'||p_campeonato_id::text,0));
 perform public.dz_assert_structure_group_permission(p_actor_id,p_campeonato_id);
 select * into phase from public.campeonato_fases where id=phase_id and campeonato_id=p_campeonato_id;
 if not found then raise exception using errcode='23514',message='Fase fora do campeonato.';end if;
 if phase.tipo='grande_final' then raise exception using errcode='23514',message='A Grande Final usa o Grupo da Final automático.';end if;
 before_image:=public.dz_structure_group_image(p_campeonato_id,phase_id);
 select min(ordem) into entry_order from public.campeonato_fases where campeonato_id=p_campeonato_id;
 is_entry:=entry_order is null or phase.ordem=entry_order;
 quota:=nullif((before_image->'config'->>'numero_vagas')::integer,0);if quota<0 then quota:=null;end if;
 select count(*) into existing from public.campeonato_slots s left join public.campeonato_fases f on f.id=s.fase_id and f.campeonato_id=p_campeonato_id
  where s.campeonato_id=p_campeonato_id and s.status<>'excluido' and (entry_order is null or s.fase_id is null or f.ordem=entry_order);
 if is_entry and quota is not null and existing+slot_count>quota then raise exception using errcode='23514',message='Limite de vagas da fase de entrada excedido.';end if;
 fence:=encode(extensions.digest(before_image::text,'sha256'),'hex');
 if p_action='preview_create_group' then
  if p_expected is not null then raise exception using errcode='22023',message='Prévia não recebe confirmação anterior.';end if;
  return jsonb_build_object('ok',true,'mode','atomic','actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'request_id',p_request_id,
   'action',p_action,'repetida',false,'preview',jsonb_build_object('fence',fence,'phase_id',phase_id,'phase_name',phase.nome,'slots',slot_count,'entry',is_entry,'entry_slots',existing,'quota',quota));
 end if;
 if p_expected is null or p_expected!~'^[0-9a-f]{64}$' or p_expected is distinct from fence then raise exception using errcode='40001',message='A estrutura ou a capacidade mudou.';end if;
 insert into public.campeonato_grupos(campeonato_id,fase_id,nome,slots,whatsapp_url) values(p_campeonato_id,phase_id,name,slot_count,whatsapp) returning * into grp;
 group_id:=grp.id;
 insert into public.campeonato_slots(campeonato_id,fase_id,grupo_id,slot_numero,slot_letra,status)
  select p_campeonato_id,phase_id,group_id,n,case when n<=26 then chr(64+n) else 'A'||chr(64+n-26) end,'livre' from generate_series(1,slot_count)n;
 select count(*),coalesce(jsonb_agg(to_jsonb(s) order by id),'[]') into actual_count,created_slots from public.campeonato_slots s where grupo_id=group_id;
 if actual_count<>slot_count or exists(select 1 from public.campeonato_slots s where grupo_id=group_id and
  (campeonato_id<>p_campeonato_id or fase_id is distinct from phase_id or status<>'livre' or equipe_id is not null or line_id is not null
   or slot_numero not between 1 and slot_count or slot_letra is distinct from case when slot_numero<=26 then chr(64+slot_numero) else 'A'||chr(64+slot_numero-26) end))
  or (select count(distinct slot_numero) from public.campeonato_slots where grupo_id=group_id)<>slot_count then
  raise exception using errcode='23514',message='Slots criados não correspondem ao grupo.';
 end if;
 select coalesce(jsonb_agg(value order by value->>'id'),'[]') into expected_slots from jsonb_array_elements((before_image->'slots')||created_slots);
 after_image:=public.dz_structure_group_image(p_campeonato_id,phase_id);
 if (after_image-'slots'-'revision') is distinct from (before_image-'slots'-'revision') or after_image->'slots' is distinct from expected_slots
  or (select to_jsonb(g) from public.campeonato_grupos g where id=group_id) is distinct from to_jsonb(grp) then raise exception using errcode='23514',message='Estrutura mudou durante a criação.';end if;
 result:=jsonb_build_object('ok',true,'mode','atomic','actor_id',p_actor_id,'campeonato_id',p_campeonato_id,'request_id',p_request_id,
  'action',p_action,'operation_confirmed',true,'repetida',false,'grupo',jsonb_build_object('id',grp.id,'campeonato_id',grp.campeonato_id,'fase_id',grp.fase_id,'nome',grp.nome,'slots',grp.slots,'whatsapp_url',grp.whatsapp_url),
  'slots_created',slot_count);
 perform public.dz_assert_structure_group_permission(p_actor_id,p_campeonato_id);
 insert into public.structure_group_receipts(actor_id,request_id,campeonato_id,fingerprint,result) values(p_actor_id,p_request_id,p_campeonato_id,fingerprint,result);
 if public.dz_structure_group_image(p_campeonato_id,phase_id) is distinct from after_image
  or (select to_jsonb(g) from public.campeonato_grupos g where id=group_id) is distinct from to_jsonb(grp) then raise exception using errcode='23514',message='Estrutura mudou depois do recibo.';end if;
 perform public.dz_assert_structure_group_permission(p_actor_id,p_campeonato_id);
 return result;
end;
$fn$;
revoke all on function public.dz_assert_structure_group_permission(uuid,uuid),public.dz_structure_group_guard(),public.dz_structure_group_image(uuid,uuid),public.fn_criar_grupo_atomico(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated,service_role;
grant execute on function public.fn_criar_grupo_atomico(uuid,uuid,uuid,text,jsonb,text) to service_role;
commit;
