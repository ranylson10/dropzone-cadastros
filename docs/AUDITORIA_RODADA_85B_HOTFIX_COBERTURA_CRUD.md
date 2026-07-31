# Rodada 85B — Hotfix de cobertura CRUD

## Objetivo

Eliminar o aviso da auditoria para a família `api/campeonatos/[id]/estrutura-avancada`.

## Ajustes

- `POST` permanece responsável pelas criações.
- `PATCH` passa a representar a atualização da edição/franquia.
- `DELETE` passa a representar as exclusões controladas.
- A interface escolhe o método HTTP de acordo com a ação executada.
- A validação de autenticação, autorização, escopo e tabelas permitidas continua centralizada no mesmo fluxo protegido.

## Banco

Nenhuma migration ou SQL adicional.
