begin;

alter table public.campeonatos
  add column if not exists tipo text not null default 'copa';

alter table public.campeonatos
  drop constraint if exists campeonatos_tipo_check;

alter table public.campeonatos
  add constraint campeonatos_tipo_check
  check (tipo in ('diario', 'copa', 'liga', 'xtreino', 'confronto'));

alter table public.campeonato_grupos
  drop constraint if exists campeonato_grupos_nome_unique;

drop index if exists public.campeonato_grupos_nome_unique;
drop index if exists public.campeonato_grupos_contexto_nome_idx;

create unique index campeonato_grupos_contexto_nome_idx
  on public.campeonato_grupos (
    campeonato_id,
    coalesce(fase_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(nome)
  );

commit;
