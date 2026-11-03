-- R02: ROLLBACK ONLY for the consolidated pending/active uniqueness index.
-- CANDIDATE ONLY; do not execute without a staging dry run and a fresh backup.
-- Disabling new inscription writers and validating the rejoin history are mandatory.
-- If a historical rejoin exists, STOP and reconcile; never delete user records.
begin;
set local lock_timeout='5s';
lock table public.campeonato_equipes in share row exclusive mode;
do $guard$
declare v_idx oid;
begin
  v_idx := to_regclass('public.campeonato_equipes_line_aberta_unique');
  if v_idx is null or not exists (
    select 1 from pg_index where indexrelid=v_idx and indisunique and indisvalid and indisready
  ) then
    raise exception 'Índice R02 não encontrado ou inválido; abortando rollback.';
  end if;
  if to_regclass('public.campeonato_equipes_campeonato_line_unique') is not null then
    raise exception 'Índice legado já está presente; revisar manualmente.';
  end if;
  if exists(select 1 from public.campeonato_equipes
    where line_id is not null group by campeonato_id,line_id having count(*)>1) then
    raise exception 'Histórico de reinscrições impede retorno ao índice antigo sem conciliação.';
  end if;
end;
$guard$;
-- Create the original protection before dropping the R02 combined index.
create unique index campeonato_equipes_campeonato_line_unique
  on public.campeonato_equipes(campeonato_id,line_id) where line_id is not null;
drop index public.campeonato_equipes_line_aberta_unique;
commit;
