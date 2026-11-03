-- DROPZONE R03 - AUDITORIA SOMENTE LEITURA, compativel com o banco 21/10/2026.
-- Pode ser executada pelo SQL Editor; NAO altera dados, schema nem permissoes.
-- Retorna contagens e flags sem expor dados pessoais, tokens ou chaves.
with
  tbl as (
    select c.oid, c.relname, c.relrowsecurity from pg_class c
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p')
  ),
  pol as (select tablename from pg_policies where schemaname='public'),
  dup_live as (
    select campeonato_id,line_id from public.campeonato_equipes
    where line_id is not null and status in ('ativo','pendente')
    group by campeonato_id,line_id having count(*)>1
  ),
  invalid_slots as (
    select s.id from public.campeonato_slots s
    left join public.campeonato_grupos g on g.id=s.grupo_id
    where g.id is null or s.fase_id is distinct from g.fase_id
  ),
  mismatched_mirrors as (
    select ce.id from public.campeonato_equipes ce
    left join public.campeonato_slots s on s.id=ce.slot_id
    where ce.status='ativo' and (
      s.id is null or s.status is distinct from 'ocupado'
      or s.equipe_id is distinct from ce.equipe_id
      or s.line_id is distinct from ce.line_id
      or s.grupo_id is distinct from ce.grupo_id
      or s.campeonato_id is distinct from ce.campeonato_id
      or s.slot_numero is distinct from ce.slot_numero
    )
  ),
  orphan_occupied as (
    select s.id from public.campeonato_slots s
    where s.status='ocupado' and not exists(
      select 1 from public.campeonato_equipes ce
      where ce.slot_id=s.id and ce.status='ativo'
    )
  ),
  definer_public as (
    select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prosecdef and pg_get_function_result(p.oid) <> 'trigger'
      and (has_function_privilege('anon',p.oid,'EXECUTE')
        or has_function_privilege('authenticated',p.oid,'EXECUTE'))
  ),
  snapshot as (
    select
      (select count(*) from tbl) tables_total,
      (select count(*) from tbl where relrowsecurity) tables_with_rls,
      (select count(*) from tbl t where not exists(select 1 from pol p where p.tablename=t.relname)) tables_without_policy,
      (select count(*) from pol) policies_total,
      (select count(*) from supabase_migrations.schema_migrations) migrations_total,
      (select count(*) from public.campeonato_slots) slots_total,
      (select count(*) from public.campeonato_slots where status='ocupado') slots_occupied,
      (select count(*) from public.campeonato_slots where status='reservado') slots_reserved,
      (select count(*) from public.campeonato_equipes where status='ativo') enrollments_active,
      (select count(*) from public.campeonato_equipes where status='pendente') enrollments_pending,
      (select count(*) from dup_live) duplicate_active_or_pending_lines,
      (select count(*) from invalid_slots) invalid_slot_groups,
      (select count(*) from mismatched_mirrors) occupied_mirror_mismatches,
      (select count(*) from orphan_occupied) occupied_slots_without_active_participation,
      (select count(*) from definer_public) public_callable_security_definers,
      (select count(*) from storage.buckets where public) public_storage_buckets,
      (to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null) legacy_line_index_present,
      (to_regclass('public.campeonato_equipes_line_aberta_unique') is not null) new_open_line_index_present,
      (to_regclass('public.inscricao_recibos') is not null) inscription_receipts_present,
      (to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)') is not null) atomic_enrollment_rpc_present
  )
select jsonb_pretty(to_jsonb(snapshot)||jsonb_build_object('checked_at_utc',clock_timestamp())) as rodada_03_auditoria from snapshot;
