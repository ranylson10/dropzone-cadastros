# Rodada 43 — Fluxo real de criação de campeonato no E2E

O teste funcional da produtora foi ajustado para seguir as duas etapas reais do formulário:

1. abrir o modal “Novo campeonato”;
2. escolher o tipo “Diário” na etapa 1;
3. avançar automaticamente para a etapa 2;
4. localizar o botão “Criar campeonato” dentro do modal;
5. enviar o formulário vazio para validar a mensagem obrigatória;
6. preencher o nome e cancelar sem criar registro.

Nenhuma funcionalidade do sistema foi alterada. A rodada modifica apenas o teste Playwright.
