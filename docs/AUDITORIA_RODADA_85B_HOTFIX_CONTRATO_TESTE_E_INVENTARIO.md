# Rodada 85B — Hotfix do contrato E2E e atualização do inventário

## Correção do teste

A API `GET /api/central-campeonato` retorna a lista autorizada em `items`.
O teste da estrutura avançada usava incorretamente `campeonatos`, causando falha mesmo com a API respondendo corretamente.

Correção aplicada:

```ts
const championship = centralBody?.items?.[0]
```

## Inventário publicado

A auditoria compara o código com o arquivo local `relatorios-testes/banco-publicado.json`.
Após a migration da Rodada 85A, esse inventário precisa ser regenerado executando:

`database/auditoria/rodada_2_inventario_banco.sql`

no Supabase SQL Editor e substituindo o conteúdo de:

`relatorios-testes/banco-publicado.json`

pelo valor JSON retornado na coluna `inventario`.

O arquivo é um artefato local de auditoria e não deve ser commitado.
