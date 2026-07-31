# Rodada 85G — escolha manual de grupo e slot na Central

## Objetivo

Permitir que a equipe escolha, pela Central do Campeonato, um grupo e um slot específicos liberados pela administração. Nenhuma distribuição automática é executada.

## Entregas

- Campeonatos vinculados às equipes aparecem na Central como participação.
- Participantes recebem apenas a interface de escolha, sem acesso ao resumo administrativo.
- Grupo e slot precisam ser escolhidos explicitamente.
- O backend reserva somente o slot informado e rejeita disputa concorrente.
- O administrador também passa a selecionar o slot específico na estrutura avançada.
- Trocas continuam obedecendo a configuração da fase e são registradas no histórico criado na 85F.

## Banco

Nenhuma migration nova. A rodada reutiliza as tabelas da 85F.

## Validação provisória

Executar apenas `npm run typecheck` e `npm run build`. A suíte completa permanece reservada para o fechamento da Rodada 85.
