alter table public.jogadores
  add column if not exists disponivel_recrutamento boolean not null default false;

comment on column public.jogadores.disponivel_recrutamento is
  'Indica se o jogador deseja aparecer como disponível para recrutamento.';
