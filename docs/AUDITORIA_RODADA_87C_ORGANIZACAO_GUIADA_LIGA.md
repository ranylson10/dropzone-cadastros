# Rodada 87C — Organização guiada de ligas

## Objetivo

Separar definitivamente a estrutura avançada de Liga dos demais tipos de campeonato e permitir que a produtora defina nomes próprios para séries, divisões, categorias ou níveis durante a criação.

## Alterações

- Liga pode ser simples, em pontos corridos, ou organizada por agrupamentos.
- O agrupamento não usa mais o nome fixo “Séries”.
- Opções iniciais: Séries, Divisões, Categorias, Níveis, Conferências e Circuitos.
- Também é possível informar um nome personalizado.
- Cada item possui nome, código opcional e ordem.
- Os dados ficam salvos no campeonato e são preservados ao editar ou copiar como modelo/season.
- Diário permanece jogo único.
- Copa permanece mata-mata.
- X-Treino mantém somente seus três formatos próprios.
- Confronto mantém somente seus modos próprios.
- Nenhuma equipe é distribuída automaticamente.

## Escopo futuro

Datas de venda, período competitivo, fases, promoção, rebaixamento e criação das divisões no banco serão tratados na Rodada 87D.

## Validação esperada

```bat
npm run typecheck
npm run build
```

A suíte completa fica reservada para o encerramento da Rodada 87.
