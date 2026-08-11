-- Rodada 89D — layouts persistentes para saídas/postagens.
-- Reaproveita campeonato_stream_pack; não cria tabela paralela.

alter table if exists public.campeonato_stream_pack
  add column if not exists output_layouts jsonb not null default '[]'::jsonb;

comment on column public.campeonato_stream_pack.output_layouts is
  'Layouts de saída reutilizáveis (canvas, fundo e áreas vinculadas às cenas oficiais do pacote).';
