-- DROPZONE R10 / EXCLUSIVAMENTE LEITURA / NÃO ALTERA O SUPABASE.
-- Execute no SQL Editor para verificar instalação e consistência do esquema.
-- IMPORTANT: ready_to_enable continua FALSE mesmo se todos os campos estiverem OK.
begin transaction read only;
with flags as (
  select
    to_regprocedure('public.fn_lili_reservar_slot_r10(text,uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,integer,jsonb)') is not null as lili_r10_installed,
    to_regprocedure('public.fn_alterar_bloqueio_grupo_atomico(uuid,uuid,uuid,text,uuid,uuid,uuid,uuid,text)') is not null as group_block_rpc_installed,
    to_regclass('public.campeonato_bloqueio_recibos') is not null as group_block_receipts_installed,
    to_regprocedure('public.fn_aplicar_plano_slots_atomico(uuid,uuid,uuid,text,jsonb,text,text,text)') is not null as movement_rpc_installed,
    to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)') is not null as invite_rpc_installed,
    to_regclass('public.campeonato_equipes_line_aberta_unique') is not null as active_pending_unique_index_installed,
    to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null as legacy_all_status_unique_present
), counts as (
  select
    (select count(*) from public.campeonato_equipes where status='ativo') as active_enrollments,
    (select count(*) from public.campeonato_slots where status='ocupado') as occupied_slots,
    (select count(*) from (
      select campeonato_id,line_id from public.campeonato_equipes
      where line_id is not null and status in('ativo','pendente')
      group by campeonato_id,line_id having count(*)>1) duplicates) as duplicated_open_lines,
    (select count(*) from public.campeonato_equipes ce
      left join public.campeonato_slots s on s.id=ce.slot_id
      where ce.status='ativo' and (s.id is null or s.equipe_id is distinct from ce.equipe_id
        or s.line_id is distinct from ce.line_id or s.status is distinct from 'ocupado')) as invalid_active_mirrors
)
select jsonb_pretty(jsonb_build_object(
  'verified_utc',clock_timestamp(),
  'schema',to_jsonb(flags),
  'consistency',to_jsonb(counts),
  'ready_to_enable',false,
  'reason','Requires restored staging, real two-session concurrency, R09/R10 SQL validation, and all remaining legacy token writers review.'
)) as rodada_10_readiness
from flags cross join counts;
rollback;
