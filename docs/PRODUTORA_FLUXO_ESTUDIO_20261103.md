# Operação da produtora — fluxo do DPZ Planilha

Referência local consultada, sem modificar o projeto: `E:/garena-live-studio-api`. Usados os cadastros de `apps/local-sheet/ui/app.js`, seletores de `game-fields.js`, Pontuador e os documentos das versões 0.6, 0.9, 0.10, 0.11 e 0.12.

## Fluxo adaptado ao site

- Uma navegação de campeonato: Resumo, Fases e grupos, Equipes, Elencos, Jogos e quedas, Pontuador, Tabelas e Inscrições. Removida a segunda camada por áreas.
- Criação rápida: dados essenciais → pontuação → confirmação. Conservados nome/logo obrigatórios, tipos de competição, aprovação e cobrança do site, modelos e temporadas do assistente completo.
- Equipes utiliza o gerenciador autorizado de vagas, cadastros em bloco, convites e movimentação, conforme a permissão. Os IDs de participação/line não são substituídos pelo nome da equipe.
- Jogos aceitam até 48 quedas, mapas repetidos e seleção/limpeza de todos os grupos da fase. Trocar a fase limpa os grupos de outra fase.
- Inscrição, elenco e transferências; temporadas, divisões e progressão; regulamento e regras da final ficam em Regras avançadas. No jogo, prazos e classificação ficam recolhidos. Mantidos os vínculos e a transferência posterior para perfis de usuários.
- Pontuador dentro do painel, com seleção de fase/jogo e abas de queda. A rota dedicada reutiliza o mesmo componente. Mantidos MatchResult, Garena, temporários, FALT, finalização e reabertura existentes do site.
- Pontuação personalizada de até 24 posições, incluindo zero pontos por abate. A tabela oficial permanece com suas 12 posições.
- Lançamento manual envia apenas equipes alteradas e jogadores explicitamente preenchidos. Preserva dano, assistências e revives já existentes. Recusa equipe fora do jogo, posição repetida, FALT e estatísticas inválidas antes da escrita.
- Trocas de queda, jogo, ferramenta e seção da produtora conferem rascunhos pendentes; gravação em andamento bloqueia a troca de jogo/área. A proteção de saída do navegador também está ativa. Isso não substitui uma transação ou controle de concorrência entre operadores.
- Estilos antigos do pontuador retirados; aparência controlada pela identidade central do site. No celular, as linhas priorizam equipe, colocação, abates e pontos; penalidades podem ser abertas nas opções avançadas.

## Cálculo no banco

A migração `20261104000719_producer_scoring_consistency.sql` substitui dois cálculos conflitantes por um único gatilho. Fórmula: colocação + abates × valor por abate da queda/campeonato × multiplicador − punição. Punições são persistidas como valores negativos. Atualização somente da punição também recalcula. Alterar explicitamente as regras do campeonato recalcula seus resultados, preservando ausências FALT.

A migração foi aplicada ao Supabase. Sua instalação não executa reprocessamento global de resultados antigos. As funções usam os privilégios do chamador; não foi acrescentado SECURITY DEFINER nem alterado o modelo de autorização das APIs.

A fixture `node scripts/testes/producer-scoring-fixture.mjs` emite SQL de validação com tabelas temporárias, asserts e ROLLBACK. Foi executada antes e depois da aplicação: pontuação normal, dobro, valor específico da queda, punição, alteração só da punição, zero por abate, recálculo de regras, preservação de FALT e isolamento entre campeonatos. Nenhuma partida real foi usada como teste. Advisors de segurança permaneceram com o mesmo conjunto informativo de 84 tabelas com RLS sem policies, compatível com o acesso atual por backend autorizado.

## Limites da adaptação

Não houve cópia de campeonatos, arquivos, credenciais ou banco SQLite do aplicativo local. Captura do Engine, backups de disco, rede local e janelas do Electron continuam pertencendo ao aplicativo. O site conserva os próprios serviços de importação, classificação, final e inscrição; não foram substituídos por uma segunda base local.

As mutações manuais existentes ainda envolvem mais de uma gravação no backend; esta revisão não certifica atomicidade entre operadores concorrentes. Os testes de interface usam contas e respostas controladas; não representam homologação de uma competição real.

## Verificação desta alteração

- Build completo de produção, TypeScript, lint web/backend e contrato da identidade aprovados.
- Suíte `test:security` aprovada, incluindo a nova regressão da produtora.
- 26 cenários de experiência em build de produção aprovados (desktop e mobile); os seis cenários do novo estúdio foram repetidos no build final, incluindo proteção ao abrir configurações e trocar de seção.
- Fixture PostgreSQL temporária executada antes e depois da migração; confirmados o único gatilho de cálculo e as funções sem SECURITY DEFINER. O arquivo local foi alinhado à versão registrada pelo Supabase.
- A rodada exploratória em desenvolvimento teve uma falha de espera pelo card da home e um clique interceptado pelo Next DevTools; a suíte de produção passou nos 26 cenários.
