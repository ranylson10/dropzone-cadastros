# R03 — Baseline histórico antes da queda atual

## Resultado

O Site agora expõe uma única rota autenticada para responder qual era o estado competitivo consolidado imediatamente antes de uma queda. O cálculo oficial de pontos, kills e booyahs não foi duplicado: o serviço resolve os IDs das quedas anteriores e delega aos agregadores existentes.

Nenhuma tabela, view, RPC ou migration foi criada.

## Endpoint

```http
GET /api/desktop/campeonatos/{campeonato_id}/baseline?jogo_id={jogo_id}&partida_id={partida_id_atual}
Authorization: Bearer <access_token>
```

Parâmetros obrigatórios:

- `campeonato_id`: segmento da rota;
- `jogo_id`: jogo que contém a queda;
- `partida_id`: identificador real da queda atual.

A rota usa `getBearerUser`, `getCampeonatoPermission` e o mesmo predicado `canUseLocalStudio` de `/api/desktop/campeonatos/{id}/estatisticas`. Perfis sem permissão recebem HTTP 403. Nenhuma chave Supabase ou `service_role` é aceita do cliente.

## Corte competitivo

`carregarBaselineAntesPartida` consulta `campeonato_partidas_com_mapa` pelo campeonato e jogo e localiza a queda atual pelo ID. O corte usa `numero_partida`, nunca texto ou nome:

```text
partida.numero_partida < partida_atual.numero_partida
AND partida.status = 'finalizada'
```

O status `finalizada` é o critério já usado pelo fluxo de finalização e pela publicação de estatísticas. O domínio atual admite `agendada`, `em_andamento`, `finalizada` e `cancelada`; portanto quedas atuais, futuras e canceladas ficam fora. Não existe coluna/regra separada de descarte ou anulação no modelo auditado.

Para Q4, `baseline_ate_queda` é 3 e `partidas_incluidas` contém somente os IDs finalizados anteriores. Para Q1, a lista é vazia e o DTO ainda devolve o roster do jogo com estatísticas zero.

## Fontes oficiais reutilizadas

- `listarEstatisticasEquipes(campeonatoId, { partidaIds })`: pontos, kills, booyahs e classificação oficial;
- `listarEstatisticasMvp(campeonatoId, { partidaIds })`: kills, dano, assistências e revives oficiais por participação;
- `carregarRosterPontuadorJogo`: slots e jogadores do mesmo contrato já usado pelo pontuador, enriquecendo `slot_id` pela participação canônica em `campeonato_equipes`;
- `garena_matchstats_importacoes` e `garena_matchstats_jogadores`: detalhes já persistidos de imports concluídos.

`carregarRosterPontuadorJogo` foi extraído do bootstrap existente e o próprio `carregarPontuadorJogo` passou a reutilizá-lo. O payload do pontuador não mudou.

## DTO versionado

```json
{
  "version": 1,
  "context": {
    "campeonato_id": "camp-uuid",
    "fase_id": "fase-uuid",
    "jogo_id": "jogo-uuid",
    "partida_id_atual": "q4-uuid",
    "numero_queda_atual": 4,
    "baseline_ate_queda": 3,
    "partidas_incluidas": ["q1-uuid", "q2-uuid", "q3-uuid"],
    "quantidade_partidas_incluidas": 3
  },
  "teams": [
    {
      "campeonato_equipe_id": "ce-uuid",
      "slot_id": "slot-uuid",
      "slot_numero": 1,
      "equipe_id": "equipe-uuid",
      "team_id_externo": null,
      "nome": "Alpha",
      "tag": "ALP",
      "logo_url": "https://...",
      "grupo_id": "grupo-uuid",
      "grupo_nome": "Grupo A",
      "drops": 3,
      "points": 42,
      "kills": 17,
      "booyahs": 1,
      "damage": 6200,
      "assists": 19
    }
  ],
  "players": [
    {
      "campeonato_jogador_id": "cj-uuid",
      "campeonato_equipe_id": "ce-uuid",
      "jogador_id": "jogador-uuid",
      "jogador_temporario_id": null,
      "player_id": "123456789",
      "nick": "PLAYER",
      "slot_jogador": 1,
      "equipe_nome": "Alpha",
      "slot_id": "slot-uuid",
      "slot_numero": 1,
      "foto_url": "https://...",
      "drops": 3,
      "kills": 8,
      "damage": 2500,
      "assists": 7,
      "headshots": 4,
      "knockdowns": 9,
      "survival_time": 2100,
      "distance_traveled": 14400,
      "max_kill_distance": 120,
      "revives": 2,
      "revived_members": 2,
      "rescued_members": 1,
      "medkits_used": 10,
      "gloo_destroyed": 6
    }
  ]
}
```

## Identidades

- Equipes são indexadas por `campeonato_equipe_id`.
- Jogadores são agregados e indexados exclusivamente por `campeonato_jogador_id`.
- `equipe_id`, `jogador_id` e `player_id` são metadados auxiliares.
- O mesmo `player_id` em `campeonato_jogador_id` diferentes gera linhas distintas.
- Nenhum dado do fallback `/jogadores` participa do baseline.
- Roster ou MatchStats sem `campeonato_jogador_id`/`campeonato_equipe_id` faz a operação falhar explicitamente.

## Regras de agregação

| Campo DTO | Fonte | Regra |
|---|---|---|
| `teams.points` | `listarEstatisticasEquipes.pontos_total` | Valor oficial direto; nenhuma fórmula nova. |
| `teams.kills` | `listarEstatisticasEquipes.abates` | Soma oficial existente. |
| `teams.booyahs` | `listarEstatisticasEquipes.booyahs` | Contagem oficial existente. |
| `teams.damage`, `teams.assists` | Totais oficiais dos jogadores da participação | SUM por `campeonato_equipe_id`. |
| `players.kills`, `damage`, `assists`, `revives` | `listarEstatisticasMvp` | Totais oficiais existentes por `campeonato_jogador_id`. |
| `headshots`, `knockdowns`, `survival_time`, `distance_traveled`, `revived_members`, `rescued_members`, `medkits_used`, `gloo_destroyed` | MatchStats concluído | SUM. |
| `max_kill_distance` | MatchStats concluído | MAX. |

Taxas, médias e percentuais ficaram fora do DTO para evitar soma semanticamente incorreta. Armas, habilidades e loadout também ficaram fora da R03.

## Arquivos

- `PROJECT_CONTEXT.md`
- `backend/src/campeonatos/estatisticas/baseline-rules.ts`
- `backend/src/campeonatos/estatisticas/baseline.service.ts`
- `backend/src/campeonatos/pontuador/pontuador.service.ts`
- `backend/src/campeonatos/campeonato-permissions.ts`
- `web/app/api/desktop/campeonatos/[id]/baseline/route.ts`
- `web/app/api/desktop/campeonatos/[id]/estatisticas/route.ts`
- `scripts/testes/test-baseline-r03.mjs`
- `scripts/testes/test-baseline-schema-r03.mjs`
- `docs/DPZ_INTEGRACAO_R03_BASELINE.md`
- `package.json`

## Testes

`npm run test:baseline` cobre:

- Q4 inclui Q1–Q3 e exclui Q4/Q5;
- Q1 retorna corte histórico vazio;
- duas participações A/EA e B/EB com `player_id = 123` permanecem separadas;
- estatísticas somáveis usam SUM;
- `max_kill_distance` de 80, 120 e 95 retorna 120;
- `points` é copiado diretamente de `pontos_total` oficial.

`npm run test:baseline:schema` valida, contra o Supabase configurado no ambiente local, os campos realmente consumidos das views do pontuador, da participação canônica e dos imports MatchStats.

A validação completa desta rodada também executa `npm run typecheck`, `npm run lint` e o build de produção.

## Limitações

- Campos detalhados ficam zero quando não existe import MatchStats concluído para as quedas incluídas; pontos e estatísticas oficiais básicas continuam disponíveis.
- O schema auditado não possui `team_id` externo normalizado. O campo fica `null` quando a view de roster não o fornecer.
- Mais de um import MatchStats concluído para uma mesma queda seria agregado. O fluxo atual usa `match_id` único e atualiza o mesmo import em ressincronizações.
- O endpoint é leitura dinâmica e não implementa cache/SQLite nesta rodada.
