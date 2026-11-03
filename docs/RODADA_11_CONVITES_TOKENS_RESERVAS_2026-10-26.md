# DropZone R11 — Convites, tokens e limpeza de reservas (26/10/2026)

**Status:** correções de código e candidatas SQL prontas; testes simulados executados. **NÃO aplicar em produção antes da homologação do PostgreSQL.** R01–R10 preservadas. Nenhuma mudança no Supabase ou publicação.

## Problemas identificados no R10

1. `consumeToken` primeiro lia o token e depois atualizava `usado`, sem condições de estado na gravação. Duas requisições simultâneas podiam ambas retornar sucesso. O código também convertia o token para maiúsculas, corrompendo códigos case-sensitive.
2. A renovação de convites cancelava o token antigo antes de inserir o novo; se o INSERT falhasse, a vaga ficava sem convite válido.
3. O cancelamento usava `UPDATE campeonato_slots SET status='livre'` após cancelar token, sem conferir se outro convite ou reserva Lili ainda detinha a vaga; o trigger do banco, ainda legado, também não considerava reservas Lili.
4. A limpeza global `fn_lili_liberar_reservas_expiradas` atualiza reservas de vários slots antes de bloquear seus grupos, invertendo locks frente aos escritores transacionais da R10.

## Arquivos e comportamento alterados

- `backend/src/dropzone/entities/tokens.ts`: consumo de token agora é um único `UPDATE ... WHERE token=?, usado=false, status='ativo', expira_em futuro ou NULL RETURNING *`; não muda letras do código. **Ainda não inclui a criação da participação na mesma transação.**
- `backend/src/campeonatos/invites/team-invite-mutation-transport.ts`: `DROPZONE_TEAM_INVITE_WRITE_MODE=atomic` (opt-in), valida UUID de idempotência, chama a nova RPC e **falha fechada** se RPC indisponível ou resposta inconsistente.
- As rotas `.../convites-equipe/[tokenId]` e `/renovar`: roteiam para RPC R11 no modo novo. No modo antigo, cancelamento só atua sobre convite ativo e não utilizado; não forçam mais manualmente `livre`. A renovação cria primeiro o novo token e só depois tenta cancelar o antigo; em falha, tenta compensar e informa estado incerto quando necessário. **O modo legado ainda NÃO é atômico.**
- `web/features/campeonatos/equipes/services/campeonato-equipes.service.ts`: `Idempotency-Key` UUID estável para repetição de uma mesma operação de convite no cliente web.
- `docs/sql/20261026_round11_invite_writer_candidate.sql`: tabela de recibos privada e RPC de renovação/cancelamento em uma transação com rechecagens, lock grupo -> slot -> token, autorização e reconciliação do espelho considerando tokens e Lili.
- `docs/sql/20261026_round11_scoped_expiry_candidate.sql`: limpeza em lote com grupo -> slot, somente reservas expiradas, sem liberar enquanto existir reserva válida; execução somente pelo backend `service_role`.
- `backend/src/billing/lili-slot-reservation.ts`: `DROPZONE_LILI_CLEANUP_MODE=atomic` passa a chamar **apenas** a RPC de limpeza R11; padrão continua `legacy`. Um RPC ausente falha fechado nesse modo.
- `docs/sql/20261026_round11_readiness_readonly.sql`: diagnóstico de prontidão, não autoriza publicação sozinho.

## Flags: NÃO ativar agora

- `DROPZONE_TEAM_INVITE_WRITE_MODE=legacy` (padrão) ou `atomic` (exige RPC R11 + R09/R10).
- `DROPZONE_LILI_CLEANUP_MODE=legacy` (padrão) ou `atomic` (exige cleanup R11).
- Permanecem `DROPZONE_LILI_RESERVATION_MODE` e `DROPZONE_GROUP_BLOCK_WRITE_MODE` da R10, também em `legacy`.

**Todas as rotas administrativas e integrações que alteram `tokens` precisam aderir ao protocolo**, inclusive criação de convite, consumo, renovação, cancelamento, outros tipos de convite e escritores da Lili. O trigger legado de tokens ainda escreve no slot e pode inverter a ordem de locks se chamado por outro fluxo. Não habilitar só uma flag isoladamente.

## Homologação obrigatória

1. Criar ambiente PostgreSQL isolado com cópia segura/anônima do esquema e dados; não usar produção.
2. Instalar e validar R02, R09, R10 e R11 na ordem de dependências, conferir ACL das `SECURITY DEFINER`, triggers e chaves.
3. Em **duas conexões**, testar renovação x cancelamento, duas renovações, convite x inscrição, convite x Lili, limpeza x reserva, limpeza x bloqueio, token repetido e retry com mesma `Idempotency-Key`.
4. Injetar falha entre `INSERT` e `UPDATE`, testar rollback integral (sem novo token órfão). Confirmar zero deadlocks; revisar `pg_locks` e latências.
5. Verificar todos os escritores remanescentes, índices e políticas antes de ativar o novo modo. A execução dos testes locais **não** prova concorrência PostgreSQL.

## Execução local

`npm ci`, depois `node scripts/testes/test-round11-invites.mjs`, `npm run test:rounds` ou `TESTAR_RODADA_11.bat`. `TESTAR_RODADA_11.bat --build` também solicita TypeScript/lint/build completo (dependências e acesso ao ambiente necessários).

## Limitações conhecidas

- O escritor SQL R11 é candidato e **não foi interpretado/executado por PostgreSQL neste ambiente**.
- A rotina de consumo genérico usa `UPDATE` atômico, mas a inscrição criada depois ainda exige conversão para uma única RPC transacional.
- O fluxo de convite legado só oferece salvaguardas/compensação de melhor esforço.
- Os testes R11 são mocks HTTP/transport e verificações estáticas, não testes E2E de dois clientes/duas sessões.
- Nenhum arquivo real de sessão/credencial foi incluído nos pacotes R11.
