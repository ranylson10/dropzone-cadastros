select rolname, rolbypassrls
from pg_roles
where rolname in ('service_role', 'supabase_admin', 'postgres')
order by rolname;
