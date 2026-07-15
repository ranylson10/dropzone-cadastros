-- Amplia valores permitidos de origem_entrada para cobrir fluxos reais do sistema.
-- Antes: apenas organizador | convite | inscricao (ou subset similar).
-- Isso quebrava o link de grupo (origem "link") e vendedores (origem "vendedor").

alter table public.campeonato_equipes
  drop constraint if exists campeonato_equipes_origem_entrada_check;

alter table public.campeonato_equipes
  add constraint campeonato_equipes_origem_entrada_check
  check (
    origem_entrada = any (
      array[
        'organizador',
        'convite',
        'inscricao',
        'link',
        'vendedor',
        'manual',
        'token'
      ]::text[]
    )
  );
