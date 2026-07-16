-- DropZone — tema do campeonato (cores + opacidade BG + imagem BG)
-- Seguro reexecutar. Cole no SQL Editor do Supabase.

-- Cores base
alter table public.campeonato_configuracoes
  add column if not exists cor_principal text,
  add column if not exists cor_secundaria text,
  add column if not exists cor_texto_clara text,
  add column if not exists cor_texto_escura text;

-- Fundo configurável
alter table public.campeonato_configuracoes
  add column if not exists bg_opacidade integer,
  add column if not exists bg_image_url text;

comment on column public.campeonato_configuracoes.cor_principal is 'Cor principal (#hex)';
comment on column public.campeonato_configuracoes.cor_secundaria is 'Cor secundária (#hex)';
comment on column public.campeonato_configuracoes.bg_opacidade is 'Opacidade/intensidade da cor no fundo (0-100)';
comment on column public.campeonato_configuracoes.bg_image_url is 'URL da imagem de fundo do layout';
