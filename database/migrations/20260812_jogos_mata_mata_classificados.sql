alter table public.campeonato_jogos
  add column if not exists mata_mata boolean not null default false,
  add column if not exists classificam_quantidade integer;

alter table public.campeonato_jogos
  drop constraint if exists campeonato_jogos_classificam_quantidade_check;

alter table public.campeonato_jogos
  add constraint campeonato_jogos_classificam_quantidade_check
  check (classificam_quantidade is null or classificam_quantidade > 0);

update public.campeonato_jogos
set classificam_quantidade = null
where mata_mata = false;
