# Rodada 85B — Hotfix de autenticação da estrutura avançada

## Ajuste

A rota `/api/campeonatos/[id]/estrutura-avancada` agora normaliza ausência ou invalidade do token Bearer como HTTP 401 antes de consultar permissões ou dados do campeonato.

## Escopo

- nenhuma alteração de banco;
- nenhuma alteração de regras de autorização;
- visitantes continuam bloqueados;
- usuários autenticados sem vínculo continuam recebendo HTTP 403.
