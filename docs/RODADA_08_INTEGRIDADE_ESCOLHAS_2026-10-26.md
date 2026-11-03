# Rodada 08 — integridade nas escolhas de grupo e slot

## Objetivo
Reduzir divergências entre as ações legadas da equipe e da administração sem mudar payloads/contratos de API, diante de migrações atômicas ainda não homologadas no PostgreSQL.

## Falhas observadas no código da R07
1. `assign_group_manual` (admin) podia atribuir slot de fase divergente, mesmo quando o grupo pertencia ao campeonato.
2. `assign_group_manual`/`restore_group_choice_admin` não revalidavam bloqueios administrativos, reservas Lili ou convites válidos.
3. `restore_group_choice_admin` não confirmava que o grupo e o slot ainda correspondiam à fase histórica.
4. `cancel_group_choice_admin` limpava o espelho sem confirmar sua fase, equipe/line e status ocupado.
5. As três ações não exigiam explicitamente que a participação lida estivesse ativa.

## Alterações
- Extração da política de elegibilidade para `backend/src/campeonatos/legacy-slot-eligibility.ts`, reutilizada pelos fluxos de equipe e administração.
- Pré-verificação de fase, grupo, participação ativa e espelho antes da primeira escrita nas ações administrativas de escolha, restauração e cancelamento.
- Os transportes `tryAtomicGroupChoice` são consultados **antes** das verificações legadas. Não acrescentamos leituras/escritas ao caminho atômico.
- `docs/sql/20261026_round8_choice_readonly.sql`: diagnóstico sem operações de escrita; os resultados são candidatos a revisão, não comandos de reparo.
- 29 cenários HTTP com cliente Supabase simulado, incluindo rejeições e caminhos normais.

## Limites / bloqueios para produção
- **NÃO é uma transação atômica**: a validação e a ocupação do slot continuam em chamadas separadas no modo `legacy`.
- Testes locais não reproduzem transações concorrentes reais, triggers, timeouts, crash após primeira gravação nem rollback PostgreSQL.
- Há outros escritores legados no projeto, inclusive estrutura avançada e inscrição, que ainda requerem implantação coordenada das funções SQL atômicas; não ativar `SLOT_MOVEMENT_MODE=atomic` sem instalar e testar dependências.
- A aplicação no Supabase e o deploy do Next.js **não foram executados** nesta rodada.
- O script de diagnóstico não divulga IDs individuais de jogadores, equipes ou contas; mostra apenas contagens.

## Testes
`npm run test:rounds` ou `TESTAR_RODADA_08.bat`; opcional `TESTAR_RODADA_08.bat --build` para typecheck, lint e build com dependências instaladas.

## Próxima etapa sugerida
Homologar a função `fn_escolher_grupo_atomico` e as migrations dependentes em um banco isolado, com cenários de concorrência (duas equipes, mesmo slot; cancelamento vs reserva; falha na escrita de histórico); só depois implementar o corte coordenado da flag de gravação e remover o fluxo legado.
