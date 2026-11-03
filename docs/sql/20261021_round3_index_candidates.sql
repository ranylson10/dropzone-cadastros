-- R03 CANDIDATOS DE DESEMPENHO: NAO EXECUTAR NA PRODUCAO SEM HOMOLOGACAO.
-- Apenas tres FK independentes sem indice lider no snapshot de 21/10/2026.
-- Sao OPCIONAIS: os dados atuais sao pequenos. Medir e confirmar plano de consulta.
-- Executar um CREATE por vez, fora de BEGIN/COMMIT (CONCURRENTLY nao aceita transacao).
-- Conferir nomes em pg_indexes; IF NOT EXISTS NAO prova definicao equivalente.
-- 1. Pesquisa/limpeza por partida do campeonato (45 linhas no snapshot)
create index concurrently campeonato_jogadores_jogo_id_r03_idx
  on public.campeonato_jogadores(jogo_id) where jogo_id is not null;
-- 2. Pesquisa e FK por line dentro dos slots (456 linhas no snapshot)
create index concurrently campeonato_slots_line_id_r03_idx
  on public.campeonato_slots(line_id) where line_id is not null;
-- 3. Auditoria administrativa por autor (193 linhas no snapshot)
create index concurrently sistema_auditoria_administrador_r03_idx
  on public.sistema_auditoria(administrador_auth_user_id)
  where administrador_auth_user_id is not null;
-- Rollback INDEPENDENTE para cada indice, SOMENTE se criado por esta rodada:
-- drop index concurrently public.campeonato_jogadores_jogo_id_r03_idx;
-- drop index concurrently public.campeonato_slots_line_id_r03_idx;
-- drop index concurrently public.sistema_auditoria_administrador_r03_idx;
-- Antes de criar: confirmar indexdef e se a FK realmente é usada em filtros.
-- Depois: EXPLAIN (ANALYZE, BUFFERS) com parametros de homologacao, nunca dados PII.
