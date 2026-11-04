# DropZone R27 — Painel da produtora por módulos

Base: R26 atualizada a partir do ZIP do Codex. **Não executa migrations nem altera backend, autenticação, permissões ou pagamentos.**

## Mudanças no desktop

- Lista esquerda organizada em **Criar e escolher**, **Filtros** e **Campeonatos** (com contador).
- Direita com módulos independentes: **Campeonato ativo**, **Números do campeonato**, **Áreas de gestão**, **Ferramentas**, **Conteúdo da seção**.
- As quatro métricas são cartões com números grandes e rótulos menores.
- Ferramentas agrupadas em **Ações rápidas** (Pontuador e inscrições, dependendo das permissões) e **Regras e ajustes**.
- Checklist de organização em caixa própria, com progresso visual das etapas iniciadas. Não trata o progresso como aprovação/resultado final.
- Separadores, cores grafite/terracota, tipografia condensada Circuito, estados de seleção e densidade alinhados.

## Comportamento preservado

- Campeonatos selecionados na esquerda; conteúdo do ativo à direita.
- Ações de editar, excluir, criar, filtrar e gerir usam os mesmos callbacks.
- Pontuador abre `/campeonatos/{id}/pontuador` em nova aba com `noopener,noreferrer`.
- Permissões `canAdminWorkspace`, `canOperateWorkspace`, `canScoreWorkspace` permanecem em seus pontos originais; o CTA de regras de pontuação somente é renderizado para admin.
- Nenhuma cópia de action buttons no checklist.
- Celular: seletor de campeonato, navegação horizontal rolável e métricas em duas colunas.

## Testes

`TESTAR_RODADA_27.bat` executa teste R27 e regressões R26/R20/R22/R24. Depois executar `npm run typecheck` e `npm run build` no Windows. Teste de interface autenticada em produção ou ambiente de homologação ainda é necessário.

## Arquivos tocados

- `web/features/dropzone/panels/produtora/ProdutoraPanel.tsx`
- `web/styles/dropzone-identity.css`
- `scripts/testes/test-r27-produtora-hierarchy.mjs`
- `TESTAR_RODADA_27.bat`
- este documento e `MANIFESTO_R27.json`.
