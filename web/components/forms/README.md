# Formulários reutilizáveis

Formulários de cadastro usados em mais de uma página ficam aqui.

- `campeonato/`: criação e edição de campeonatos.
- `equipe/`: criação e edição de equipes.
- `jogador/`: cadastro e edição de jogador.
- `produtora/`: cadastro e edição de produtora.

Um formulário não deve conter regras de permissão nem consultas diretas ao Supabase. Ele recebe dados por propriedades e chama um serviço ou callback.
