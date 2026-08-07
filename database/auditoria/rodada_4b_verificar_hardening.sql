-- =============================================================================
-- DROPZONE — VERIFICAÇÃO PÓS-HARDENING
-- SOMENTE LEITURA
--
-- Execute no SQL Editor do Supabase após:
--   20260807_0540_hardening_anon_e_export_overrides.sql
--
-- Resultado esperado:
--   anon_write_privileges_total = 0
--   broad_authenticated_write_policies = []
--   export_overrides_direct_privileges = []
--   export_overrides_policies = []
-- =============================================================================

with anon_writes as (
  select table_name, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee = 'anon'
    and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')
),
broad_auth_write_policies as (
  select
    tablename as table_name,
    policyname as policy_name,
    cmd as command,
    roles,
    qual as using_expression,
    with_check
  from pg_policies
  where schemaname = 'public'
    and 'authenticated' = any(roles)
    and cmd in ('ALL','INSERT','UPDATE','DELETE')
    and (
      coalesce(btrim(qual), '') = 'true'
      or coalesce(btrim(with_check), '') = 'true'
    )
),
export_privileges as (
  select grantee, privilege_type
  from information_schema.role_table_grants
  where table_schema = 'public'
    and table_name = 'campeonato_export_overrides'
    and grantee in ('anon','authenticated')
),
export_policies as (
  select policyname, roles, cmd, qual, with_check
  from pg_policies
  where schemaname = 'public'
    and tablename = 'campeonato_export_overrides'
)
select jsonb_build_object(
  'generated_at', now(),
  'anon_write_privileges_total', (select count(*) from anon_writes),
  'anon_write_privileges', coalesce(
    (select jsonb_agg(jsonb_build_object(
      'table_name', table_name,
      'privilege_type', privilege_type
    ) order by table_name, privilege_type) from anon_writes),
    '[]'::jsonb
  ),
  'broad_authenticated_write_policies', coalesce(
    (select jsonb_agg(to_jsonb(x) order by x.table_name, x.policy_name)
       from broad_auth_write_policies x),
    '[]'::jsonb
  ),
  'export_overrides_direct_privileges', coalesce(
    (select jsonb_agg(to_jsonb(x) order by x.grantee, x.privilege_type)
       from export_privileges x),
    '[]'::jsonb
  ),
  'export_overrides_policies', coalesce(
    (select jsonb_agg(to_jsonb(x) order by x.policyname)
       from export_policies x),
    '[]'::jsonb
  )
) as seguranca_pos_hardening;
