-- DROPZONE / R09 - SQL READ ONLY, no migrations and no data writes.
-- Execute ONLY to inspect whether the transaction candidates are installed.
-- Returns counts and schema flags; never returns credentials, identifiers or player data.
-- Zero counts do not prove concurrency safety. Run real multi-session tests in staging.
begin transaction read only;
with schema_flags as (
 select
   (to_regclass('public.movimentacao_recibos') is not null) as movement_receipts,
   (to_regclass('public.inscricao_recibos') is not null) as enrollment_receipts,
   (to_regclass('public.participacao_recibos') is not null) as participation_receipts,
   (to_regclass('public.campeonato_equipes_line_aberta_unique') is not null) as open_line_unique_index,
   (to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null) as legacy_all_status_index,
   (to_regprocedure('public.fn_aplicar_plano_slots_atomico(uuid,uuid,uuid,text,jsonb,text,text,text)') is not null) as atomic_slot_plan,
   (to_regprocedure('public.fn_transferir_slots_atomico(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid)') is not null) as atomic_slot_transfer,
   (to_regprocedure('public.fn_escolher_grupo_atomico(uuid,uuid,uuid,text,text,uuid,uuid,uuid,uuid,uuid,text)') is not null) as atomic_group_choice,
   (to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)') is not null) as atomic_invite_enrollment
),
 integrity as (
 select
  (select count(*) from public.campeonato_equipes where status='ativo') as active_participations,
  (select count(*) from public.campeonato_equipes where status='pendente') as pending_participations,
  (select count(*) from public.campeonato_slots where status='ocupado') as occupied_slots,
  (select count(*) from public.campeonato_slots where status='reservado') as reserved_slots,
  (select count(*) from public.campeonato_grupo_escolha_bloqueios where ativo=true) as active_admin_blocks,
  (select count(*) from public.lili_reservas_slot where status='ativa' and expira_em>clock_timestamp()) as active_lili_reservations,
  (select count(*) from public.tokens where status='ativo' and coalesce(usado,false)=false
      and tipo in('team_invite','convite_equipe_campeonato')
      and (expira_em is null or expira_em>clock_timestamp()) and slot_id is not null) as active_slot_invitations,
  (select count(*) from (
      select campeonato_id,line_id from public.campeonato_equipes
      where line_id is not null and status in('ativo','pendente')
      group by campeonato_id,line_id having count(*)>1
    ) d) as conflicting_open_lines,
  (select count(*) from public.campeonato_equipes ce
      left join public.campeonato_slots s on s.id=ce.slot_id
      where ce.status='ativo' and (s.id is null or s.status is distinct from 'ocupado'
        or s.campeonato_id is distinct from ce.campeonato_id
        or s.grupo_id is distinct from ce.grupo_id
        or s.line_id is distinct from ce.line_id
        or s.equipe_id is distinct from ce.equipe_id
        or s.slot_numero is distinct from ce.slot_numero)) as invalid_active_mirrors
)
select jsonb_pretty(jsonb_build_object(
  'checked_at_utc',clock_timestamp(),
  'schema',to_jsonb(schema_flags),
  'integrity',to_jsonb(integrity),
  'ready_for_atomic_live_use',false,
  'reason','Requires isolated PostgreSQL concurrency tests, restore drill, migrations, and coordinated runtime activation'
)) as audit
from schema_flags cross join integrity;
rollback;
