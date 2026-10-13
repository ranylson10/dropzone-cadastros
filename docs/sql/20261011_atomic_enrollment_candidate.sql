-- CANDIDATE ONLY: not an automatic migration. HTTP integration is opt-in and OFF by default.
-- Apply mirror/index candidates first in staging. Export fresh schema/ACL/owners.
-- Every call is ONE database transaction. The backend must authenticate the actor
-- and pass a stable UUID idempotency key on all retries; no multi-write fallback.
begin;

create table public.inscricao_recibos (
  actor_id uuid not null references auth.users(id),
  request_id uuid not null,
  fingerprint text not null,
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
alter table public.inscricao_recibos enable row level security;
revoke all on public.inscricao_recibos from public,anon,authenticated;
grant select on public.inscricao_recibos to service_role;
-- No client policies. Writes are exclusive to the SECURITY DEFINER function.

create function public.dz_inscricao_link_meta(p_metadata jsonb,p_descricao text)
returns jsonb language plpgsql immutable
set search_path=pg_catalog,public
as $fn$
declare v_raw jsonb; v_marker integer;
begin
  if jsonb_typeof(p_metadata)='object' then return p_metadata; end if;
  v_marker:=strpos(coalesce(p_descricao,''),'__dz_meta__:');
  begin
    v_raw:=case when v_marker>0 then substring(p_descricao from v_marker+length('__dz_meta__:'))::jsonb
      else p_descricao::jsonb end;
  exception when invalid_text_representation then v_raw:='{}'::jsonb;
  end;
  return case when jsonb_typeof(v_raw)='object' then v_raw else '{}'::jsonb end;
end;
$fn$;

create function public.dz_inscricao_nome_key(p_nome text)
returns text language sql immutable
set search_path=pg_catalog,public
as $fn$
 select trim(regexp_replace(lower(translate(coalesce(p_nome,''),
   'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇáàâãäåéèêëíìîïóòôõöúùûüç',
   'AAAAAAEEEEIIIIOOOOOUUUUCaaaaaaeeeeiiiiooooouuuuc')), '[^a-z0-9]+',' ','g'))
$fn$;

create function public.fn_inscrever_por_convite_atomico(
  p_actor_id uuid, p_request_id uuid, p_kind text, p_token text,
  p_equipe_id uuid, p_line_id uuid, p_nome_line text, p_slot_id uuid,
  p_vaga_index integer, p_referencia text
)
returns jsonb language plpgsql security definer
set search_path=pg_catalog,public
as $fn$
declare
  v_team public.equipes%rowtype; v_staff record; v_claim record; v_member record;
  v_can_edit boolean:=false; v_can_enroll boolean:=false;
  v_token public.tokens%rowtype; v_link public.campeonato_links%rowtype;
  v_camp public.campeonatos%rowtype; v_group public.campeonato_grupos%rowtype;
  v_config public.campeonato_configuracoes%rowtype;
  v_slot public.campeonato_slots%rowtype; v_line public.equipe_lines%rowtype;
  v_part public.campeonato_equipes%rowtype;
  v_camp_id uuid; v_group_id uuid; v_source_id uuid; v_fixed_slot uuid;
  v_requested_slot uuid:=p_slot_id; v_fingerprint text; v_receipt record;
  v_created boolean:=false; v_name text:=nullif(trim(p_nome_line),'');
  v_meta jsonb; v_entries jsonb; v_expected jsonb; v_entry jsonb;
  v_limit integer; v_uses numeric; v_amount numeric; v_result jsonb;
  v_ref text:=nullif(trim(p_referencia),''); v_candidate text; v_hits text[];
  v_closed boolean; v_letter text; v_human text; v_marker integer;
begin
  if not coalesce(public.fn_is_service_role(),false) then
    raise exception using errcode='42501',message='Operação exclusiva do backend.';
  end if;
  if p_actor_id is null or p_request_id is null or p_equipe_id is null
    or p_kind not in ('team','group') or p_kind is null
    or nullif(trim(p_token),'') is null then
    raise exception using errcode='22023',message='Dados de inscrição inválidos.';
  end if;
  perform 1 from auth.users where id=p_actor_id for share;
  if not found then raise exception using errcode='42501',message='Sessão inválida.'; end if;
  if exists(select 1 from public.sistema_restricoes_conta where auth_user_id=p_actor_id
    and ativo and (expira_em is null or expira_em>clock_timestamp())) then
    raise exception using errcode='42501',message='Conta impedida de realizar inscrições.';
  end if;

  -- The team lock serializes name creation by cooperating callers.
  select * into v_team from public.equipes where id=p_equipe_id for update;
  if not found or v_team.status is distinct from 'ativo' then
    raise exception using errcode='42501',message='Equipe indisponível.';
  end if;
  if v_team.auth_user_id=p_actor_id then
    v_can_edit:=true; v_can_enroll:=true;
  else
    select me.* into v_staff from public.manager_equipe me
      join public.managers m on m.id=me.manager_id
      where m.auth_user_id=p_actor_id and me.equipe_id=p_equipe_id
        and me.status='ativo' and me.pode_ver is distinct from false
      order by me.id limit 1 for share of me,m;
    if found then
      v_can_edit:=coalesce(v_staff.pode_editar,false);
      v_can_enroll:=v_can_edit or coalesce(v_staff.pode_escalar,false);
    elsif v_team.auth_user_id is null and v_team.dono_auth_user_id is null then
      select t.id into v_claim from public.tokens t
        join public.produtoras pr on pr.id=t.produtora_id
        left join public.produtora_membros pm on pm.produtora_id=pr.id
          and pm.auth_user_id=p_actor_id and pm.status='ativo'
        where t.equipe_id=p_equipe_id and t.tipo='reivindicacao_equipe_historica'
          and t.status='ativo' and t.usado=false
          and (pr.auth_user_id=p_actor_id or pm.cargo='proprietario'
            or coalesce(pm.pode_administrar,false) or coalesce(pm.pode_operar,false))
        order by t.id limit 1 for share of t,pr;
      if found then
        -- Freeze the membership used for provisional authorization as well.
        select pm.* into v_member from public.produtora_membros pm
          join public.tokens t on t.produtora_id=pm.produtora_id
          where t.id=v_claim.id and pm.auth_user_id=p_actor_id for share of pm;
        if exists(select 1 from public.produtoras pr join public.tokens t on t.produtora_id=pr.id
          where t.id=v_claim.id and pr.auth_user_id=p_actor_id)
          or (found and v_member.status='ativo' and (v_member.cargo='proprietario'
            or coalesce(v_member.pode_administrar,false) or coalesce(v_member.pode_operar,false))) then
          v_can_edit:=true; v_can_enroll:=true;
        end if;
      end if;
    end if;
  end if;
  if not v_can_enroll or (p_line_id is null and not v_can_edit) then
    raise exception using errcode='42501',message='Sem permissão para inscrever ou criar a line.';
  end if;

  v_fingerprint:=encode(extensions.digest(jsonb_build_object(
    'kind',p_kind,'token',trim(p_token),'equipe',p_equipe_id,'line',p_line_id,
    'nome',v_name,'slot',p_slot_id,'index',p_vaga_index,'ref',v_ref)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended(p_actor_id::text||':'||p_request_id::text,0));
  select * into v_receipt from public.inscricao_recibos
    where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if v_receipt.fingerprint<>v_fingerprint then
      raise exception using errcode='22023',message='Chave de repetição vinculada a outros dados.';
    end if;
    return v_receipt.resultado||jsonb_build_object('repetida',true);
  end if;

  -- Locate parents without locking the source before the group (closure triggers
  -- can update ALL links in the group). Re-read the source after these locks.
  if p_kind='team' then
    select * into v_token from public.tokens where token=trim(p_token)
      and tipo in ('team_invite','convite_equipe_campeonato');
    if not found then raise exception using errcode='22023',message='Convite inválido.'; end if;
    v_source_id:=v_token.id; v_camp_id:=v_token.campeonato_id; v_fixed_slot:=v_token.slot_id;
    v_group_id:=v_token.grupo_id;
    if v_fixed_slot is not null then
      select grupo_id into v_group_id from public.campeonato_slots
        where id=v_fixed_slot and campeonato_id=v_camp_id;
      if not found then raise exception using errcode='22023',message='Slot fora do campeonato.'; end if;
    end if;
  else
    select * into v_link from public.campeonato_links
      where token=trim(p_token) and tipo='inscricao_equipes_grupo';
    if not found then
      -- Equality, no LIKE wildcard interpretation; ambiguous case collisions fail closed.
      if (select count(*) from public.campeonato_links where lower(token)=lower(trim(p_token))
        and tipo='inscricao_equipes_grupo')<>1 then
        raise exception using errcode='22023',message='Link inválido ou ambíguo.';
      end if;
      select * into v_link from public.campeonato_links where lower(token)=lower(trim(p_token))
        and tipo='inscricao_equipes_grupo';
    end if;
    v_source_id:=v_link.id; v_camp_id:=v_link.campeonato_id; v_group_id:=v_link.grupo_id;
  end if;

  select * into v_camp from public.campeonatos where id=v_camp_id for share;
  if not found or v_camp.deleted_at is not null or v_camp.aprovacao_status is distinct from 'aprovado'
    or lower(trim(coalesce(v_camp.status,'ativo'))) in ('suspenso','banido','excluido','excluído') then
    raise exception using errcode='42501',message='Campeonato indisponível para inscrição.';
  end if;
  select * into v_config from public.campeonato_configuracoes where campeonato_id=v_camp_id for share;
  if v_config.aceita_novas_inscricoes_equipes=false
    or (v_config.data_limite_inscricao is not null and v_config.data_limite_inscricao<=clock_timestamp()) then
    raise exception using errcode='22023',message='Inscrições fechadas ou prazo encerrado neste campeonato.';
  end if;
  select * into v_group from public.campeonato_grupos
    where id=v_group_id and campeonato_id=v_camp_id for update;
  if not found then raise exception using errcode='22023',message='Grupo fora do campeonato.'; end if;

  if p_kind='team' then
    select * into v_token from public.tokens where id=v_source_id for update;
    if v_token.token is distinct from trim(p_token) or v_token.campeonato_id is distinct from v_camp_id
      or v_token.slot_id is distinct from v_fixed_slot or v_token.tipo not in ('team_invite','convite_equipe_campeonato')
      or (v_fixed_slot is null and v_token.grupo_id is distinct from v_group_id)
      or (v_token.grupo_id is not null and v_token.grupo_id is distinct from v_group_id)
      or v_token.status is distinct from 'ativo' or v_token.usado is distinct from false
      or (v_token.expira_em is not null and v_token.expira_em<=clock_timestamp()) then
      raise exception using errcode='22023',message='Convite expirado, utilizado ou alterado.';
    end if;
    if v_fixed_slot is not null then
      if p_slot_id is not null and p_slot_id<>v_fixed_slot then
        raise exception using errcode='22023',message='Slot diferente do convite.';
      end if;
      v_requested_slot:=v_fixed_slot;
    end if;
  else
    select * into v_link from public.campeonato_links where id=v_source_id for update;
    if lower(v_link.token) is distinct from lower(trim(p_token))
      or v_link.tipo is distinct from 'inscricao_equipes_grupo'
      or v_link.campeonato_id is distinct from v_camp_id or v_link.grupo_id is distinct from v_group_id
      or v_link.ativo is distinct from true or v_link.deleted_at is not null
      or (v_link.expira_em is not null and v_link.expira_em<=clock_timestamp()) then
      raise exception using errcode='22023',message='Link expirado, pausado ou alterado.';
    end if;
    v_meta:=public.dz_inscricao_link_meta(v_link.metadata,v_link.descricao);
    v_entries:=case when jsonb_typeof(v_meta->'entradas')='array' then v_meta->'entradas' else '[]'::jsonb end;
    v_expected:=case when jsonb_typeof(v_meta->'expected_teams')='array' then v_meta->'expected_teams' else '[]'::jsonb end;
    v_expected:=coalesce((select jsonb_agg(trim(value)) from jsonb_array_elements_text(v_expected) where nullif(trim(value),'') is not null),'[]'::jsonb);
    begin
      v_uses:=greatest(coalesce(nullif(v_meta->>'usos','')::numeric,jsonb_array_length(v_entries)),jsonb_array_length(v_entries),0);
      v_limit:=least(coalesce(nullif(greatest(floor(nullif(v_meta->>'limite_vagas','')::numeric),0),0),
        nullif(jsonb_array_length(v_expected),0),v_group.slots),v_group.slots)::integer;
      if v_uses='NaN'::numeric or v_uses in ('Infinity'::numeric,'-Infinity'::numeric) or v_limit<1 then
        raise invalid_text_representation;
      end if;
    exception when invalid_text_representation or numeric_value_out_of_range then
      raise exception using errcode='22023',message='Metadados de vagas inválidos.';
    end;
    if v_uses>=v_limit or v_meta->>'closed_reason' in ('limite_atingido','excluido','grupo_cheio') then
      raise exception using errcode='22023',message='Link sem vagas disponíveis.';
    end if;
    if v_requested_slot is null and p_vaga_index is not null and p_vaga_index>=0 then
      select id into v_requested_slot from public.campeonato_slots
        where campeonato_id=v_camp_id and grupo_id=v_group_id order by slot_numero,id
        offset p_vaga_index limit 1;
      if not found then raise exception using errcode='22023',message='Vaga selecionada inválida.'; end if;
    end if;
  end if;

  select s.* into v_slot from public.campeonato_slots s
    where s.campeonato_id=v_camp_id and s.grupo_id=v_group_id
      and (v_requested_slot is null or s.id=v_requested_slot)
      and s.equipe_id is null and s.line_id is null
      and not exists(select 1 from public.campeonato_equipes ce where ce.campeonato_id=v_camp_id
        and ce.status='ativo' and (ce.slot_id=s.id or (ce.grupo_id=v_group_id and ce.slot_numero=s.slot_numero)))
    order by s.slot_numero,s.id limit 1 for update of s;
  if not found then raise exception using errcode='23505',message='Slot ocupado ou fora do grupo.'; end if;

  if p_line_id is not null then
    select * into v_line from public.equipe_lines where id=p_line_id and equipe_id=p_equipe_id for update;
    if not found or v_line.status='inativo' then
      raise exception using errcode='22023',message='Line inválida ou inativa.';
    end if;
  else
    if v_name is null or lower(v_name) in ('nova line','nova_line','newline','new line','+ criar nova line','criar nova line') then
      raise exception using errcode='22023',message='Informe um nome real para a line.';
    end if;
    select * into v_line from public.equipe_lines where equipe_id=p_equipe_id
      and lower(trim(nome))=lower(v_name) order by id limit 1 for update;
    if not found then
      insert into public.equipe_lines(equipe_id,nome,tag,logo_url,status)
        values(p_equipe_id,v_name,v_team.tag,v_team.logo_url,'ativo') returning * into v_line;
      v_created:=true;
    elsif v_line.status='inativo' then
      update public.equipe_lines set status='ativo' where id=v_line.id returning * into v_line;
    end if;
  end if;
  if exists(select 1 from public.campeonato_equipes where campeonato_id=v_camp_id
    and status in ('ativo','pendente') and (line_id=v_line.id or (equipe_id=p_equipe_id and lower(trim(nome_exibicao))=lower(trim(v_line.nome))))) then
    raise exception using errcode='23505',message='Esta line já está inscrita ou pendente neste campeonato.';
  end if;

  insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,slot_id,status,origem_entrada,criado_por,nome_exibicao)
    values(v_camp_id,p_equipe_id,v_line.id,v_slot.id,'ativo',case when p_kind='team' then 'convite' else 'link' end,p_actor_id,v_line.nome)
    returning * into v_part;
  v_letter:=coalesce(nullif(upper(trim(v_slot.slot_letra)),''),v_slot.slot_numero::text);
  if v_config.data_limite_inscricao is not null and v_config.data_limite_inscricao<=clock_timestamp() then
    raise exception using errcode='22023',message='Prazo de inscrição encerrou durante a operação.';
  end if;

  if p_kind='team' then
    -- clock_timestamp is checked again after potentially waiting on slot/line locks.
    update public.tokens set usado=true,usado_em=clock_timestamp(),status='usado',
      equipe_id=p_equipe_id,line_destino_id=v_line.id,slot_id=v_slot.id
      where id=v_token.id and status='ativo' and usado=false
        and (expira_em is null or expira_em>clock_timestamp());
    if not found then raise exception using errcode='22023',message='Convite expirou durante a inscrição.'; end if;
    v_result:=jsonb_build_object('ok',true,'participacao',to_jsonb(v_part),
      'equipe',jsonb_build_object('id',v_team.id,'nome',v_team.nome),
      'line',jsonb_build_object('id',v_line.id,'nome',v_line.nome,'criada_agora',v_created),
      'grupo',jsonb_build_object('id',v_group.id,'nome',v_group.nome),
      'slot',jsonb_build_object('id',v_slot.id,'letra',v_slot.slot_letra,'numero',v_slot.slot_numero),
      'slot_letra',v_slot.slot_letra,'mensagem',case when v_created then format('Line "%s" criada e inscrita.',v_line.nome) else format('Line "%s" inscrita.',v_line.nome) end);
  else
    -- INSERT triggers may already have closed this link. Re-read to preserve their
    -- metadata, closures and any fields outside this operation's ownership.
    select * into v_link from public.campeonato_links where id=v_source_id;
    if v_link.deleted_at is not null or (v_link.expira_em is not null and v_link.expira_em<=clock_timestamp()) then
      raise exception using errcode='22023',message='Link expirou durante a inscrição.';
    end if;
    v_meta:=public.dz_inscricao_link_meta(v_link.metadata,v_link.descricao);
    if jsonb_array_length(v_expected)>0 then
      select trim(expected.value) into v_ref from jsonb_array_elements_text(v_expected)expected(value)
        where lower(trim(expected.value))=lower(v_ref) and not exists(select 1 from jsonb_array_elements(v_entries)history(entry)
          where lower(trim(history.entry->>'referencia_lista'))=lower(trim(expected.value))) limit 1;
      if v_ref is null then
        foreach v_candidate in array array[v_team.nome,v_line.nome] loop
          select trim(expected.value) into v_ref from jsonb_array_elements_text(v_expected)expected(value)
            where lower(trim(expected.value))=lower(trim(v_candidate))
              and not exists(select 1 from jsonb_array_elements(v_entries)history(entry)
                where lower(trim(history.entry->>'referencia_lista'))=lower(trim(expected.value))) limit 1;
          exit when v_ref is not null;
        end loop;
      end if;
      if v_ref is null then
        foreach v_candidate in array array[v_team.nome,v_line.nome] loop
          select trim(expected.value) into v_ref from jsonb_array_elements_text(v_expected)expected(value)
            where public.dz_inscricao_nome_key(expected.value)=public.dz_inscricao_nome_key(v_candidate)
              and public.dz_inscricao_nome_key(v_candidate)<>''
              and not exists(select 1 from jsonb_array_elements(v_entries)history(entry)
                where lower(trim(history.entry->>'referencia_lista'))=lower(trim(expected.value))) limit 1;
          exit when v_ref is not null;
        end loop;
      end if;
      if v_ref is null then
        select array_agg(distinct trim(expected.value)) into v_hits from jsonb_array_elements_text(v_expected)expected(value)
          where not exists(select 1 from jsonb_array_elements(v_entries)history(entry)
            where lower(trim(history.entry->>'referencia_lista'))=lower(trim(expected.value)))
            and exists(select 1 from unnest(array[v_team.nome,v_line.nome])candidate(name)
              where length(public.dz_inscricao_nome_key(candidate.name))>=3 and public.dz_inscricao_nome_key(expected.value)<>''
                and (strpos(public.dz_inscricao_nome_key(candidate.name),public.dz_inscricao_nome_key(expected.value))>0
                  or strpos(public.dz_inscricao_nome_key(expected.value),public.dz_inscricao_nome_key(candidate.name))>0));
        if cardinality(v_hits)=1 then v_ref:=v_hits[1]; end if;
      end if;
    end if;
    v_entry:=jsonb_build_object('participacao_id',v_part.id,'equipe_id',v_team.id,'equipe_nome',v_team.nome,
      'line_id',v_line.id,'line_nome',v_line.nome,'slot_id',v_slot.id,'slot_letra',v_letter,
      'slot_numero',v_slot.slot_numero,'referencia_lista',v_ref,'entrou_em',clock_timestamp());
    v_uses:=v_uses+1;
    v_meta:=v_meta||jsonb_build_object('usos',v_uses,'limite_vagas',v_limit,'entradas',v_entries||jsonb_build_array(v_entry),
      'expected_teams',v_expected,'_group_revision',gen_random_uuid());
    v_closed:=v_link.ativo is distinct from true or v_uses>=v_limit;
    if v_uses>=v_limit then v_meta:=v_meta||jsonb_build_object('closed_reason','limite_atingido','closed_at',clock_timestamp()); end if;
    v_marker:=strpos(coalesce(v_link.descricao,''),'__dz_meta__:');
    v_human:=trim(case when v_marker>0 then substring(v_link.descricao from 1 for v_marker-1)
      when coalesce(v_link.descricao,'') ~ '^\s*\{' then '' else coalesce(v_link.descricao,'') end);
    update public.campeonato_links set metadata=v_meta,
      descricao=case when v_human='' then '' else v_human||E'\n' end||'__dz_meta__:'||v_meta::text,
      ativo=not v_closed where id=v_link.id;
    select valor_inscricao into v_amount from public.campeonato_configuracoes where campeonato_id=v_camp_id;
    if v_amount is null or v_amount<=0 then v_amount:=null; end if;
    v_result:=jsonb_build_object('ok',true,'participacao',to_jsonb(v_part),'campeonato_equipe_id',v_part.id,
      'equipe',jsonb_build_object('id',v_team.id,'nome',v_team.nome),
      'line',jsonb_build_object('id',v_line.id,'nome',v_line.nome,'criada_agora',v_created),
      'grupo_id',v_group.id,'slot_id',v_slot.id,'slot_letra',v_letter,
      'referencia',coalesce(v_ref,v_line.nome,'Slot '||v_letter),'valor_inscricao',v_amount,
      'precisa_pagamento',coalesce(v_amount>=1,false),
      'link',jsonb_build_object('limite_vagas',v_limit,'usos',v_uses,'restantes',greatest(0,v_limit-v_uses),'encerrado',v_closed),
      'mensagem',case when v_created then format('Line "%s" criada e inscrita no slot %s.',v_line.nome,v_letter) else format('Line "%s" inscrita no slot %s.',v_line.nome,v_letter) end);
  end if;
  insert into public.inscricao_recibos(actor_id,request_id,fingerprint,resultado)
    values(p_actor_id,p_request_id,v_fingerprint,v_result);
  return v_result;
end;
$fn$;

revoke all on function public.dz_inscricao_link_meta(jsonb,text) from public,anon,authenticated;
revoke all on function public.dz_inscricao_nome_key(text) from public,anon,authenticated;
revoke all on function public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text) to service_role;
commit;
