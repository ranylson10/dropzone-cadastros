-- Rodada 32: configuração de análise dos Xtreinos.
-- Mantém a pontuação no motor compartilhado de campeonato e adiciona somente
-- o contexto específico que será usado pelas análises privadas das equipes.

alter table public.campeonato_configuracoes
  add column if not exists xtreino_call_fixa boolean not null default false,
  add column if not exists xtreino_registra_primeira_safe boolean not null default true,
  add column if not exists xtreino_registra_segunda_safe boolean not null default true,
  add column if not exists xtreino_mapas text[] not null default array['bermuda','purgatorio','kalahari']::text[],
  add column if not exists partidas_por_jogo integer not null default 4;

comment on column public.campeonato_configuracoes.xtreino_call_fixa is
  'Indica se o Xtreino trabalha com calls fixas para análise competitiva.';
comment on column public.campeonato_configuracoes.xtreino_registra_primeira_safe is
  'Indica se a primeira safe será registrada nas análises privadas do Xtreino.';
comment on column public.campeonato_configuracoes.xtreino_registra_segunda_safe is
  'Indica se a segunda safe será registrada nas análises privadas do Xtreino.';
comment on column public.campeonato_configuracoes.xtreino_mapas is
  'Mapas habilitados para as quedas do Xtreino.';

comment on column public.campeonato_configuracoes.partidas_por_jogo is
  'Quantidade padrão de quedas por jogo; compartilhada por formatos que usam essa configuração.';
