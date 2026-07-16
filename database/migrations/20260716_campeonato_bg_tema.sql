-- Fundo do campeonato: opacidade + imagem de background
alter table public.campeonato_configuracoes
  add column if not exists bg_opacidade integer,
  add column if not exists bg_image_url text;

comment on column public.campeonato_configuracoes.bg_opacidade is 'Opacidade/intensidade da cor no fundo (0-100)';
comment on column public.campeonato_configuracoes.bg_image_url is 'URL pública da imagem de fundo do layout do campeonato';
