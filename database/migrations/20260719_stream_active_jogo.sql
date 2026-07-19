-- =============================================================================
-- DROPZONE · Contexto de jogo da live (mapas do dia / overlays)
-- Rode no Supabase SQL Editor. Idempotente.
--
-- · active_jogo_id no pack: organizador define qual JOGO alimenta as overlays
-- · Se null, o backend tenta auto: partida em_andamento → data de hoje → último jogo
-- =============================================================================

alter table public.campeonato_stream_pack
  add column if not exists active_jogo_id uuid null
    references public.campeonato_jogos(id) on delete set null;

create index if not exists idx_stream_pack_active_jogo
  on public.campeonato_stream_pack (active_jogo_id)
  where active_jogo_id is not null;

comment on column public.campeonato_stream_pack.active_jogo_id is
  'Jogo ativo da live (mapas do dia, partida atual, stats por jogo). Null = auto-detect.';
