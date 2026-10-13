# R198 — Entidades compartilhadas

Objetivo: parar de desenhar Equipe, Jogador, Produtora e Manager como implementações independentes quando o contexto visual é o mesmo.

## Componentes canônicos

- `EntityAvatar`: imagem/fallback único para entidades.
- `EntityListRow`: linha oficial de diretório para Equipe, Jogador, Produtora e Manager.
- `EntityProfileHero`: hero oficial de perfil público das quatro entidades.

## Adoção

As listas continuam entrando por `DirectoryPage`, mas agora `DirectoryListClient` delega cada linha ao `EntityListRow`. Os quatro perfis continuam entrando por `DirectoryProfilePage`, mas o cabeçalho visual foi extraído para `EntityProfileHero`.

As classes antigas essenciais foram preservadas dentro dos componentes canônicos para manter compatibilidade durante a migração e impedir quebra de CSS/regra de negócio. O novo namespace `dz-entity-*` passa a ser a API visual oficial.

## Próximo passo

R199: fundação única de workspace/painel para Produtora, Equipe, Jogador e Manager, removendo navegações e shells paralelos.
