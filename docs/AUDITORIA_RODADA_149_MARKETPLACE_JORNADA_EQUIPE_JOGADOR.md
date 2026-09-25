# Rodada 149 — Marketplace + jornada de Equipe/Jogador

## Objetivo

Conectar a descoberta pública de campeonatos ao acompanhamento privado de quem realmente participa. A navegação deixa de terminar na compra e passa a orientar o usuário por uma jornada contínua: descobrir campeonato, garantir vaga, concluir a entrada da equipe, montar escalação, acompanhar agenda e consultar resultados/estatísticas.

## Marketplace

- O diretório de campeonatos passa a se apresentar explicitamente como Marketplace DropZone.
- O usuário pode abrir o catálogo diretamente em vagas disponíveis (`?vagas=1`) ou em suas competições (`?meus=1`).
- A ordenação permite priorizar próximos jogos, maior número de vagas, maior premiação ou menor preço.
- Usuários autenticados têm seu estado real carregado por `/api/me/competicoes`.
- Quando já existe participação, o CTA muda para **Acompanhar**.
- Quando há uma compra ainda não vinculada/concluída, o CTA muda para **Concluir entrada**.
- O fluxo normal de comprar vaga, inscrição gratuita, carrinho e favoritos permanece preservado.

## Jornada privada

A nova rota `GET /api/me/competicoes` agrega somente dados relacionados ao usuário autenticado:

- equipes que ele controla e respectivas participações/escalações;
- participações do perfil de jogador;
- compras de vagas do próprio `auth_user_id`;
- dados mínimos do campeonato e configuração comercial;
- links diretos para agenda, resultados e detalhe público.

Reservas `pendente` já expiradas não são retornadas como compra ativa. A rota não lê captura SPEC, estado ao vivo nem tabelas do DPZ Live Engine.

## Equipe

A área **Competições** passa a funcionar como jornada:

1. Vaga confirmada;
2. Escalação e quantidade de jogadores;
3. Agenda/próximo jogo;
4. Resultados, classificação e MVP.

Compras que ainda precisam ser finalizadas aparecem antes da lista de competições com ação **Concluir entrada**.

## Jogador

O painel passa a ter cinco áreas principais: **Início · Competições · Equipe · Desempenho · Perfil**.

Em **Competições**, cada campeonato mostra equipe/line, grupo ou fase, próximo compromisso e atalhos diretos para agenda, resultados e página pública do campeonato. O jogador não precisa navegar pelas ferramentas operacionais da produtora.

## Mobile

- A navegação principal do jogador é horizontal quando necessário.
- Jornadas de equipe e jogador usam trilhas horizontais roláveis em telas pequenas.
- As ações finais permanecem em botões separados e tocáveis.
- A jornada pública de cinco etapas também usa rolagem horizontal no mobile.

## Banco

Nenhuma migration nova foi necessária nesta rodada. A R149 reutiliza `campeonato_escalacoes_resumo`, `campeonato_jogadores`, `sistema_compras_vaga`, `campeonatos` e `campeonato_configuracoes` por meio do backend autenticado.

## Separação do Live Engine

A R149 não altera nem substitui os contratos do DPZ Live Engine. HP, derrubado/morto, SPEC e captura em tempo real continuam fora do Marketplace e dos painéis Web.
