-- R02 REVISED CANDIDATE ONLY. Replace the legacy all-status uniqueness with
-- ONE uniqueness rule spanning BOTH live states (ativo + pendente). The two old
-- per-status indexes alone DO NOT prevent ativo+pendente for the same line.
-- NOT APPLIED. Requires fresh preflight, backup/restore drill and staging tests.
begin;
set local lock_timeout='5s';
lock table public.campeonato_equipes in share row exclusive mode;
do $guard$
declare v_oid oid;
begin
  v_oid:=to_regclass('public.campeonato_equipes_campeonato_line_unique');
  if v_oid is null or pg_get_indexdef(v_oid)<>'CREATE UNIQUE INDEX campeonato_equipes_campeonato_line_unique ON public.campeonato_equipes USING btree (campeonato_id, line_id) WHERE (line_id IS NOT NULL)' then
    raise exception 'Índice legado ausente ou diferente do esquema revisado.';
  end if;
  if exists(select 1 from pg_constraint where conindid=v_oid) then
    raise exception 'Índice usado por constraint/FK; requer nova revisão.';
  end if;
  if pg_get_indexdef(to_regclass('public.campeonato_equipes_line_unique')) is distinct from
    'CREATE UNIQUE INDEX campeonato_equipes_line_unique ON public.campeonato_equipes USING btree (campeonato_id, line_id) WHERE ((line_id IS NOT NULL) AND (status = ''ativo''::text))'
    or pg_get_indexdef(to_regclass('public.campeonato_equipes_line_pendente_unique')) is distinct from
    'CREATE UNIQUE INDEX campeonato_equipes_line_pendente_unique ON public.campeonato_equipes USING btree (campeonato_id, line_id) WHERE ((line_id IS NOT NULL) AND (status = ''pendente''::text))' then
    raise exception 'Proteções por status diferentes ou ausentes.';
  end if;
  if exists(select 1 from pg_index where indexrelid in (
      to_regclass('public.campeonato_equipes_line_unique'),to_regclass('public.campeonato_equipes_line_pendente_unique'))
      and (not indisvalid or not indisready or not indisunique)) then
    raise exception 'Índice por status inválido ou incompleto.';
  end if;
end;
$guard$;
-- Create replacement BEFORE removing the legacy guard, in this same locked
-- transaction. Historical removido/rejeitado rows are intentionally excluded.
-- The predicate includes both live statuses together to prevent concurrent
-- ativo-vs-pendente requests for the same championship/line.
create unique index campeonato_equipes_line_aberta_unique
  on public.campeonato_equipes(campeonato_id,line_id)
  where line_id is not null and status in ('ativo','pendente');

do $guard_index$
begin
  if not exists (
    select 1 from pg_index i
    where i.indexrelid='public.campeonato_equipes_line_aberta_unique'::regclass
      and i.indisunique and i.indisvalid and i.indisready
  ) then
    raise exception 'Índice combinado não ficou válido. Não retirar o índice legado.';
  end if;
end;
$guard_index$;
drop index public.campeonato_equipes_campeonato_line_unique;
commit;
