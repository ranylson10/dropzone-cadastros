-- DROPZONE · Grande Final operacional + jogos finais multi-dia
-- Consolida a fase final sem criar um fluxo paralelo de campeonato.
-- A Grande Final possui um único "Grupo da Final".
-- Jogos finais podem ser distribuídos em vários dias; o jogo decisivo continua explícito.

alter table public.campeonato_fases
  add column if not exists tipo text not null default 'normal';

alter table public.campeonato_fases
  drop constraint if exists campeonato_fases_tipo_check;

alter table public.campeonato_fases
  add constraint campeonato_fases_tipo_check
  check (tipo in ('normal', 'grande_final'));

create unique index if not exists campeonato_fases_grande_final_unique
  on public.campeonato_fases (campeonato_id)
  where tipo = 'grande_final';

alter table public.campeonato_jogos
  add column if not exists tipo_jogo text not null default 'normal',
  add column if not exists dia_final integer,
  add column if not exists define_campeao boolean not null default false;

alter table public.campeonato_jogos
  drop constraint if exists campeonato_jogos_tipo_jogo_check;

alter table public.campeonato_jogos
  add constraint campeonato_jogos_tipo_jogo_check
  check (tipo_jogo in ('normal', 'final'));

alter table public.campeonato_jogos
  drop constraint if exists campeonato_jogos_dia_final_check;

alter table public.campeonato_jogos
  add constraint campeonato_jogos_dia_final_check
  check (dia_final is null or dia_final > 0);

comment on column public.campeonato_fases.tipo is
  'normal ou grande_final. Só pode existir uma Grande Final por campeonato.';

comment on column public.campeonato_jogos.tipo_jogo is
  'normal ou final. Jogos vinculados à Grande Final são tratados como finais.';

comment on column public.campeonato_jogos.dia_final is
  'Dia lógico da Grande Final (1, 2, 3...). Permite finais em múltiplos dias sem separar a fase.';

comment on column public.campeonato_jogos.define_campeao is
  'Marca um jogo decisivo. Não é obrigatório em finais por pontuação acumulada ou Champion Point.';
