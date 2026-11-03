# R18 — Destinatários de convites e reservas (26/10/2026)

**Status:** código corrigido e testes offline disponíveis; **NÃO homologado em PostgreSQL real**, sem produção/deploy alterados. Base cumulativa R17.

## Defeitos identificados

1. `team-invite-read.ts` não recuperava `equipe_destino_id`, portanto `acceptTeamInvite()` aceitava uma equipe selecionada diferente da equipe destinatária do token. Também não validava `line_destino_id`.
2. Mesmo quando um token era validado no início, o `UPDATE` final não fixava os campos de destinatário, permitindo que uma alteração concorrente fosse confirmada indevidamente.
3. A candidata R10 de reserva Lili tratava `t.equipe_id` mas não os campos `equipe_destino_id` e `line_destino_id` dos tokens.
4. A candidata R11 de renovação não verificava bloqueios administrativos do grupo/slot, embora as rotas de escolha e restauração já os respeitassem.

## Alterações

- `backend/src/campeonatos/invites/types.ts`: `assertTeamInviteRecipient()` rejeita equipes e lines diferentes de `equipe_id`, `equipe_destino_id` e `line_destino_id` quando presentes. Campos vazios permitem convites abertos.
- `backend/src/campeonatos/invites/team-invite-read.ts`: consulta de token carrega `equipe_destino_id`.
- `backend/src/campeonatos/invites/team-invite-accept.ts`: valida alvo antes de realizar qualquer gravação; revalida line resolvida; o UPDATE condicional do token fixa os destinos originais (`.eq`/`.is`). Se o UPDATE não encontrar o token, aplica compensação já existente, ainda **não equivalente a uma transação PostgreSQL única**.
- `docs/sql/20261026_round10_lili_writer_candidate.sql`: bloqueia reserva associada a convite de outra equipe ou line.
- `docs/sql/20261026_round11_invite_writer_candidate.sql`: renovação bloqueada enquanto grupo/slot possui bloqueio administrativo ativo. Cancelamento continua liberado para remover convite obsoleto.
- `scripts/testes/test-round18-invite-destinations.mjs`: testes do guard, da execução simulada de aceitação, dos filtros de claim e das candidatas SQL. O número de testes não representa execuções nativas do PostgreSQL.

## Testes

`npm run test:round18` ou `TESTAR_RODADA_18.bat` no Windows (após `npm ci`). Também reexecutar `npm run test:rounds`, R13–R17, `npm run typecheck`, `npm run lint`, build e E2E **em ambiente com dependências disponíveis**.

## Homologação obrigatória

1. Restaurar esquema atual anonimizado **somente em staging isolado**. Não usar credenciais/URL de produção.
2. Aplicar candidatas R09–R11 em staging após revisar dependências, owner, RLS, gatilhos e grants.
3. Simular convite aberto, destinado a outra equipe, destinado a outra line e troca de destinatário enquanto o primeiro cliente aguarda, com duas sessões PostgreSQL.
4. Concorrer reserva Lili × convite destinado × bloqueio administrativo × renovação. Confirmar integridade de tokens, slots, recibos, participação e rollback.
5. Verificar UI de times com convites direcionados legados e mensagens de erro. Construção Next.js/E2E ainda não foi certificada aqui.

**Limites:** o modo legacy de inscrição continua com mais de uma gravação; SQLs novas continuam candidatas e não foram executadas em produção. O gate de liberação permanece bloqueado.
