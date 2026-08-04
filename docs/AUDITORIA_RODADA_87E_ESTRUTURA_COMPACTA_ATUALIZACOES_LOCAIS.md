# Rodada 87E — Estrutura compacta e atualizações locais

## Objetivo
Reduzir o excesso visual das áreas de fases, grupos, slots e jogos, preservando as regras operacionais já aprovadas.

## Alterações
- removido o botão individual **Editar letra** de cada slot;
- a sequência de letras permanece configurável no formulário do grupo;
- slots ocupam uma única linha compacta;
- removido o verde como identidade dos slots ocupados;
- aplicado padrão cinza médio, grafite e dourado;
- fases, grupos e jogos passam a compartilhar a mesma linguagem visual;
- ações pequenas recarregam os dados silenciosamente, sem substituir toda a área por uma tela de carregamento;
- nenhuma distribuição automática foi adicionada.

## Arquivos
- `web/features/campeonatos/fases/components/CampeonatoEstruturaTab.tsx`
- `web/app/globals.css`
- `tests-e2e/controlled/rodada-87e-estrutura-compacta-atualizacoes-locais.spec.ts`

## Validação esperada
- `npm run typecheck`
- `npm run build`
- validação visual antes da suíte completa.
