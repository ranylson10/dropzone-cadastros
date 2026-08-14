-- Estrutura planejada pelo criador guiado de campeonatos.
-- Mantém as decisões de criação separadas da estrutura operacional (fases, grupos e slots).

alter table public.campeonato_configuracoes
  add column if not exists estrutura_planejada jsonb not null default '[]'::jsonb,
  add column if not exists liga_usa_divisoes boolean not null default false,
  add column if not exists liga_nome_agrupamento text not null default 'Divisões',
  add column if not exists liga_divisoes jsonb not null default '[]'::jsonb;

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_estrutura_planejada_array,
  drop constraint if exists campeonato_configuracoes_liga_divisoes_array;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_estrutura_planejada_array
    check (jsonb_typeof(estrutura_planejada) = 'array'),
  add constraint campeonato_configuracoes_liga_divisoes_array
    check (jsonb_typeof(liga_divisoes) = 'array');

comment on column public.campeonato_configuracoes.estrutura_planejada is
  'Plano inicial de fases, grupos, slots e classificados configurado no criador guiado.';
comment on column public.campeonato_configuracoes.liga_divisoes is
  'Séries, divisões ou categorias planejadas para uma liga.';
