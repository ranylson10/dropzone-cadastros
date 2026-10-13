-- CANDIDATE ONLY, NOT APPLIED. Requires permission, mirror and guarded rejoin candidates.
-- One transaction for direct add, team request, approve, reject and soft removal.
-- Existing membership rows are locked; new restrictions/membership phantoms and other writers remain pending.
begin;
create table public.participacao_recibos(
  actor_id uuid not null references auth.users(id),request_id uuid not null,
  fingerprint text not null,resultado jsonb not null,created_at timestamptz not null default now(),
  primary key(actor_id,request_id)
);
create table public.participacao_operacoes(
  actor_id uuid not null references auth.users(id),request_id uuid not null,
  campeonato_id uuid not null references public.campeonatos(id),participacao_id uuid not null references public.campeonato_equipes(id),
  action text not null check(action in('request','add','approve','reject','remove')),
  anterior jsonb,posterior jsonb not null,created_at timestamptz not null default now(),primary key(actor_id,request_id)
);
alter table public.participacao_recibos enable row level security;
alter table public.participacao_operacoes enable row level security;
revoke all on public.participacao_recibos,public.participacao_operacoes from public,anon,authenticated,service_role;
grant select on public.participacao_recibos,public.participacao_operacoes to service_role;

create function public.dz_participation_access(p_actor uuid,p_camp uuid,p_action text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public
as $fn$
declare
  c public.campeonatos%rowtype;pr public.produtoras%rowtype;w public.produtora_membros%rowtype;
  m public.manager_produtora%rowtype;s public.campeonato_vendedores%rowtype;t public.tokens%rowtype;
  ids uuid[];perms jsonb;is_seller boolean:=false;full_remove boolean:=false;own_remove boolean:=false;
begin
  perform public.dz_assert_slot_permission(p_actor,p_camp,'team'); -- service/Auth/restriction/championship check
  if p_action='request' then return jsonb_build_object('role','team');end if;
  select * into c from public.campeonatos where id=p_camp for share;
  select * into pr from public.produtoras where id=c.produtora_id for share;
  if c.criado_por=p_actor or pr.auth_user_id=p_actor then return jsonb_build_object('role','owner');end if;
  if pr.status is distinct from 'deletado' then
    select * into w from public.produtora_membros where produtora_id=c.produtora_id and auth_user_id=p_actor
      and status='ativo' order by id limit 1 for share;
    if found and w.pode_ver then
      if w.pode_administrar or w.pode_operar then return jsonb_build_object('role','workspace');end if;
      raise exception using errcode='42501',message='Sem permissão para alterar inscrições.';
    end if;
  end if;
  perform 1 from public.managers where auth_user_id=p_actor and status='ativo' order by id for share;
  select array_agg(id order by id) into ids from public.managers where auth_user_id=p_actor and status='ativo';
  select * into m from public.manager_produtora where manager_id=any(ids) and produtora_id=c.produtora_id
    and status='ativo' and (pode_ver or pode_gerenciar_campeonato) order by id limit 1 for share;
  if found then
    if m.pode_gerenciar_campeonato then return jsonb_build_object('role','manager');end if;
    raise exception using errcode='42501',message='Sem permissão para alterar inscrições.';
  end if;
  select * into s from public.campeonato_vendedores where manager_id=any(ids) and campeonato_id=p_camp
    and status='ativo' order by id limit 1 for share;
  if found then is_seller:=true;perms:=s.permissoes;
  else
    select * into t from public.tokens where manager_id=any(ids) and campeonato_id=p_camp
      and tipo='manager_invite' and status='ativo' order by id limit 1 for share;
    if found then perms:=t.manager_permissoes;end if;
  end if;
  if p_action in('add','remove') and (not is_seller or (s.manager_auth_user_id is not null and s.manager_auth_user_id is distinct from p_actor)) then
    raise exception using errcode='42501',message='Permissão de vendedor direto indisponível.';
  end if;
  if p_action='remove' then
    full_remove:=coalesce(perms->'remover_equipes'='true'::jsonb,false);
    own_remove:=not full_remove and coalesce(perms->'remover_proprias_equipes'='true'::jsonb,false);
    if not full_remove and not own_remove then raise exception using errcode='42501',message='Sem permissão para alterar inscrições.';end if;
  elsif not coalesce(perms->'adicionar_equipes'='true'::jsonb,false) then
    raise exception using errcode='42501',message='Sem permissão para alterar inscrições.';
  end if;
  return jsonb_build_object('role','seller','seller_id',s.id,'limit',s.limite_vagas,'own_only',own_remove);
end;
$fn$;

create function public.fn_gravar_participacao_atomica(p_actor_id uuid,p_request_id uuid,p_campeonato_id uuid,p_action text,p_args jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,extensions
as $fn$
declare
  access jsonb;fingerprint text;receipt record;result jsonb;
  team_id uuid;v_line_id uuid;part_id uuid;target uuid;source uuid;groups uuid[];
  team public.equipes%rowtype;line public.equipe_lines%rowtype;part public.campeonato_equipes%rowtype;
  slot public.campeonato_slots%rowtype;grp public.campeonato_grupos%rowtype;
  camp public.campeonatos%rowtype;config public.campeonato_configuracoes%rowtype;
  previous jsonb;expected jsonb;name text;reason text;origin text;created boolean:=false;used bigint;quota numeric;division jsonb;
  liga_matches bigint;liga_entry jsonb;liga_type text;liga_raw text;liga_digits text;liga_amount numeric;liga_totals jsonb;
begin
  if not coalesce(public.fn_is_service_role(),false) then raise exception using errcode='42501',message='Operação exclusiva do backend.';end if;
  if p_actor_id is null or p_request_id is null or p_campeonato_id is null or p_action is null
    or p_action not in('request','add','approve','reject','remove') or p_args is null or jsonb_typeof(p_args)<>'object' then
    raise exception using errcode='22023',message='Dados de participação inválidos.';
  end if;
  access:=public.dz_participation_access(p_actor_id,p_campeonato_id,p_action);
  perform pg_advisory_xact_lock(hashtextextended('participation:'||p_actor_id::text||':'||p_request_id::text,0));
  fingerprint:=encode(extensions.digest(jsonb_build_object('champ',p_campeonato_id,'action',p_action,'args',p_args)::text,'sha256'),'hex');
  if p_action in('add','request') then
    team_id:=(p_args->>'equipe_id')::uuid;v_line_id:=(p_args->>'line_id')::uuid;
    if team_id is null or (p_action='request' and v_line_id is null) then raise exception using errcode='22023',message='Dados de participação inválidos.';end if;
  else
    expected:=p_args->'expected';part_id:=(p_args->>'participacao_id')::uuid;
    if part_id is null or jsonb_typeof(expected) is distinct from 'object'
      or not(expected ?& array['equipe_id','line_id','slot_id','status','updated_at'])
      or expected->>'equipe_id' is null or expected->>'line_id' is null or expected->>'updated_at' is null
      or expected->>'status' is null then raise exception using errcode='22023',message='Acompanhamento de participação inválido.';end if;
    team_id:=(expected->>'equipe_id')::uuid;v_line_id:=(expected->>'line_id')::uuid;source:=(expected->>'slot_id')::uuid;
  end if;
  -- Team requests must still be owned on replay. Management receipts require current access above.
  if p_action='request' then
    select * into team from public.equipes where id=team_id for update;
    if not found or team.status is distinct from 'ativo' or not coalesce(team.auth_user_id=p_actor_id or team.dono_auth_user_id=p_actor_id,false) then
      raise exception using errcode='42501',message='A equipe informada não pertence ao seu perfil.';
    end if;
  end if;
  select * into receipt from public.participacao_recibos where actor_id=p_actor_id and request_id=p_request_id;
  if found then
    if receipt.fingerprint<>fingerprint then raise exception using errcode='23505',message='Chave de repetição vinculada a outra participação.';end if;
    if p_action='remove' and coalesce((access->>'own_only')::boolean,false)
      and (receipt.resultado->'participacao'->>'criado_por' is distinct from p_actor_id::text
        or not coalesce(receipt.resultado->'participacao'->>'origem_entrada'=any(array['vendedor','convite','inscricao','link']),false)) then
      raise exception using errcode='42501',message='O vendedor só pode remover equipes que ele adicionou.';
    end if;
    return receipt.resultado||jsonb_build_object('repetida',true);
  end if;
  -- Serialize direct quota usage across different teams without upgrading the shared permission row.
  if p_action='add' and access->>'role'='seller' then
    perform pg_advisory_xact_lock(hashtextextended('directquota:'||p_campeonato_id::text||':'||p_actor_id::text,0));
  end if;
  select * into team from public.equipes where id=team_id for update;
  if not found or (p_action in('request','add','approve') and team.status is distinct from 'ativo') then raise exception using errcode='22023',message='Equipe indisponível para inscrição.';end if;
  select * into camp from public.campeonatos where id=p_campeonato_id for share;
  select * into config from public.campeonato_configuracoes where campeonato_id=p_campeonato_id for share;
  if p_action='request' and (camp.aprovacao_status is distinct from 'aprovado'
    or lower(trim(coalesce(camp.status,'ativo'))) in('suspenso','banido','excluido','excluído')
    or config.aceita_novas_inscricoes_equipes=false or config.data_limite_inscricao<=clock_timestamp()) then
    raise exception using errcode='42501',message='Campeonato fechado ou indisponível para inscrição.';
  end if;
  target:=case when p_action in('add','approve') then (p_args->>'slot_id')::uuid else null end;
  if p_action in('add','approve') and target is null then raise exception using errcode='22023',message='Escolha o slot antes de confirmar a inscrição.';end if;
  select array_agg(distinct grupo_id) into groups from public.campeonato_slots where id in(source,target);
  perform 1 from public.campeonato_grupos where id=any(groups) order by id for update;
  perform 1 from public.campeonato_slots where id in(source,target) order by id for update;
  if p_action in('approve','reject','remove') then
    perform 1 from public.equipe_lines where id=v_line_id for update;
    select * into part from public.campeonato_equipes where id=part_id for update;
    if not found or part.campeonato_id is distinct from p_campeonato_id or part.equipe_id is distinct from team_id
      or part.line_id is distinct from v_line_id or part.slot_id is distinct from source
      or part.status is distinct from expected->>'status' or part.updated_at is distinct from (expected->>'updated_at')::timestamptz
      or (p_action='remove' and part.status is distinct from 'ativo')
      or (p_action in('approve','reject') and part.status not in('pendente','rejeitado')) then
      raise exception using errcode='40001',message='A participação mudou. Atualize o acompanhamento.';
    end if;
    previous:=to_jsonb(part);
    if source is null then
      if part.grupo_id is not null or part.slot_numero is not null then raise exception using errcode='23514',message='Localização da participação exige reconciliação.';end if;
    else
      select * into slot from public.campeonato_slots where id=source;
      if part.status is distinct from 'ativo' or slot.campeonato_id is distinct from p_campeonato_id
        or slot.grupo_id is distinct from part.grupo_id or slot.slot_numero is distinct from part.slot_numero
        or slot.line_id is distinct from v_line_id or slot.equipe_id is distinct from team_id or slot.status is distinct from 'ocupado' then
        raise exception using errcode='23514',message='Espelho da participação exige reconciliação.';
      end if;
    end if;
    if p_action='remove' and coalesce((access->>'own_only')::boolean,false)
      and (part.criado_por is distinct from p_actor_id or not coalesce(part.origem_entrada=any(array['vendedor','convite','inscricao','link']),false)) then
      raise exception using errcode='42501',message='O vendedor só pode remover equipes que ele adicionou.';
    end if;
  end if;
  if target is not null then
    select * into slot from public.campeonato_slots where id=target;
    select * into grp from public.campeonato_grupos where id=slot.grupo_id;
    if slot.id is null or slot.campeonato_id is distinct from p_campeonato_id or grp.campeonato_id is distinct from p_campeonato_id
      or slot.fase_id is distinct from grp.fase_id or not coalesce(slot.grupo_id=any(groups),false) then
      raise exception using errcode='22023',message='Slot fora da estrutura do campeonato.';
    end if;
    if grp.fase_id is not null then
      perform 1 from public.campeonato_fases where id=grp.fase_id and campeonato_id=p_campeonato_id for share;
      if not found then raise exception using errcode='22023',message='Slot fora da estrutura do campeonato.';end if;
    end if;
    if slot.status is distinct from 'livre' or slot.equipe_id is not null or slot.line_id is not null
      or exists(select 1 from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.status='ativo'
        and (ce.slot_id=slot.id or (ce.grupo_id=slot.grupo_id and ce.slot_numero=slot.slot_numero))) then
      raise exception using errcode='23505',message='Slot ocupado ou reservado.';
    end if;
  end if;
  if p_action in('request','add','approve') then
    name:=nullif(btrim(p_args->>'nome_line'),'');
    if v_line_id is not null then select * into line from public.equipe_lines where id=v_line_id and equipe_id=team_id for update;
      if not found or line.status is distinct from 'ativo' then raise exception using errcode='22023',message='Line inválida ou inativa.';end if;
    else
      if name is null or length(name)>120 or lower(name)=any(array['nova line','nova_line','newline','new line','+ criar nova line','criar nova line']) then
        raise exception using errcode='22023',message='Informe um nome real para a line.';
      end if;
      select * into line from public.equipe_lines where equipe_id=team_id and lower(btrim(nome))=lower(name) order by id limit 1 for update;
      if not found then insert into public.equipe_lines(equipe_id,nome,tag,logo_url,status) values(team_id,name,team.tag,team.logo_url,'ativo') returning * into line;created:=true;
      elsif line.status='inativo' then update public.equipe_lines set status='ativo' where id=line.id returning * into line;end if;
      v_line_id:=line.id;
    end if;
    if p_action='request' and exists(select 1 from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.status='ativo' and ce.line_id=v_line_id) then
      raise exception using errcode='23505',message='Esta line já está inscrita ou pendente.';
    end if;
    if exists(select 1 from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.status in('ativo','pendente')
      and ce.id is distinct from part_id and (ce.line_id=v_line_id or (ce.equipe_id=team_id and lower(btrim(ce.nome_exibicao))=lower(btrim(line.nome))))) then
      if p_action='request' then
        select * into part from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.line_id=v_line_id and ce.status='pendente' for update;
        if not found then raise exception using errcode='23505',message='Esta line já está inscrita ou pendente.';end if;
        previous:=to_jsonb(part);
      else raise exception using errcode='23505',message='Esta line já está inscrita ou pendente.';end if;
    end if;
  end if;
  if p_action='add' and access->>'role'='seller' and coalesce((access->>'limit')::numeric,0)>0 then
    select count(*) into used from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.status='ativo'
      and ce.criado_por=p_actor_id and (ce.origem_entrada=any(array['vendedor','convite','inscricao','link']) or ce.origem_entrada like 'liga_%');
    if used>=(access->>'limit')::numeric then raise exception using errcode='23505',message='Limite de vagas do vendedor atingido.';end if;
  end if;
  origin:=case when access->>'role'='seller' then 'vendedor' else 'organizador' end;
  if p_action in('add','approve') and camp.tipo='liga' then
    origin:=p_args->>'origem_entrada';
    if not coalesce(origin=any(array['mantida','promovida','rebaixada','classificatoria_aberta','vaga_paga','convite_direto']),false) then
      raise exception using errcode='22023',message='Origem da Liga inválida.';
    end if;
    if jsonb_typeof(to_jsonb(config)->'liga_divisoes') is distinct from 'array' then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
    if nullif(btrim(grp.nome),'') is null then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
    select count(*) into liga_matches from jsonb_array_elements(to_jsonb(config)->'liga_divisoes') d
      where jsonb_typeof(d->'nome')='string' and lower(btrim(d->>'nome'))=lower(btrim(grp.nome));
    if liga_matches<>1 then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
    select d into division from jsonb_array_elements(to_jsonb(config)->'liga_divisoes') d
      where jsonb_typeof(d->'nome')='string' and lower(btrim(d->>'nome'))=lower(btrim(grp.nome));
    if jsonb_typeof(division->'entradas') is distinct from 'array' then
      raise exception using errcode='22023',message='Configuração da Liga indisponível.';
    end if;
    if jsonb_array_length(division->'entradas')=0 then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
    -- Validate the complete selected division, matching the operational client contract.
    -- Do not cast unchecked text: decimal quotas can admit more teams than the plan.
    liga_totals:='{}'::jsonb;
    for liga_entry in select value from jsonb_array_elements(division->'entradas') loop
      liga_type:=liga_entry->>'tipo';
      if jsonb_typeof(liga_entry) is distinct from 'object' or jsonb_typeof(liga_entry->'tipo') is distinct from 'string'
        or not coalesce(liga_type=any(array['mantida','promovida','rebaixada','classificatoria_aberta','vaga_paga','convite_direto']),false) then
        raise exception using errcode='22023',message='Configuração da Liga indisponível.';
      end if;
      if jsonb_typeof(liga_entry->'quantidade')='number' then
        liga_amount:=(liga_entry->>'quantidade')::numeric;
      elsif jsonb_typeof(liga_entry->'quantidade')='string' then
        liga_raw:=btrim(liga_entry->>'quantidade',E' \t\n\r\f\013');
        if not coalesce(liga_raw ~ '^[0-9]+$',false) then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
        liga_digits:=coalesce(nullif(ltrim(liga_raw,'0'),''),'0');
        if length(liga_digits)>16 then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
        liga_amount:=liga_digits::numeric;
      else raise exception using errcode='22023',message='Configuração da Liga indisponível.';
      end if;
      if liga_amount<0 or liga_amount<>trunc(liga_amount) or liga_amount>9007199254740991 then
        raise exception using errcode='22023',message='Configuração da Liga indisponível.';
      end if;
      liga_amount:=liga_amount+coalesce((liga_totals->>liga_type)::numeric,0);
      if liga_amount>9007199254740991 then raise exception using errcode='22023',message='Configuração da Liga indisponível.';end if;
      liga_totals:=jsonb_set(liga_totals,array[liga_type],to_jsonb(liga_amount),true);
    end loop;
    quota:=(liga_totals->>origin)::numeric;
    select count(*) into used from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.grupo_id=grp.id and ce.status='ativo' and ce.origem_entrada='liga_'||origin;
    if quota is null or quota<1 or used>=quota then raise exception using errcode='23505',message='Cota da origem na Liga preenchida ou indisponível.';end if;
    if exists(select 1 from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.status='ativo' and ce.equipe_id=team_id and ce.id is distinct from part_id) then
      raise exception using errcode='23505',message='A equipe já ocupa uma vaga nesta Liga.';
    end if;
    origin:='liga_'||origin;
  end if;
  if p_action='request' then
    if part.id is null then
      select * into part from public.campeonato_equipes ce where ce.campeonato_id=p_campeonato_id and ce.line_id=v_line_id and ce.status='rejeitado' order by ce.updated_at desc,ce.id desc limit 1 for update;
      if found then previous:=to_jsonb(part);
        update public.campeonato_equipes set status='pendente',criado_por=p_actor_id,origem_entrada='inscricao',solicitado_em=clock_timestamp(),revisado_em=null,revisado_por=null,motivo_rejeicao=null,slot_id=null,grupo_id=null,slot_numero=null,nome_exibicao=line.nome where id=part.id returning * into part;
      else insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,status,criado_por,origem_entrada,nome_exibicao,solicitado_em)
        values(p_campeonato_id,team_id,v_line_id,'pendente',p_actor_id,'inscricao',line.nome,clock_timestamp()) returning * into part;end if;
    end if;
    if config.data_limite_inscricao<=clock_timestamp() then raise exception using errcode='42501',message='Prazo de inscrição encerrou durante a operação.';end if;
  elsif p_action='add' then
    insert into public.campeonato_equipes(campeonato_id,equipe_id,line_id,slot_id,status,criado_por,origem_entrada,nome_exibicao)
      values(p_campeonato_id,team_id,v_line_id,target,'ativo',p_actor_id,origin,line.nome) returning * into part;
  elsif p_action='approve' then
    update public.campeonato_equipes set status='ativo',slot_id=target,grupo_id=slot.grupo_id,slot_numero=slot.slot_numero,
      revisado_em=clock_timestamp(),revisado_por=p_actor_id,motivo_rejeicao=null,
      origem_entrada=case when camp.tipo='liga' then origin else origem_entrada end where id=part_id returning * into part;
  elsif p_action='reject' then
    reason:=nullif(btrim(p_args->>'motivo'),'');
    if length(reason)>500 then raise exception using errcode='22023',message='Motivo de revisão inválido.';end if;
    update public.campeonato_equipes set status='rejeitado',revisado_em=clock_timestamp(),revisado_por=p_actor_id,motivo_rejeicao=reason,
      slot_id=null,grupo_id=null,slot_numero=null where id=part_id returning * into part;
  else
    update public.campeonato_equipes set status='removido',slot_id=null,grupo_id=null,slot_numero=null where id=part_id returning * into part;
  end if;
  if (target is not null and not exists(select 1 from public.campeonato_slots where id=target and campeonato_id=p_campeonato_id
    and line_id=part.line_id and equipe_id=part.equipe_id and status='ocupado'))
    or (p_action='remove' and source is not null and not exists(select 1 from public.campeonato_slots where id=source
      and campeonato_id=p_campeonato_id and line_id is null and equipe_id is null and status='livre')) then
    raise exception using errcode='23514',message='Gatilho de slots incompatível com a inscrição.';
  end if;
  result:=jsonb_build_object('ok',true,'campeonato_id',p_campeonato_id,'action',p_action,'participacao',to_jsonb(part),
    'line',case when p_action in('add','request','approve') then jsonb_build_object('id',line.id,'nome',line.nome,'criada_agora',created) else null end);
  insert into public.participacao_operacoes(actor_id,request_id,campeonato_id,participacao_id,action,anterior,posterior)
    values(p_actor_id,p_request_id,p_campeonato_id,part.id,p_action,previous,to_jsonb(part));
  if p_action='request' and config.data_limite_inscricao<=clock_timestamp() then raise exception using errcode='42501',message='Prazo de inscrição encerrou durante a operação.';end if;
  insert into public.participacao_recibos(actor_id,request_id,fingerprint,resultado) values(p_actor_id,p_request_id,fingerprint,result);
  -- Recheck after audit/receipt triggers as well, including elapsed deadlines.
  access:=public.dz_participation_access(p_actor_id,p_campeonato_id,p_action);
  if not exists(select 1 from public.campeonato_equipes ce where ce.id=part.id and to_jsonb(ce)=to_jsonb(part)) then
    raise exception using errcode='40001',message='A participação mudou durante a confirmação.';
  end if;
  if p_action='request' then
    select * into camp from public.campeonatos where id=p_campeonato_id for share;
    select * into config from public.campeonato_configuracoes where campeonato_id=p_campeonato_id for share;
    if camp.aprovacao_status is distinct from 'aprovado' or lower(trim(coalesce(camp.status,'ativo'))) in('suspenso','banido','excluido','excluído')
      or config.aceita_novas_inscricoes_equipes=false or config.data_limite_inscricao<=clock_timestamp()
      or not exists(select 1 from public.equipes where id=team_id and status='ativo'
        and (auth_user_id=p_actor_id or dono_auth_user_id=p_actor_id)) then
      raise exception using errcode='42501',message='Campeonato fechado ou indisponível para inscrição.';
    end if;
  elsif p_action='remove' and coalesce((access->>'own_only')::boolean,false)
    and (part.criado_por is distinct from p_actor_id or not coalesce(part.origem_entrada=any(array['vendedor','convite','inscricao','link']),false)) then
    raise exception using errcode='42501',message='O vendedor só pode remover equipes que ele adicionou.';
  end if;
  return result;
end;
$fn$;
revoke all on function public.dz_participation_access(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.fn_gravar_participacao_atomica(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.dz_participation_access(uuid,uuid,text),public.fn_gravar_participacao_atomica(uuid,uuid,uuid,text,jsonb) to service_role;
commit;
