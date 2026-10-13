-- READ ONLY. Run on fresh staging and the target before creating a migration.
-- Output has catalog definitions, ACLs and counts; no token values or user rows.
-- Save the output and compare with the reviewed candidates before any DDL.
begin read only;

select jsonb_build_object(
  'generated_at',clock_timestamp(),'postgres',version(),
  'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname))
    from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
  'rls',(select jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity,'forced',c.relforcerowsecurity))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','p')),
  'objects',(select jsonb_agg(jsonb_build_object('table',c.relname,'owner',pg_get_userbyid(c.relowner),'acl',c.relacl))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public'
      and c.relname in ('equipes','equipe_lines','manager_equipe','managers','produtoras','produtora_membros',
        'campeonatos','campeonato_configuracoes','campeonato_grupos','campeonato_slots','campeonato_equipes','campeonato_links','tokens','sistema_restricoes_conta','inscricao_recibos')),
  'columns',(select jsonb_agg(jsonb_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'nullable',not a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid),'acl',a.attacl))
    from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
      left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where n.nspname='public' and a.attnum>0 and not a.attisdropped
      and c.relname in ('equipe_lines','campeonato_equipes','campeonato_slots','campeonato_links','tokens','sistema_auditoria')),
  'functions',(select jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),
      'acl',p.proacl,'security_definer',p.prosecdef,'config',p.proconfig,'definition',pg_get_functiondef(p.oid)))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in (
      'fn_sync_slot_from_participacao','fn_sync_slot_mirror_from_participacao','fn_sync_slot_reserva_from_token',
      'fn_token_convite_unico_imute_usado','fn_transferir_line_equipe','fn_fechar_link_grupo_se_cheio',
      'fn_fechar_link_grupo_apos_participacao','fn_enforce_limite_ao_criar_slot','fn_is_service_role',
      'fn_inscrever_por_convite_atomico','dz_inscricao_link_meta','dz_inscricao_nome_key')),
  'triggers',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)))
    from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and not t.tgisinternal and c.relname in ('equipes','equipe_lines','campeonato_equipes','campeonato_slots','campeonato_links','tokens')),
  'indexes',(select jsonb_agg(jsonb_build_object('name',i.indexrelid::regclass::text,'valid',i.indisvalid,
      'ready',i.indisready,'unique',i.indisunique,'definition',pg_get_indexdef(i.indexrelid)))
    from pg_index i join pg_class c on c.oid=i.indrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('equipe_lines','campeonato_equipes','campeonato_slots','campeonato_links','tokens')),
  'constraints',(select jsonb_agg(jsonb_build_object('table',c.relname,'name',x.conname,'type',x.contype,
      'validated',x.convalidated,'index',nullif(x.conindid,0)::regclass::text,'definition',pg_get_constraintdef(x.oid)))
    from pg_constraint x join pg_class c on c.oid=x.conrelid join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and (c.relname in ('equipe_lines','campeonato_equipes','campeonato_slots','campeonato_links','tokens')
      or x.confrelid='public.campeonato_equipes'::regclass)),
  'views',(select jsonb_agg(jsonb_build_object('name',c.relname,'definition',pg_get_viewdef(c.oid,true)))
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='v'
      and c.relname like '%campeonato%')
);

-- Counts expose inconsistent/legacy states without returning identities.
select jsonb_build_object(
  'active_without_line',(select count(*) from public.campeonato_equipes where status='ativo' and line_id is null),
  'active_without_slot',(select count(*) from public.campeonato_equipes where status='ativo' and slot_id is null),
  'line_wrong_team',(select count(*) from public.campeonato_equipes ce join public.equipe_lines l on l.id=ce.line_id where ce.status='ativo' and ce.equipe_id is distinct from l.equipe_id),
  'slot_wrong_championship',(select count(*) from public.campeonato_equipes ce join public.campeonato_slots s on s.id=ce.slot_id where ce.status='ativo' and ce.campeonato_id is distinct from s.campeonato_id),
  'mirror_mismatches',(select count(*) from public.campeonato_equipes ce join public.campeonato_slots s on s.id=ce.slot_id where ce.status='ativo' and (ce.line_id is distinct from s.line_id or ce.equipe_id is distinct from s.equipe_id)),
  'active_and_pending_same_line',(select count(*) from (select campeonato_id,line_id from public.campeonato_equipes where line_id is not null and status in ('ativo','pendente') group by campeonato_id,line_id having count(*)>1)t),
  'duplicate_names_in_team',(select count(*) from (select equipe_id,lower(trim(nome)) from public.equipe_lines group by equipe_id,lower(trim(nome)) having count(*)>1)t),
  'group_tokens_case_collisions',(select count(*) from (select lower(token) from public.campeonato_links where tipo='inscricao_equipes_grupo' group by lower(token) having count(*)>1)t),
  'mirror_without_active_participation',(select count(*) from public.campeonato_slots s where (s.line_id is not null or s.equipe_id is not null)
    and not exists(select 1 from public.campeonato_equipes ce where ce.status='ativo' and ce.campeonato_id=s.campeonato_id
      and (ce.slot_id=s.id or (ce.slot_id is null and ce.grupo_id=s.grupo_id and ce.slot_numero=s.slot_numero)))),
  'links_non_object_metadata',(select count(*) from public.campeonato_links where tipo='inscricao_equipes_grupo' and jsonb_typeof(metadata) is distinct from 'object')
);
rollback;
