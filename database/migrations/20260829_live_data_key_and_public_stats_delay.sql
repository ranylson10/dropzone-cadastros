-- DropZone Live Data: atraso apenas na publicacao do site.
-- Pontuador e overlays continuam lendo os resultados imediatamente.

alter table public.campeonato_configuracoes
  add column if not exists estatisticas_delay_segundos integer not null default 300;

alter table public.campeonato_configuracoes
  drop constraint if exists campeonato_configuracoes_estatisticas_delay_segundos_check;

alter table public.campeonato_configuracoes
  add constraint campeonato_configuracoes_estatisticas_delay_segundos_check
    check (estatisticas_delay_segundos between 0 and 7200);

comment on column public.campeonato_configuracoes.estatisticas_delay_segundos is
  'Atraso de publicacao das estatisticas no site. APIs Stream autenticadas ignoram este atraso.';
