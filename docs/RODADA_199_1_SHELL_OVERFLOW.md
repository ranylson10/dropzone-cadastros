# R199.1 — correção estrutural de overflow do shell desktop

## Causa
O desktop usa sidebar fixa de 232px. O `<main>` autenticado recebia ao mesmo tempo `width: 100%` de regras globais e `margin-left: 232px` do shell. Resultado: 1280px + 232px = 1512px de largura total.

## Correção
O shell autenticado agora ocupa explicitamente apenas o espaço restante: `calc(100% - 232px)`, com `min-width: 0` e `box-sizing: border-box`.

O marketplace mantém seu header horizontal e recebe reset explícito para `width: 100%`/`max-width: none`, evitando regressão em `/campeonatos`.

## Validação
- auditoria estática do contrato do shell;
- perfis de Equipe, Jogador, Produtora e Manager em desktop/mobile;
- `/campeonatos` validado para não herdar a largura descontada da sidebar.
