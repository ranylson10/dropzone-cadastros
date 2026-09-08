-- Valida a regra de identidade criada como NOT VALID na integração histórica
-- do elenco. A validação não reescreve dados e falha se existir linha inválida.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '30s';

alter table public.equipe_jogadores
  validate constraint equipe_jogadores_identidade_check;

commit;
