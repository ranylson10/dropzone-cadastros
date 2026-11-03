-- DROPZONE R11: SOMENTE LEITURA, execute primeiro na copia de homologacao.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
 'checked_at',clock_timestamp(),
 'token_rpc',to_regprocedure('public.fn_alterar_convite_slot_r11(uuid,uuid,uuid,uuid,text)') is not null,
 'token_receipts',to_regclass('public.campeonato_convite_recibos') is not null,
 'scoped_expiry',to_regprocedure('public.fn_lili_liberar_reservas_expiradas_r11(integer)') is not null,
 'legacy_slot_token_trigger',exists(select 1 from pg_trigger where tgrelid='public.tokens'::regclass
       and tgname='trg_sync_slot_reserva_from_token' and not tgisinternal),
 'active_team_invites',(select count(*) from public.tokens where tipo in ('team_invite','convite_equipe_campeonato')
       and status='ativo' and usado=false and (expira_em is null or expira_em>now())),
 'expired_lili_reservations',(select count(*) from public.lili_reservas_slot where status='ativa' and expira_em<=now()),
 'double_active_invites_same_slot',(select count(*) from (
    select slot_id from public.tokens where slot_id is not null
      and tipo in ('team_invite','convite_equipe_campeonato') and status='ativo'
      and usado=false and (expira_em is null or expira_em>now())
      group by slot_id having count(*)>1) q),
 'orphan_reserved_slots',(select count(*) from public.campeonato_slots s
    where s.status='reservado' and s.line_id is null and s.equipe_id is null
    and not exists(select 1 from public.tokens t where t.slot_id=s.id
      and t.status='ativo' and t.tipo in ('team_invite','convite_equipe_campeonato')
      and not coalesce(t.usado,false) and (t.expira_em is null or t.expira_em>now()))
    and not exists(select 1 from public.lili_reservas_slot r where r.slot_id=s.id
      and r.status='ativa' and r.expira_em>now()))),
 'ready_to_enable',false,
 'reason','Requires two-session Postgres tests, old trigger reconciliation and ALL token writers migrated.'
)) as r11_preflight;
rollback;
