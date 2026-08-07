-- DROPZONE — RODADA 4: SEGURANÇA DO BANCO PUBLICADO
-- SOMENTE LEITURA. Não altera estrutura nem dados.
-- Execute no SQL Editor do Supabase e copie apenas o JSON da coluna "seguranca".
-- Salve o retorno em relatorios-testes/seguranca-banco-publicado.json para documentação.

with public_tables as (
  select c.oid, n.nspname as schema_name, c.relname as table_name,
         c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p')
),
policies as (
  select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
),
functions as (
  select p.oid,
         p.proname as function_name,
         pg_get_function_identity_arguments(p.oid) as identity_arguments,
         p.prosecdef as security_definer,
         coalesce(array_to_string(p.proconfig, ','), '') as config,
         pg_get_userbyid(p.proowner) as owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
),
privileges as (
  select table_name, grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee in ('anon','authenticated')
),
rls_missing as (
  select jsonb_agg(jsonb_build_object('table_name', table_name, 'rls_enabled', rls_enabled, 'rls_forced', rls_forced) order by table_name) items
  from public_tables
  where not rls_enabled
),
rls_without_policy as (
  select jsonb_agg(jsonb_build_object('table_name', t.table_name) order by t.table_name) items
  from public_tables t
  where t.rls_enabled
    and not exists (select 1 from policies p where p.tablename = t.table_name)
),
security_definer_without_search_path as (
  select jsonb_agg(jsonb_build_object(
    'function_name', function_name,
    'identity_arguments', identity_arguments,
    'owner', owner,
    'config', config
  ) order by function_name, identity_arguments) items
  from functions
  where security_definer
    and config not ilike '%search_path=%'
),
anon_write_privileges as (
  select jsonb_agg(jsonb_build_object('table_name', table_name, 'privilege_type', privilege_type) order by table_name, privilege_type) items
  from privileges
  where grantee = 'anon' and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
),
policy_summary as (
  select jsonb_agg(jsonb_build_object(
    'table_name', tablename,
    'policy_name', policyname,
    'roles', roles,
    'command', cmd,
    'using', qual,
    'with_check', with_check
  ) order by tablename, policyname) items
  from policies
)
select jsonb_build_object(
  'generated_at', now(),
  'tables_total', (select count(*) from public_tables),
  'tables_rls_enabled', (select count(*) from public_tables where rls_enabled),
  'policies_total', (select count(*) from policies),
  'security_definer_total', (select count(*) from functions where security_definer),
  'rls_missing', coalesce((select items from rls_missing), '[]'::jsonb),
  'rls_without_policy', coalesce((select items from rls_without_policy), '[]'::jsonb),
  'security_definer_without_search_path', coalesce((select items from security_definer_without_search_path), '[]'::jsonb),
  'anon_write_privileges', coalesce((select items from anon_write_privileges), '[]'::jsonb),
  'policies', coalesce((select items from policy_summary), '[]'::jsonb)
) as seguranca;
