# Rodada 87N — diretório público, notificações e resíduos E2E

## Correções

- Diretórios públicos deixaram de limitar a consulta aos 500 registros mais recentes.
- Status, aprovação e exclusão lógica são normalizados antes da publicação.
- O correio ganhou a ação **Arquivar lidas**.
- Foi criado um SQL manual e restrito ao marcador `[E2E]` para limpar resíduos antigos.

## Segurança da limpeza

O SQL não usa `TRUNCATE` e não remove equipes ou jogadores reais. Ele:

1. arquiva notificações que contêm `[E2E]`;
2. remove inscrições temporárias cujo nome começa com `[E2E]`;
3. exclui logicamente campeonatos cujo nome começa com `[E2E]`;
4. retorna contagens para conferência.

## Validação

```bat
npm run typecheck
npm run build
npx playwright test tests-e2e/controlled/rodada-87n-diretorio-notificacoes-residuos.spec.ts --project=chromium-desktop
```
