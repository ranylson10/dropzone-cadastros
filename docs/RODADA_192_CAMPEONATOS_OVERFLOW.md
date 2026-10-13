# R192 — Campeonatos: fechamento de overflow

Correção baseada no E2E real da R191.

## Falha 1 — Central do campeonato / desktop

O `<main>` autenticado recebe `margin-left: 232px` por causa da sidebar desktop. A R191 também havia forçado `width: 100%` na `.championship-central-page`, produzindo exatamente `1280 + 232 = 1512px` de largura total.

Correção: no desktop, a Central volta a `width:auto`, deixando o bloco ocupar apenas o espaço restante ao lado da sidebar. Os grids internos também passam a aceitar encolhimento (`min-width:0`).

## Falha 2 — Detalhe público / mobile

O detalhe de campeonato recebeu uma barreira responsiva explícita para impedir regras desktop antigas de manterem largura mínima no hero, ficha de informações, navegação e jornada.

Correções principais:
- hero mobile fixo em `52px + minmax(0,1fr)`;
- facts desktop ocultos no mobile;
- textos e valores longos quebram linha;
- resumo usa grid responsivo sem `min-width` legado;
- grupos de informações aceitam encolhimento;
- jornada rola apenas dentro do próprio bloco;
- painel/nav/agenda limitados a `max-width:100%`.

## Teste

`rodada-192-campeonatos-overflow.spec.ts` mantém a cobertura da R191 e, em caso de novo overflow, lista os elementos ofensores com classe, largura e posição.
