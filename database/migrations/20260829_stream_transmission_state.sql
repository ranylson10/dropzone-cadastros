-- Estado unico da transmissao, independente do status competitivo das partidas.

alter table public.campeonato_stream_pack
  add column if not exists active_partida_id uuid null
    references public.campeonato_partidas(id) on delete set null,
  add column if not exists live_state_version bigint not null default 0;

create index if not exists idx_stream_pack_active_partida
  on public.campeonato_stream_pack (active_partida_id)
  where active_partida_id is not null;

comment on column public.campeonato_stream_pack.active_partida_id is
  'Queda exibida nas overlays. Nao altera o status competitivo da partida.';

comment on column public.campeonato_stream_pack.live_state_version is
  'Versao otimista do estado jogo/queda no ar para impedir sobrescrita silenciosa.';
