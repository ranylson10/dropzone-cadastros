# R191 — Campeonatos, página por página

Escopo desta rodada: **somente o módulo Campeonatos**. Nenhuma outra área é considerada concluída por esta entrega.

## Páginas públicas revisadas

- `/campeonatos` — catálogo e venda de vagas.
- `/campeonatos/[id]` — detalhe público.
- `/campeonatos/[id]/regulamento` — regulamento publicado.
- `/campeonatos/[id]/stream` — handoff para DropZone Live Local.
- `/campeonatos/[id]/pontuador/[jogoId]` — pontuador operacional.
- `/central-campeonato` — central operacional autenticada.

## Subáreas internas revisadas no painel da produtora

- Visão do campeonato.
- Criação/edição do campeonato.
- Equipes, inscrições, vagas e slots.
- Jogadores.
- Fases, grupos e estrutura.
- Estrutura avançada e progressão.
- Jogos, mapas e quedas.
- Classificação, MVP e estatísticas.
- Calls / XTreino.
- Regulamento.
- Exportação / SPEC.
- Stream e pacote de transmissão.

## Correções específicas após o E2E R190

- O catálogo agora força `champ-market-intro` visível e ocupa largura útil real.
- O teste do detalhe usa o link real existente dentro do card; a R190 procurava `a.directory-champ-card`, mas o card é um `article`.
- Removido `networkidle` do teste de navegação; páginas com Supabase/realtime não devem depender de rede totalmente ociosa para serem consideradas prontas.
- O teste desta rodada roda em modo serial para não derrubar o servidor local com dezenas de páginas simultâneas.
- Pontuador recebe superfície clara e rolagem apenas dentro das tabelas largas.
- Todos os workspaces internos de campeonato recebem largura total, cabeçalhos identificáveis e contenção de overflow.

## Teste

```cmd
npx playwright test tests-e2e/controlled/rodada-191-campeonatos-page-by-page.spec.ts --project=chromium-desktop --project=chromium-mobile --workers=1
```

A próxima rodada só deve começar depois de este módulo ser validado visualmente.
