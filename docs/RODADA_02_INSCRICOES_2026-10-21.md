# Rodada 02 — inscrições, vagas e reinscrição (21/10/2026)

## Resultado

**Correção de código preparada e testada estaticamente. NÃO foi aplicada no Supabase de produção, nem ativada por flags.** Parte dos scripts SQL são candidatos já existentes no projeto; R02 revisa pontos específicos sem assumir que o conjunto de fluxos antigos está seguro.

### Falha R02-A — unicidade cruzada ativo/pendente

O candidato `docs/sql/20261011_rejoin_index_candidate.sql` removia o índice global de campeonato/line, mantendo dois índices únicos independentes para `ativo` e `pendente`. Isso deixaria passar **uma linha ativa e outra pendente da mesma line no mesmo campeonato**. Corrigido preparando um terceiro índice único, `campeonato_equipes_line_aberta_unique`, com predicado único `status in ('ativo','pendente')`. Ele é criado e validado **antes** de retirar o índice legado, na mesma transação com lock. Registros `removido`/`rejeitado` deixam de bloquear futuras inscrições. Os índices individuais existentes são preservados para não modificar contratos fora do escopo.

### Falha R02-B — seleção de slot com reserva

O candidato `docs/sql/20261011_atomic_enrollment_candidate.sql` escolhia `campeonato_slots` exigindo apenas `equipe_id` e `line_id` nulos, sem validar `status`. Um link de grupo poderia receber um slot `reservado` por convite ou Lili. A seleção agora:

- aceita um slot `livre` para inscrições comuns;
- aceita `reservado` somente para convite de equipe vinculado explicitamente ao mesmo slot, sem convite ativo concorrente;
- recusa qualquer reserva ativa da Lili, mesmo que o status do slot esteja desatualizado;
- **reconfere reservas em nova consulta após adquirir o lock do slot** para reduzir a janela de espera/concorrência;
- mantém o mecanismo de recibo/idempotência e demais verificações de permissão, prazo e grupo já existentes.

**Limite:** isso protege o candidato atômico, não todos os escritores legados. O gatilho de espelho DBR01 também continua pendente de implantação; writers de escolha-grupo, Lili, pagamentos e movimentação precisam participar da mesma disciplina de locks. Não ativar atomic sem validação integrada.

### Pré-verificação e reversão

- `docs/sql/20261021_round2_readonly_preflight.sql`: só leitura; aponta índices atuais, divergências e reservas.
- `docs/sql/20261021_rejoin_rollback_candidate.sql`: rollback *apenas do índice R02*; recusa reversão se já houver histórico com a mesma line reinscrita. Não apaga nem altera linhas históricas.
- `docs/sql/20261011_enrollment_rollback_candidate.sql`: **obsoleto nesta revisão** por incluir hashes de versões anteriores; não executar. É necessário regenerar em laboratório a partir do `prepare-rollback.mjs` e revisar os fingerprints.

### Testes

| Verificação | Resultado |
|---|---|
| 6 verificações estruturais / modelo (`node scripts/testes/test-round2-guards.mjs`) | **PASSOU** |
| Sintaxe dos scripts JS alterados (`node --check`) | **PASSOU** |
| Cenários nativos para `ativo` vs `pendente`, rejoin, Lili, convite reservado | **ADICIONADOS; NÃO EXECUTADOS** |
| Validação da estrutura atual no Supabase por SQL `SELECT` | **PASSOU** (14 ativas, zero pendentes, zero reservas, sem conflitos) |
| Testes TypeScript/Next.js, build, integração e testes PostgreSQL nativos | **BLOQUEADOS** neste ambiente: dependências npm/PostgreSQL indisponíveis; registry npm sem resolução DNS |
| Mudanças remotas / migrations / flags / Vercel / GitHub | **NENHUMA** |

### Critérios para a R03 (não executar em produção sem os itens)

1. Backup real e restauração comprovada num ambiente separado, esquema/ACL atualizados.
2. Aplicar e validar **em staging** os SQLs candidatos dependentes, com rollback documentado; comparar definições atuais, triggers e owners.
3. Reexecutar `validate-native.mjs`, testes de participação e movimentação com sessões PostgreSQL concorrentes (não apenas mocks); atenção à ordem dos locks, estados reservados e pagamentos em sandbox.
4. Inventariar escritores legados e direcionar/graduar flags sem fallback para escrita antiga em caso de 503.
5. Obter autorização explícita para deployment da migração, realizar janela controlada e conferir SQL read-only após aplicação.

## Comandos Windows

- Após descompactar o projeto, rode `TESTAR_RODADA_02.bat` para os testes estruturais sem dependências.
- Com Node.js e dependências (`npm ci`) instaladas, `npm run test:security`, `npm run typecheck`, `npm run lint`, `npm run build`.
- As suítes nativas do PostgreSQL estão em `scripts/testes/postgres-inscricoes/README.md`, exigem o laboratório e banco de homologação, **nunca produção**.

## Estado de entrega

Cópia R01 preservada. Arquivos da R02 alterados isoladamente. O banco DropZone ativo **permanece sem alterações**.
