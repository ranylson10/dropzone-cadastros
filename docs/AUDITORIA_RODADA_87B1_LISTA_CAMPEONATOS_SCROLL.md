# Rodada 87B.1 — Lista de campeonatos com rolagem independente

## Objetivo

Evitar que o botão **Novo campeonato** seja empurrado para o fim da página quando a produtora possui muitos campeonatos.

## Alterações

- painel lateral da produtora limitado à altura útil da janela no desktop;
- cabeçalho, filtros e ações permanecem visíveis;
- somente a lista de campeonatos possui rolagem vertical;
- rolagem da lista não continua na página ao chegar ao início ou ao fim;
- comportamento mobile permanece em fluxo normal.

## Arquivos

- `web/app/globals.css`
- `tests-e2e/controlled/rodada-87b1-lista-campeonatos-scroll.spec.ts`
