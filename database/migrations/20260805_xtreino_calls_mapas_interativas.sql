-- DROPZONE · Xtreino · mapa territorial interativo de calls
alter table public.xtreino_mapa_calls
  add column if not exists poligono jsonb,
  add column if not exists label_x numeric,
  add column if not exists label_y numeric;

alter table public.xtreino_mapa_call_equipes
  add column if not exists cor text not null default '#d6b84b',
  add column if not exists opacidade numeric not null default 0.42;

alter table public.xtreino_mapa_call_equipes
  drop constraint if exists xtreino_mapa_call_equipes_opacidade_check;

alter table public.xtreino_mapa_call_equipes
  add constraint xtreino_mapa_call_equipes_opacidade_check
  check (opacidade >= 0.10 and opacidade <= 0.90);

-- Uma equipe pode ocupar uma ou mais calls no mesmo mapa.
drop index if exists public.xtreino_call_principal_unica_por_equipe_mapa;

comment on column public.xtreino_mapa_calls.poligono is 'Lista de pontos normalizados [{x,y}] que delimitam a call sobre o mapa.';
comment on column public.xtreino_mapa_calls.label_x is 'Posição X normalizada opcional da logo/legenda.';
comment on column public.xtreino_mapa_calls.label_y is 'Posição Y normalizada opcional da logo/legenda.';
comment on column public.xtreino_mapa_call_equipes.cor is 'Cor territorial definida manualmente para a equipe nesta call.';
comment on column public.xtreino_mapa_call_equipes.opacidade is 'Opacidade territorial entre 0.10 e 0.90.';
