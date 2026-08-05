# Rodada 87O — Agenda responsiva e contextual

## Objetivo

Corrigir a agenda no celular e impedir que agendas públicas de campeonatos e equipes ofereçam criação de compromissos pessoais.

## Entrega

- Desktop mantém a planilha mensal completa.
- Mobile troca a tabela larga por navegação diária e linha compacta de dias.
- O dia selecionado mostra seus eventos em cartões cronológicos.
- Na agenda pessoal, horários livres continuam disponíveis para criação.
- Em campeonatos e perfis contextuais, a agenda é somente leitura.
- O modo compacto usa visual grafite, cinza e dourado compatível com o LEALT.
- Skeleton substitui a mensagem simples de carregamento.
- Cache curto de 30 segundos e deduplicação de requisições evitam buscas repetidas durante a navegação.

## Contratos preservados

- A agenda pessoal continua permitindo CRUD do próprio usuário.
- Eventos contextuais continuam filtrados pelo `scope` e `scopeId`.
- Nenhuma agenda contextual cria compromissos pessoais.
- O desktop não perde a grade mensal existente.
