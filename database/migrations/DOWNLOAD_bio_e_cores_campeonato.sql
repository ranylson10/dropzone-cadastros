-- =============================================================================
-- DropZone — Bio nos perfis + cores do tema do campeonato
-- Seguro reexecutar (IF NOT EXISTS)
-- Rode no SQL Editor do Supabase
-- =============================================================================

-- 1) Bio curta em todos os perfis públicos
alter table public.equipes add column if not exists bio text;
alter table public.managers add column if not exists bio text;
alter table public.jogadores add column if not exists bio text;
alter table public.produtoras add column if not exists bio text;

comment on column public.equipes.bio is 'Bio curta pública da equipe';
comment on column public.managers.bio is 'Bio curta pública do manager';
comment on column public.jogadores.bio is 'Bio curta pública do jogador';
comment on column public.produtoras.bio is 'Bio curta pública da produtora';

-- 2) Cores do layout do campeonato (adm)
alter table public.campeonato_configuracoes
  add column if not exists cor_principal text,
  add column if not exists cor_secundaria text,
  add column if not exists cor_texto_clara text,
  add column if not exists cor_texto_escura text;

comment on column public.campeonato_configuracoes.cor_principal is 'Cor principal (#hex) do tema do campeonato';
comment on column public.campeonato_configuracoes.cor_secundaria is 'Cor secundária (#hex)';
comment on column public.campeonato_configuracoes.cor_texto_clara is 'Texto em fundo escuro (#hex)';
comment on column public.campeonato_configuracoes.cor_texto_escura is 'Texto em fundo claro (#hex)';
