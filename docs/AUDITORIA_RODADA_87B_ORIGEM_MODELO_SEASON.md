# Rodada 87B — Origem, modelo e nova season

## Objetivo

Corrigir a lógica inicial do assistente de criação para que a produtora escolha, antes de preencher identidade e operação, se deseja criar do zero, usar um campeonato anterior como modelo independente ou criar uma nova season ligada ao histórico da mesma competição.

## Entregas

- primeira etapa chamada **Origem**;
- pesquisa limitada aos campeonatos da própria produtora e do mesmo tipo selecionado;
- cópia dos campos compatíveis para edição antes do salvamento;
- modo modelo sem vínculo histórico;
- modo season com vínculo pela mesma franquia/competição;
- criação automática da franquia histórica quando o campeonato anterior ainda não possui edição registrada;
- sugestão da próxima edição e do título público;
- páginas do assistente variam conforme o tipo;
- Diário e Copa não recebem a etapa genérica de formato;
- Liga mantém a etapa própria para a estrutura competitiva avançada;
- X-Treino e Confronto mantêm apenas seus formatos específicos;
- nenhuma distribuição automática de grupos ou slots.

## Arquivos alterados

- `web/components/forms/campeonato/CampeonatoForm.tsx`
- `web/features/dropzone/DropZoneHome.tsx`
- `web/features/dropzone/panels/produtora/ProdutoraPanel.tsx`
- `web/app/api/campeonatos/[id]/estrutura-avancada/route.ts`
- `web/app/globals.css`
- `tests-e2e/controlled/rodada-87b-origem-modelo-season.spec.ts`

## Validação esperada

1. `npm run typecheck`
2. `npm run build`
3. validação visual do fluxo de origem;
4. somente após aprovação visual, executar a suíte oficial completa no fechamento da rodada.
