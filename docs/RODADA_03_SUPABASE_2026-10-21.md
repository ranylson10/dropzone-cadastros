# DropZone — Rodada 03: Banco e Supabase (21/10/2026)

## Entrega

R03 executada **somente como auditoria SQL remota de leitura, validação de compatibilidade e preparação de candidatos de desempenho**. **Nenhuma migration, função, política, índice ou dado de produção foi alterado.** A versão acumula as correções preparadas nas rodadas R01 e R02.

## O que foi efetivamente verificado no projeto real

| Diagnóstico | Evidência de consulta 21/10/2026 |
|---|---:|
| Tabelas `public` | 118 |
| Tabelas com RLS habilitada | 118 |
| Políticas RLS | 46 |
| Tabelas com RLS sem políticas próprias | 84 |
| Migrations aplicadas | 28 |
| Divergência de nomes entre migrations aplicadas e `supabase/migrations` | 0 |
| Slots cadastrados | 456 |
| Ocupados | 14 |
| Participações ativas | 14 |
| Slots ocupados sem participação ativa | 0 |
| Participações ativas sem espelho correto | 0 |
| Slots em grupos inválidos / fase divergente | 0 |
| Duplicatas `(campeonato_id,line_id)` entre `ativo` ou `pendente` | 0 |
| Funções SECURITY DEFINER não-trigger acessíveis a `anon`/`authenticated` | 0 |
| Buckets de Storage públicos | 7 |

Resultados provêm de consultas **somente de leitura** ao projeto Supabase principal. Não são testes de concorrência, nem validação de clientes reais.

**Diagnóstico de implantação:** `campeonato_equipes_campeonato_line_unique` permanece ativo; `campeonato_equipes_line_aberta_unique`, `inscricao_recibos` e `fn_inscrever_por_convite_atomico(...)` ainda não existem. Não ativar o modo de inscrição atômica sem validar todos os escritores e passar pelos gates abaixo.

## Alertas Supabase

Os advisors retornaram 84 tabelas sem política direta, 191 FKs sem índice de cobertura, 32 índices sem uso e uma recomendação de ajustar a alocação de conexões Auth. **A existência do alerta não prova vulnerabilidade ou lentidão.** As 84 tabelas estão com RLS habilitada; diversas são deliberadamente operadas pelo backend. Não criar políticas genéricas para eliminar avisos (abriria acesso indevido) nem apagar 32 índices sem prova.

## Arquivos da R03

- `docs/sql/20261021_round3_readonly_audit.sql`: auditoria completa com resumo JSON e sem linhas privadas, executada no banco principal com sucesso (2026-10-21 14:47 UTC).
- `docs/RODADA_03_SNAPSHOT_PUBLICO.json`: inventário agregado e lista das 28 migrations existentes (sem credenciais).
- `docs/sql/20261021_round3_index_candidates.sql`: **três sugestões opcionais** de índices, `CREATE INDEX CONCURRENTLY`; requer revisão de consultas, EXPLAIN em staging e aprovação antes de qualquer execução. São candidatas, não correções implantadas.
- `docs/sql/20261021_round3_verify_candidates.sql`: verificação somente leitura do status/definição desses índices; executada no banco principal, resultado: três ausentes, conforme esperado.
- `scripts/testes/test-round3-db-gates.mjs` e `TESTAR_RODADA_03.bat`: verificações locais das migrations, abrangência do diagnóstico, preservação de RLS e isolamento dos candidatos do pipeline de deploy.

## Sequência controlada para a migração de inscrições (ainda pendente)

1. **Gerar backup e restaurar em homologação.** Confirmar recuperação do schema, owners, extensões, triggers, ACL, linhas, políticas, recibos e índices; registrar hash/snapshot. O backup por si só, sem restauração, não basta.
2. **Congelar gravações conflitantes apenas na janela de staging.** Identificar APIs legadas de inscrição, escolha de grupo, pagamento, vendedor, Lili, bloqueio e movimentação de slots. O código atual contém operações legadas com mais de uma gravação e compensação posterior.
3. **Executar o pré-teste R02 e o diagnóstico R03.** Conferir as definições dos índices existentes e inexistência de participação/slot inconsistente. Revisar SQL candidato `slot_mirror_guard`, `rejoin_index`, `atomic_enrollment`, `participation_write`, `slot_transfer`, `group_choice` e respectivos dependentes, sem tentar executá-los na produção.
4. **Validar no banco restaurado.** Rodar os cenários PostgreSQL reais em sessões simultâneas (`scripts/testes/postgres-inscricoes`) e verificar idempotência, rollback por erro, reservas, prazo de inscrição, autorizações e comportamento das operações legadas. Não chamar os testes estruturais Node de certificação do banco.
5. **Ativar as flags de forma progressiva em staging**, sem fallback para gravação legada após erro transacional, e executar testes web/backend, worker, pagamentos sandbox, Lili e agenda.
6. **Somente após validação + aceite explícito**, agendar mudança em produção com janela e plano de reversão que preserve dados de inscrição, auditoria e recibos. Não fazer rollback destrutivo de dados históricos.

## Otimização de índices — critérios

As tabelas são pequenas no snapshot; portanto, R03 não publica os 191 índices sugeridos pelo advisor. Se consultas reais ou planos demonstrarem gargalo, revisar somente os 3 candidatos em `docs/sql/20261021_round3_index_candidates.sql` e confirmar que nenhum índice equivalente existe. `CREATE INDEX CONCURRENTLY` precisa ser executado como comando isolado; em falha pode deixar índice inválido. Executar o SQL `verify_candidates` depois, revisar `pg_stat_user_indexes` e refazer os advisors. Backups e reversão antes de implantar.

## Como verificar no Windows

1. Extraia o ZIP `DROPZONE_RODADA_03_FONTE_COMPLETA.zip` em outra pasta.
2. Execute `TESTAR_RODADA_03.bat` (requer Node.js 22+, sem `npm install` para esses testes estruturais).
3. No SQL Editor do Supabase, se quiser reproduzir as contagens, abra **somente** `docs/sql/20261021_round3_readonly_audit.sql` e execute-o. Não cole os candidatos de índice ou funções no banco de produção.

## Testes e limitações

- **7 verificações estruturais R03 passaram.** **6 verificações R02 reexecutadas e passaram.** `node --check` do novo script passou.
- A consulta R03 completa passou sobre o Supabase ativo; o verificador de índices retornou três `ausente`.
- **Não executados:** testes nativos PostgreSQL, `npm ci`, `typecheck`, lint geral, testes E2E e build integrado. Sem um ambiente isolado restaurado, não é responsável ativar as migrations de inscrição.
- **Produção:** sem alterações.

## R04

Próxima rodada planejada: revisão e correções das telas web/móvel, componentes grandes, UI da produtora/equipe/campeonatos, usabilidade e responsividade, preservando os contratos de API existentes.
