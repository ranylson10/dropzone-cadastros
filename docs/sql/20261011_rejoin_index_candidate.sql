-- CANDIDATE ONLY. Removes the legacy all-status index, preserving active/pending
-- uniqueness. Do not run without fresh preflight, backup and staging validation.
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
drop index public.campeonato_equipes_campeonato_line_unique;
commit;
