# Rodada 87I — Fontes corretas das overlays

## Objetivo

Separar corretamente os dados gerais dos dados específicos do jogo, mapa e partida usados no editor de overlays.

## Correções

- **Equipes · Jogo** passa a listar somente os slots ocupados do jogo selecionado/ativo, com slot, logo, equipe e grupo.
- **Equipes · Partida** usa somente o resultado da queda selecionada e expõe posição, logo, equipe, kills, pontos de posição, pontos de kills e pontos totais.
- **Equipes · Mapa** usa o jogo ativo e, sem escolha manual, resolve o próximo mapa da sequência.
- Equipes que pertencem ao jogo continuam aparecendo no mapa mesmo antes de receber pontuação, com estatísticas zeradas.
- Foi criada a aba **Jogadores · Mapa**.
- O MVP foi separado em:
  - **MVP · Partida**
  - **MVP · Dia**
  - **MVP · Geral**
- Overlays antigas vinculadas à aba `mvp` continuam apontando para **MVP · Geral**.
- Tabelas vinculadas às novas abas de jogadores/MVP mantêm o modo visual de lista MVP.

## Contexto automático

Quando o operador não escolhe um filtro manual, as fontes específicas usam o jogo ativo configurado no pack da transmissão. Para partida e mapa, a sequência do pontuador é usada para encontrar a queda atual e a próxima.

## Validação rápida

```bat
npm run typecheck
npm run build
```

## Validação visual

1. Escolher um jogo e abrir **Equipes · Jogo**.
2. Confirmar que aparecem apenas as equipes desse jogo.
3. Escolher uma queda e abrir **Equipes · Partida**.
4. Confirmar que os valores são exclusivos da queda.
5. Abrir **Equipes · Mapa** e confirmar o próximo mapa.
6. Conferir **Jogadores · Mapa**, **MVP · Partida**, **MVP · Dia** e **MVP · Geral**.
