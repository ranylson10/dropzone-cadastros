-- CANDIDATE ONLY. Install BEFORE the revised slot plan and transfer wrapper.
-- Matches backend precedence: owner > visible workspace > first eligible staff
-- > first championship seller > first legacy manager_invite (each tier ordered by id).
-- No union of unrelated grants. Legacy token expiry semantics remain unchanged.
-- Existing grant rows are held FOR SHARE; absence/new membership phantoms and
-- noncooperating permission writers still require staging/lock-protocol review.
create function public.dz_assert_slot_permission(p_actor_id uuid,p_campeonato_id uuid,p_permission text)
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
  if p_actor_id is null or p_campeonato_id is null or p_permission is null or p_permission not in('owner','manage','team') then
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
  -- Team ownership is enforced by the primitive/wrapper under the team lock.
  -- This grants only entry to that narrower check, never management permission.
  if p_permission='team' then return;end if;
  select * into v_producer from public.produtoras where id=v_camp.produtora_id for share;
  if v_camp.criado_por=p_actor_id or v_producer.auth_user_id=p_actor_id then return;end if;
  if p_permission='owner' then
    raise exception using errcode='42501',message='Esta versão exige o proprietário do campeonato.';
  end if;
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
      v_allowed:=coalesce(v_seller.permissoes->'adicionar_equipes'='true'::jsonb,false);
    else
      select * into v_token from public.tokens where manager_id=any(v_manager_ids)
        and campeonato_id=p_campeonato_id and tipo='manager_invite' and status='ativo' order by id limit 1 for share;
      v_allowed:=found and coalesce(v_token.manager_permissoes->'adicionar_equipes'='true'::jsonb,false);
    end if;
  end if;
  if not v_allowed then raise exception using errcode='42501',message='Sem permissão para movimentar slots.';end if;
end;
$fn$;
revoke all on function public.dz_assert_slot_permission(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.dz_assert_slot_permission(uuid,uuid,text) to service_role;

create function public.dz_assert_team_choice_window(p_campeonato_id uuid,p_fase_id uuid,
  p_requires_change boolean,p_grupo_id uuid,p_slot_id uuid)
returns void language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare v_config public.campeonato_grupo_escolha_configuracoes%rowtype;v_now timestamptz;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  select * into v_config from public.campeonato_grupo_escolha_configuracoes
    where campeonato_id=p_campeonato_id and fase_id=p_fase_id for share;
  v_now:=clock_timestamp();
  if not found or not v_config.aberta or (v_config.abre_em is not null and v_config.fecha_em is not null and v_config.abre_em>v_config.fecha_em)
    or (v_config.abre_em is not null and v_config.abre_em>v_now) or (v_config.fecha_em is not null and v_config.fecha_em<v_now) then
    raise exception using errcode='42501',message='A escolha de grupos não está aberta para esta fase.';
  end if;
  if p_requires_change and not v_config.permite_troca then
    raise exception using errcode='42501',message='A alteração de escolha está bloqueada nesta fase.';
  end if;
  if p_slot_id is not null then
    perform 1 from public.campeonato_grupo_escolha_bloqueios where campeonato_id=p_campeonato_id
      and fase_id=p_fase_id and ativo and (grupo_id=p_grupo_id or slot_id=p_slot_id) order by id for share;
    if found then raise exception using errcode='42501',message='O grupo ou slot está bloqueado pela administração.';end if;
  end if;
  -- Existing rows are held; insertion of new blockers by other writers remains a staging concern.
end;
$fn$;
revoke all on function public.dz_assert_team_choice_window(uuid,uuid,boolean,uuid,uuid) from public,anon,authenticated;
grant execute on function public.dz_assert_team_choice_window(uuid,uuid,boolean,uuid,uuid) to service_role;
