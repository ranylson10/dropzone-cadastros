# Rodada 87F — Fases e tabelas competitivas

## Objetivo

Corrigir a leitura do nome das fases e simplificar as tabelas de classificação e MVP para exibir somente as métricas operacionais aprovadas.

## Alterações

- nome da fase com contraste claro no cabeçalho grafite;
- tabela geral com posição, equipe, grupo, quedas, booyah, abates e pontos;
- grupo exibido apenas pelo código final, como A, B ou C;
- remoção das colunas separadas de pontos de posição e pontos de abates;
- MVP com posição, jogador, quedas, K.D e abates;
- K.D calculado por `abates / quedas`;
- remoção visual de tipo, dano, assistências e revives;
- serviço de estatísticas passa a preservar `grupo_id` na agregação.

## Regras preservadas

- cálculos e persistência de pontuação não foram alterados;
- filtros por fase, grupo, rodada, jogo, queda e mapa permanecem disponíveis;
- pontuador e importação de MatchResult não foram alterados;
- nenhuma distribuição automática foi adicionada.

## Validação sugerida

```bat
npm run typecheck
npm run build
```

Após publicação, validar visualmente a tabela geral e a aba MVP.
