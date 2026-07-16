-- Bio curta em todos os perfis (aditivo, seguro reexecutar)
alter table public.equipes add column if not exists bio text;
alter table public.managers add column if not exists bio text;
alter table public.jogadores add column if not exists bio text;
alter table public.produtoras add column if not exists bio text;

comment on column public.equipes.bio is 'Bio curta pública da equipe';
comment on column public.managers.bio is 'Bio curta pública do manager';
comment on column public.jogadores.bio is 'Bio curta pública do jogador';
comment on column public.produtoras.bio is 'Bio curta pública da produtora';
