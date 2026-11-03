# DROPZONE — R10: Escritores de reservas e bloqueios (26/10/2026)

**Status: correções preparadas em código; testes locais aprovados; candidatas SQL NÃO aplicadas; PostgreSQL concorrente NÃO testado; Supabase de produção NÃO alterado.**

## Problemas encontrados por inspeção da R09

1. A função antiga `fn_lili_reservar_slot` bloqueava o slot, mas não o grupo nem verificava bloqueios administrativos e convites ativos na mesma transação. Ela aceitava `status='reservado'` sem identificar necessariamente o dono da reserva.
2. A operação administrativa `set_group_choice_block` / `remove_group_choice_block` usava REST `INSERT/UPDATE`, sem aquisição do lock do grupo. Um administrador podia bloquear a vaga ao mesmo tempo que outro escritor a ocupava.
3. O serviço da Lili chamava uma limpeza *global* de reservas antes da reserva individual, em outra ordem de locks. Isso poderia gerar espera circular com escritores que começam pelo grupo.
4. A confirmação de reserva no pagamento atualizava por ID sem exigir `status='ativa'` e prazo futuro. Uma entrega tardia de webhook poderia confirmar reserva expirada/cancelada.
5. O frontend não mantinha chave de idempotência para as ações de bloqueio caso uma gravação concluísse e a atualização visual falhasse.

## Mudanças em R10

- `docs/sql/20261026_round10_lili_writer_candidate.sql`: **nova** RPC `fn_lili_reservar_slot_r10` (a legacy fica intacta); bloqueia grupo → slot; valida campeonato/fase, bloqueios, convites e reserva anterior; expira somente reserva daquele slot sob locks; restringe EXECUTE a `service_role`.
- `docs/sql/20261026_round10_block_writer_candidate.sql`: RPC `fn_alterar_bloqueio_grupo_atomico` e recibos de idempotência; verifica permissão de gestão, locks de grupo → slot, pertencimento a campeonato/fase, gravação e recibo na mesma transação. Restringe EXECUTE a `service_role`.
- `backend/src/billing/lili-slot-reservation.ts`: flag `DROPZONE_LILI_RESERVATION_MODE=atomic` usa **somente** a RPC nova e omite a limpeza global antiga; padrão permanece `legacy`. Confirmação de reserva agora exige status ativo e não expirada; webhooks repetidos para reserva já confirmada são aceitos sem segunda atualização.
- `backend/src/campeonatos/group-block-transport.ts` e API: flag `DROPZONE_GROUP_BLOCK_WRITE_MODE=atomic` chama **somente** a RPC nova com chave estável; sem RPC, retorna indisponibilidade (sem fallback legado); o padrão continua `legacy`.
- `AdvancedStructureTab.tsx`: gera chave UUID e a mantém após erro ou falha do GET até resposta e recarregamento confirmados.
- `scripts/testes/test-round10-writers.mjs`: mocks de transporte, falha fechada, confirmação de reserva e contratos de SQL.
- `docs/sql/20261026_round10_readiness_readonly.sql`: inspeciona prontidão de esquema e inconsistências; nunca autoriza ativação automaticamente.

## Dependências e ativação **NÃO autorizada** sem homologação

1. Restaurar **backup anonimizado** em staging isolado; verificar owners, policies, grants, triggers, chaves e índices.
2. Aplicar e testar em staging **na ordem planejada**: R02 espelho/index, R09 permissão + plano + inscrição e demais primitivas, R10 bloqueio e Lili. Revisar rollback e ACL de todas as funções SECURITY DEFINER.
3. Verificar que **outros escritores de convite/`tokens`**, compra de vagas, limpeza de reservas e alterações administrativas seguem o mesmo protocolo de lock grupo → slot. Esta rodada NÃO ajustou todos esses escritores.
4. Testar pelo menos duas conexões simultâneas com `BEGIN`, `pg_sleep()` e controle de commits; simular conflitos reais entre:
   - Inscrição e reserva Lili no mesmo slot;
   - Reserva Lili e bloqueio administrativo do slot/grupo;
   - Administração bloqueando durante movimentação atômica;
   - Expiração de reserva ao mesmo tempo que inscrição;
   - Duas reservas simultâneas; convite associado a outra equipe;
   - Replay com mesma `request_id`; reutilização da chave com outro payload;
   - Falha induzida após `UPDATE` intermediário: nenhuma alteração parcial pode sobreviver.
5. Em cada teste, confirmar locks e ausência de deadlocks, nenhum slot/participação divergente, recibo correto, RLS, e a integridade do histórico.
6. Somente após resultado positivo, combinar implantação coordenada de banco + backend + frontend e flags. Não alternar só uma das flags no site de produção.

### Flags (ambas OFF por padrão)

- `DROPZONE_LILI_RESERVATION_MODE=legacy` (padrão) ou `atomic` (exige RPC R10).
- `DROPZONE_GROUP_BLOCK_WRITE_MODE=legacy` (padrão) ou `atomic` (exige RPC R10 e cabeçalho de idempotência).

**Não aplicar essas SQLs em produção apenas porque `npm run test:rounds` passou.** Os testes são mocks/verificações estruturais e não provam semântica PostgreSQL sob concorrência. Se a RPC não existir em modo atômico, a operação deverá falhar; isso é intencional.
