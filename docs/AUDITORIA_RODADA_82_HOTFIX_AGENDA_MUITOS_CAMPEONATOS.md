# Rodada 82 — Hotfix da agenda com muitos campeonatos

## Problema reproduzido

O teste controlado da agenda conseguia criar um evento temporário, mas a leitura seguinte de `scope=me` retornava HTTP 400.

A agenda pessoal reúne jogos de todos os campeonatos relacionados ao usuário. Em perfis de produtora com histórico grande, o filtro PostgREST `in(campeonato_id, ...)` podia carregar UUIDs demais em uma única URL.

## Correção

- a consulta de jogos foi dividida em blocos de 50 campeonatos;
- os resultados continuam filtrados pelo mesmo intervalo e pelos mesmos estados;
- a ordenação cronológica final foi preservada;
- nenhuma regra de autorização, visibilidade ou edição foi alterada;
- nenhuma migration foi necessária.

## Validação exigida

Executar o comando oficial:

```bat
npm run testar:tudo
```

Resultado esperado:

```text
90 passed
Resultado: TUDO APROVADO.
```
