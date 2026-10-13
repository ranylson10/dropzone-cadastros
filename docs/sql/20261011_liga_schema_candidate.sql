-- CANDIDATE ONLY, NOT APPLIED. Completes the local 20260814 Liga plan migration.
-- The earlier exported catalog lacks these fields and rejects all liga_* origins.
-- Fresh preflight/owners/dependencies/backup/staging required before any real application.
begin;
set local lock_timeout='5s';
lock table public.campeonato_configuracoes,public.campeonato_equipes in share row exclusive mode;
do $guard$
declare definition text;validated boolean;
begin
  select pg_get_constraintdef(oid),convalidated into definition,validated from pg_constraint
    where conrelid='public.campeonato_equipes'::regclass and conname='campeonato_equipes_origem_entrada_check' and contype='c';
  if definition is distinct from $$CHECK ((origem_entrada = ANY (ARRAY['organizador'::text, 'convite'::text, 'inscricao'::text, 'link'::text, 'vendedor'::text, 'manual'::text, 'token'::text, 'compra_online'::text])))$$
    or validated is distinct from true then raise exception 'Constraint de origem diferente do catálogo revisado; exige novo preflight.';end if;
end;
$guard$;
alter table public.campeonato_configuracoes
  add column if not exists estrutura_planejada jsonb not null default '[]'::jsonb,
  add column if not exists liga_usa_divisoes boolean not null default false,
  add column if not exists liga_nome_agrupamento text not null default 'Divisões',
  add column if not exists liga_divisoes jsonb not null default '[]'::jsonb;
-- Preserve all existing valid origins and add exactly the six values emitted by the Liga UI.
alter table public.campeonato_equipes drop constraint campeonato_equipes_origem_entrada_check;
alter table public.campeonato_equipes add constraint campeonato_equipes_origem_entrada_check
  check(origem_entrada in('organizador','convite','inscricao','link','vendedor','manual','token','compra_online',
    'liga_mantida','liga_promovida','liga_rebaixada','liga_classificatoria_aberta','liga_vaga_paga','liga_convite_direto'));
-- Same array-type contracts as the local guided-structure migration; validate existing rows.
alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_estrutura_planejada_array,
  drop constraint if exists campeonato_configuracoes_liga_divisoes_array;
alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_estrutura_planejada_array check(jsonb_typeof(estrutura_planejada)='array'),
  add constraint campeonato_configuracoes_liga_divisoes_array check(jsonb_typeof(liga_divisoes)='array');
commit;
