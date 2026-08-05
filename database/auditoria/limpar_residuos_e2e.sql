-- DROPZONE — LIMPEZA SEGURA DE RESÍDUOS E2E
-- Execute manualmente no Supabase SQL Editor.
-- Atua somente em registros claramente identificados com o prefixo [E2E].
-- Não remove equipes, jogadores ou campeonatos reais.

begin;

-- 1) Arquiva notificações geradas por testes.
update public.notificacoes
set
  status = 'arquivada',
  read_at = coalesce(read_at, now()),
  archived_at = coalesce(archived_at, now())
where
  coalesce(titulo, '') ilike '%[E2E]%'
  or coalesce(corpo, '') ilike '%[E2E]%'
  or coalesce(payload::text, '') ilike '%[E2E]%';

-- 2) Remove inscrições temporárias identificadas pelo nome público/line.
-- A exclusão é física apenas para resíduos E2E, evitando continuar ocupando vagas.
delete from public.campeonato_equipes
where coalesce(nome_exibicao, '') ilike '[E2E]%';

-- 3) Exclui logicamente campeonatos temporários.
update public.campeonatos
set
  status = 'excluido',
  deleted_at = coalesce(deleted_at, now())
where coalesce(nome, '') ilike '[E2E]%';

commit;

-- Conferência final: todas as contagens devem ficar em zero.
select
  (select count(*) from public.notificacoes
    where status <> 'arquivada'
      and (
        coalesce(titulo, '') ilike '%[E2E]%'
        or coalesce(corpo, '') ilike '%[E2E]%'
        or coalesce(payload::text, '') ilike '%[E2E]%'
      )) as notificacoes_e2e_ativas,
  (select count(*) from public.campeonato_equipes
    where coalesce(nome_exibicao, '') ilike '[E2E]%') as inscricoes_e2e,
  (select count(*) from public.campeonatos
    where coalesce(nome, '') ilike '[E2E]%'
      and deleted_at is null) as campeonatos_e2e_ativos;
