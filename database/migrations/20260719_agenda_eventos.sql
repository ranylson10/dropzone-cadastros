-- =============================================================================
-- DropZone — Agenda / Calendário (ADITIVO)
-- =============================================================================
-- Como usar:
--   1) Abra o Supabase → SQL Editor
--   2) Cole este arquivo inteiro
--   3) Run
--
-- Seguro:
--   - Só CREATE TABLE IF NOT EXISTS + índices
--   - Pode rodar mais de uma vez
-- =============================================================================

create table if not exists public.agenda_eventos (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  descricao text,
  data_evento date not null,
  horario_inicio time not null,
  horario_fim time,
  cor text not null default '#3b82f6',
  tipo text not null default 'livre'
    check (tipo in ('livre', 'treino', 'reuniao', 'scrim', 'outro')),
  visibilidade text not null default 'privada'
    check (visibilidade in ('privada', 'equipe', 'campeonato', 'publica')),
  campeonato_id uuid references public.campeonatos(id) on delete set null,
  equipe_id uuid references public.equipes(id) on delete set null,
  jogo_id uuid references public.campeonato_jogos(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint agenda_eventos_titulo_check check (char_length(trim(titulo)) >= 2),
  constraint agenda_eventos_horario_check check (
    horario_fim is null or horario_fim > horario_inicio
  )
);

create index if not exists agenda_eventos_owner_data_idx
  on public.agenda_eventos (auth_user_id, data_evento);

create index if not exists agenda_eventos_data_idx
  on public.agenda_eventos (data_evento, horario_inicio);

create index if not exists agenda_eventos_campeonato_idx
  on public.agenda_eventos (campeonato_id, data_evento)
  where campeonato_id is not null;

create index if not exists agenda_eventos_equipe_idx
  on public.agenda_eventos (equipe_id, data_evento)
  where equipe_id is not null;

comment on table public.agenda_eventos is
  'Compromissos livres do usuário (treino, reunião, scrim). Jogos de campeonato vêm de campeonato_jogos.';
