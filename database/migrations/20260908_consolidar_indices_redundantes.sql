-- Consolida índices duplicados identificados no inventário publicado.
-- Somente índices redundantes são removidos; constraints UNIQUE permanecem.
-- Esta migration deve ser aplicada após confirmar o inventário do projeto correto.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

drop index if exists public.broadcasts_auth_user_idx;
drop index if exists public.campeonato_configuracoes_campeonato_id_idx;
drop index if exists public.campeonato_equipes_campeonato_idx;
drop index if exists public.campeonato_equipes_equipe_idx;
drop index if exists public.campeonato_fases_bonus_ranking_fase_idx;
drop index if exists public.campeonato_jogadores_campeonato_idx;
drop index if exists public.campeonato_jogadores_equipe_idx;
drop index if exists public.campeonato_rulebooks_campeonato_id_idx;
drop index if exists public.comprovantes_inscricao_codigo_idx;
drop index if exists public.convites_tokens_token_idx;
drop index if exists public.convites_tokens_token_uidx;
drop index if exists public.uq_equipes_auth_user_id;
drop index if exists public.equipes_username_unique;
drop index if exists public.equipes_perfis_auth_idx;
drop index if exists public.tokens_token_idx;

commit;
