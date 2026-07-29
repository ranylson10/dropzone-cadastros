# Rodada 14 — Vínculos do pontuador

## Alterações

A rota de vínculos do MatchResult agora permite:

- cadastrar vínculos (`POST`);
- editar nome e equipe vinculada (`PUT`);
- remover vínculo incorreto (`DELETE`).

## Segurança

Todas as operações:

- exigem usuário autenticado;
- exigem permissão de pontuação no campeonato;
- filtram por `campeonato_id` e `jogo_id`;
- validam se a equipe pertence ao campeonato;
- impedem nomes duplicados no mesmo jogo.

A exclusão remove apenas o mapeamento de nome do MatchResult, sem apagar equipes, partidas ou resultados.
