# Rodada 09 — consistência da transação de vagas (26/10/2026)

## Status
**Candidatos SQL e tratamento de erros corrigidos na cópia local. NÃO aplicados no Supabase de produção e NÃO homologados em PostgreSQL.**

## Falha verificada por inspeção do código R08
O procedimento candidato `public.fn_aplicar_plano_slots_atomico` conferia estado (`livre`/`ocupado`), associação da participação, contexto de campeonato/fase e status do espelho, mas não consultava `campeonato_grupo_escolha_bloqueios`, `lili_reservas_slot` nem `tokens` para o destino administrativo. A implementação legada da R08 já verifica as três fontes (`backend/src/campeonatos/legacy-slot-eligibility.ts`). Isso gerava divergência entre os modos `legacy` e `atomic` ao ativar a RPC.

A RPC candidata de inscrição por convite também não consultava bloqueio administrativo (embora verificasse reservas da Lili e convites). Poderia aceitar slot livre que a administração bloqueou.

## Alterações na R09
- `docs/sql/20261011_slot_plan_candidate.sql`: bloqueio de grupos/slots, reservas Lili não expiradas e convites ativos não utilizados, antes da primeira mutação de participação; repetição da checagem sobre todos os destinos antes de criar recibo.
- `docs/sql/20261011_atomic_enrollment_candidate.sql`: bloqueio administrativo antes da inscrição e depois das mutações, antes do recibo. Convite fixo continua podendo ocupar seu próprio slot reservado, quando demais condições permitirem.
- `backend/src/campeonatos/invites/atomic-enrollment.ts`: mapeia o erro de domínio do PostgreSQL para HTTP 409, sem expor a mensagem SQL genérica.
- `docs/sql/20261026_round9_atomic_readiness_readonly.sql`: diagnóstico **somente leitura** de funções, recibos, índices e integridade. O campo `ready_for_atomic_live_use` é deliberadamente `false` até homologação real.
- `scripts/testes/test-round9-atomic-db.mjs`: 33 verificações estruturais para garantir que o contrato de exclusões esteja nas duas funções SQL e que o diagnóstico não contenha mutações.

## Validações executadas
- `node scripts/testes/test-round9-atomic-db.mjs`: 33 verificações passaram.
- `npm run test:rounds`: R01–R06, R07 e R08 passaram usando TypeScript global para os testes locais.
- Ainda não houve `npm run build`, E2E no navegador, PostgreSQL executando as funções, duas conexões simultâneas ou teste de rollback de falha intermediária.

## Riscos residuais (BLOQUEIAM publicação)
1. As leituras `NOT EXISTS` de bloqueios/reservas feitas antes e depois da mutação ainda podem sofrer **phantoms** quando outro escritor insere uma reserva/bloqueio sem respeitar o bloqueio transacional sobre grupo/slot. Precisamos alinhar os escritores de bloqueios, convites e reservas ao mesmo protocolo no banco, ou usar mecanismo de exclusão mais forte, após testes de deadlock.
2. A função atual de espelho (`fn_sync_slot_mirror_from_participacao`) em produção não é a revisão candidata. A ordem de instalação de espelho, permissões, índices, recibos e RPCs precisa ser validada.
3. O índice global antigo da reinscrição ainda pode impedir o histórico, até a implantação da migração revisada em staging.
4. `readiness_readonly.sql` NÃO é substituto para backup real, testes de concorrência, ensaio de rollback ou auditoria dos papéis de execução das funções `SECURITY DEFINER`.
5. A função SQL e as duas confirmações (`pre`/`post`) são **candidatas**: sem teste de execução no servidor PostgreSQL, não é possível garantir sintaxe/semântica de toda a migração ou integridade sob concorrência.

## Critérios de aceitação em homologação isolada
- Dois usuários tentam pegar o mesmo slot simultaneamente: exatamente um pode confirmar; nenhuma participação órfã.
- Uma reserva Lili é criada ao mesmo tempo em que um convite tenta ocupar o slot: nenhuma dupla ocupação, rollback completo do lado perdedor.
- Um administrador bloqueia um grupo/slot enquanto uma operação está entre validação e escrita: operação rejeitada ou serializada sem persistir ocupação proibida.
- Troca de slots entre duas lines e falha forçada no segundo `UPDATE`: ou as duas mudanças persistem ou nenhuma.
- Cancelamento e restauração idempotentes: mesma `request_id` retorna recibo igual; dados diferentes com mesma chave retornam conflito.
- O espelho de `campeonato_slots`, as participações e o histórico ficam consistentes após cada cenário.
- Confirmar restauração de backup, revisar permissões e somente então planejar uma ativação coordenada das flags.

## Como testar no Windows
Extraia o projeto, execute `npm ci` na raiz, depois `TESTAR_RODADA_09.bat`. O teste local não modifica nem consulta a produção. Um banco de homologação próprio é requisito para os testes SQL concorrentes.
