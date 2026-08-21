-- DROPZONE — LIMPEZA SEGURA DE RESÍDUOS E2E
-- Execute manualmente no Supabase SQL Editor.
-- Atua somente em registros claramente identificados com o prefixo [E2E].
-- Não remove equipes, jogadores ou campeonatos reais.

begin;

-- 1) Remove notificações e compromissos gerados por testes.
delete from public.notificacoes
where
  coalesce(titulo, '') ilike '%[E2E]%'
  or coalesce(corpo, '') ilike '%[E2E]%'
  or coalesce(payload::text, '') ilike '%[E2E]%';

delete from public.agenda_eventos
where coalesce(titulo, '') ilike '%[E2E]%';

-- 2) Remove inscrições antes das lines, pois a FK de line pode não ter cascade.
delete from public.campeonato_equipes
where coalesce(nome_exibicao, '') ilike '%E2E%'
  or line_id in (select id from public.equipe_lines where coalesce(nome, '') ilike '%E2E%');

delete from public.equipe_lines
where coalesce(nome, '') ilike '%E2E%';

-- 3) Exclui fisicamente campeonatos E2E; dependências próprias caem pelas FKs.
delete from public.campeonatos
where coalesce(nome, '') ilike '[E2E]%';

-- Resíduos antigos eventualmente sem campeonato pai.
delete from public.campeonato_jogos where coalesce(nome, '') ilike '%E2E%';
delete from public.campeonato_fases where coalesce(nome, '') ilike '%E2E%';

commit;

-- Conferência final: todas as contagens devem ficar em zero.
select
  (select count(*) from public.notificacoes
    where (
        coalesce(titulo, '') ilike '%[E2E]%'
        or coalesce(corpo, '') ilike '%[E2E]%'
        or coalesce(payload::text, '') ilike '%[E2E]%'
      )) as notificacoes_e2e_ativas,
  (select count(*) from public.equipe_lines
    where coalesce(nome, '') ilike '%E2E%') as lines_e2e,
  (select count(*) from public.campeonatos
    where coalesce(nome, '') ilike '[E2E]%') as campeonatos_e2e;
