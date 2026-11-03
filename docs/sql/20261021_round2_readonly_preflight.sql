-- R02: Safe preflight for production/staging (read-only, no personal rows).
-- Ensure EVERY counter is understood before attempting migrations.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
 'checked_at',clock_timestamp(),
 'server_version',current_setting('server_version'),
 'index_legacy',to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null,
 'index_combined',to_regclass('public.campeonato_equipes_line_aberta_unique') is not null,
 'index_active',to_regclass('public.campeonato_equipes_line_unique') is not null,
 'index_pending',to_regclass('public.campeonato_equipes_line_pendente_unique') is not null,
 'active_pending_conflicts',(
   select count(*) from (
     select campeonato_id,line_id
     from public.campeonato_equipes
     where line_id is not null and status in ('ativo','pendente')
     group by campeonato_id,line_id having count(*)>1
   ) conflicts
 ),
 'slot_mirror_mismatches',(
   select count(*) from public.campeonato_equipes ce
   join public.campeonato_slots s on s.id=ce.slot_id
   where ce.status='ativo' and
     (ce.equipe_id is distinct from s.equipe_id or ce.line_id is distinct from s.line_id
       or ce.grupo_id is distinct from s.grupo_id or ce.campeonato_id is distinct from s.campeonato_id)
 ),
 'active_without_slot',(
   select count(*) from public.campeonato_equipes where status='ativo' and slot_id is null
 ),
 'reserved_slots',(
   select count(*) from public.campeonato_slots where status='reservado'
 ),
 'active_lili_reservations',(
   select count(*) from public.lili_reservas_slot where status='ativa' and expira_em>clock_timestamp()
 ),
 'active_invite_tokens_with_slot',(
   select count(*) from public.tokens where tipo in ('team_invite','convite_equipe_campeonato')
     and status='ativo' and coalesce(usado,false)=false and slot_id is not null
     and (expira_em is null or expira_em>clock_timestamp())
 ),
 'inscricao_rpc_installed',
   to_regprocedure('public.fn_inscrever_por_convite_atomico(uuid,uuid,text,text,uuid,uuid,text,uuid,integer,text)') is not null
)) as rodada_02_preflight;
rollback;
