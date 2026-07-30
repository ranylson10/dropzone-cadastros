# Rodada 45 — Operações reais controladas

Esta rodada inicia os testes E2E que gravam dados reais de forma temporária e fazem limpeza automática no bloco `finally`.

## Cobertura

- usa a sessão autenticada da produtora;
- cria um campeonato temporário pela API real `/api/dropzone`;
- confirma o ID e o nome retornados;
- abre a página real `/campeonatos/[id]` como proprietária;
- confirma que a página carrega o campeonato sem erro 5xx;
- arquiva o campeonato automaticamente, mesmo quando uma verificação intermediária falha.

Todos os registros usam o prefixo `[E2E] Campeonato controlado` para facilitar rastreamento. O teste não aprova, publica, cobra ou inscreve equipes.

## Comandos

```bat
set E2E_BASE_URL=https://dropzone-cadastros.vercel.app
npm run test:e2e:auth:prepare
npm run test:e2e:controlled
npm run test:e2e:all
```
