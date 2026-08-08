-- DROPZONE · Prazo de escalação por jogo/grupo
-- Permite abrir/fechar escalação em horas relativas ao horário do jogo.

alter table public.campeonato_jogos
  add column if not exists escalacao_abre_horas_antes integer,
  add column if not exists escalacao_fecha_horas_antes integer;

alter table public.campeonato_jogos
  drop constraint if exists campeonato_jogos_escalacao_abre_horas_check,
  drop constraint if exists campeonato_jogos_escalacao_fecha_horas_check;

alter table public.campeonato_jogos
  add constraint campeonato_jogos_escalacao_abre_horas_check
    check (escalacao_abre_horas_antes is null or escalacao_abre_horas_antes >= 0),
  add constraint campeonato_jogos_escalacao_fecha_horas_check
    check (escalacao_fecha_horas_antes is null or escalacao_fecha_horas_antes >= 0);

comment on column public.campeonato_jogos.escalacao_abre_horas_antes is
  'Quantas horas antes do horário do jogo a escalação abre para os grupos deste jogo.';

comment on column public.campeonato_jogos.escalacao_fecha_horas_antes is
  'Quantas horas antes do horário do jogo a escalação fecha para os grupos deste jogo.';
