# Rodada 87D — Identidade visual e simplificação do painel da produtora

## Objetivo

Unificar a linguagem visual do painel da produtora, reduzir o excesso de branco e texto, compactar filtros e ações, e priorizar a operação principal sem alterar regras de negócio.

## Direção aplicada

- fundo cinza médio no painel;
- superfícies cinza-claro com contraste real;
- dourado como ação e seleção;
- grafite em cabeçalhos e navegação;
- sombras removidas do escopo da produtora;
- bordas simples e retas;
- listas contínuas, sem cartões separados por espaços;
- ações de editar/excluir reduzidas a ícones com título existente;
- abas e filtros compactos e horizontais;
- textos auxiliares repetitivos ocultados em cabeçalhos operacionais;
- tabela com cabeçalho grafite e linhas alternadas.

## Regras preservadas

- nenhuma regra de campeonato foi alterada;
- nenhuma distribuição automática foi criada;
- nenhuma rota, tabela ou migration foi modificada;
- rolagem isolada da lista de campeonatos foi preservada;
- comportamento mobile permanece responsivo.

## Arquivos

- `web/app/globals.css`
- `tests-e2e/controlled/rodada-87d-identidade-visual-produtora.spec.ts`
- `docs/AUDITORIA_RODADA_87D_IDENTIDADE_VISUAL_PRODUTORA.md`

## Validação indicada

1. `npm run typecheck`
2. `npm run build`
3. publicar e revisar visualmente o painel da produtora
4. executar a suíte completa somente no fechamento da rodada 87
