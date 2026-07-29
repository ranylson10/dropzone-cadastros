-- DROPZONE — RODADA 2
-- Execute no SQL Editor do projeto correto do Supabase.
-- O resultado possui uma única coluna chamada inventario.
-- Copie somente o objeto JSON retornado para:
-- relatorios-testes/banco-publicado.json

select jsonb_build_object(
  'generated_at', now(),
  'tables', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table_schema', t.table_schema,
      'table_name', t.table_name,
      'table_type', t.table_type
    ) order by t.table_name)
    from information_schema.tables t
    where t.table_schema = 'public'
  ), '[]'::jsonb),
  'columns', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table_name', c.table_name,
      'ordinal_position', c.ordinal_position,
      'column_name', c.column_name,
      'data_type', c.data_type,
      'is_nullable', c.is_nullable,
      'column_default', c.column_default
    ) order by c.table_name, c.ordinal_position)
    from information_schema.columns c
    where c.table_schema = 'public'
  ), '[]'::jsonb),
  'constraints', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table_name', cls.relname,
      'constraint_name', con.conname,
      'constraint_type', con.contype,
      'definition', pg_get_constraintdef(con.oid)
    ) order by cls.relname, con.conname)
    from pg_constraint con
    join pg_class cls on cls.oid = con.conrelid
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
  ), '[]'::jsonb),
  'indexes', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table_name', i.tablename,
      'index_name', i.indexname,
      'definition', i.indexdef
    ) order by i.tablename, i.indexname)
    from pg_indexes i
    where i.schemaname = 'public'
  ), '[]'::jsonb),
  'rls', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table_name', cls.relname,
      'relkind', cls.relkind,
      'rls_enabled', cls.relrowsecurity,
      'rls_forced', cls.relforcerowsecurity
    ) order by cls.relname)
    from pg_class cls
    join pg_namespace ns on ns.oid = cls.relnamespace
    where ns.nspname = 'public'
      and cls.relkind in ('r', 'p', 'v', 'm')
  ), '[]'::jsonb),
  'policies', coalesce((
    select jsonb_agg(jsonb_build_object(
      'tablename', p.tablename,
      'policyname', p.policyname,
      'roles', p.roles,
      'cmd', p.cmd,
      'qual', p.qual,
      'with_check', p.with_check
    ) order by p.tablename, p.policyname)
    from pg_policies p
    where p.schemaname = 'public'
  ), '[]'::jsonb),
  'functions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'function_name', proc.proname,
      'identity_arguments', pg_get_function_identity_arguments(proc.oid),
      'security_definer', proc.prosecdef,
      'definition', pg_get_functiondef(proc.oid)
    ) order by proc.proname)
    from pg_proc proc
    join pg_namespace ns on ns.oid = proc.pronamespace
    where ns.nspname = 'public'
  ), '[]'::jsonb),
  'triggers', coalesce((
    select jsonb_agg(jsonb_build_object(
      'table_name', event_object_table,
      'trigger_name', trigger_name,
      'event_manipulation', event_manipulation,
      'action_timing', action_timing,
      'action_statement', action_statement
    ) order by event_object_table, trigger_name)
    from information_schema.triggers
    where trigger_schema = 'public'
  ), '[]'::jsonb)
) as inventario;
