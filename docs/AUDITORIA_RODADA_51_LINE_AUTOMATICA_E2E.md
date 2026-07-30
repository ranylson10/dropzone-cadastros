# Rodada 51 — Line automática no E2E

## Diagnóstico

A sessão de equipe usada pelo E2E não possui nenhuma line ativa. A consulta genérica `/api/dropzone?entity_type=team_line` também não é a rota oficial de gestão de lines da equipe.

## Ajuste

O teste agora usa a rota real `/api/equipes/[id]/lines`:

- reutiliza uma line ativa quando existir;
- cria uma line temporária com prefixo `[E2E]` quando a equipe não possuir line;
- remove a participação antes da limpeza;
- inativa automaticamente a line temporária no bloco `finally`;
- mantém o cenário com timeout de 90 segundos.

Nenhuma line permanente é deixada ativa após o teste.
