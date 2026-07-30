# Rodada 58 — Estrutura, jogo e quedas controladas

## Objetivo

Ampliar o comando único `npm run testar:tudo` com um fluxo real e autolimpante do núcleo de campeonato.

## Cobertura adicionada

- criação de campeonato temporário;
- aprovação administrativa como cortesia;
- criação de fase e grupo;
- leitura do catálogo real de mapas;
- criação de jogo com duas quedas;
- vínculo do jogo ao grupo da fase;
- validação da listagem de jogos;
- validação da sequência das quedas;
- alteração real do mapa da primeira queda;
- exclusão definitiva do jogo temporário;
- remoção de grupo e fase;
- arquivamento do campeonato no bloco de limpeza.

## Segurança

O cenário usa nomes com prefixo `[E2E]` e executa a limpeza em ordem inversa dentro de `finally`, inclusive quando alguma validação falha.

## Execução

```bat
npm run testar:tudo
```

O arquivo está dentro de `tests-e2e/controlled`, portanto o comando único o detecta automaticamente. O total esperado passa de 48 para 50 testes, considerando desktop e mobile.
