# R199 — Workspace compartilhado

Objetivo: remover a arquitetura paralela de navegação dos painéis de Produtora, Equipe, Jogador e Manager.

## Componentes canônicos

- `WorkspaceShell`
- `WorkspaceHeader`
- `WorkspaceNav`
- `WorkspaceSubnav`
- `WorkspaceContent`

Todos ficam em `web/components/workspace/` e compartilham `web/styles/workspace.css`.

## Migrações desta rodada

- Produtora: navegação principal e subnavegações Financeiro/Equipe.
- Equipe: cabeçalho, navegação principal e subnavegações Elenco/Mais.
- Jogador: cabeçalho e navegação principal.
- Manager: cabeçalho, navegação de contextos, Perfil e acesso à Carteira.

As regras de negócio e dados dos painéis não foram movidas nesta rodada. O objetivo é centralizar a arquitetura visual e de navegação antes de decompor os grandes painéis em módulos menores.
