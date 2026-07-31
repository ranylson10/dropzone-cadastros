# Rodada 85B — APIs e painel de estruturas avançadas

## Entrega

- API autenticada por campeonato em `/api/campeonatos/[id]/estrutura-avancada`.
- Leitura consolidada de franquia, edição, divisões, etapas, origens, progressões, premiações e horários de Diário.
- Escritas restritas a owner/manager com permissão de gerenciamento.
- Nova aba **Estrutura avançada** no painel da produtora.
- Administração de edições, Séries C/B/A, qualificatórias, pontos corridos, lotes de venda, origens de equipes, promoções, eliminações, premiações, MVP e horários independentes.
- Compatibilidade total com campeonatos antigos: nenhuma edição avançada é criada automaticamente.

## Segurança

- Service Role somente no servidor.
- Visitante recebe 401.
- Usuário sem gerenciamento recebe 403 nas mutações.
- Exclusão limitada a uma lista explícita de tabelas da Rodada 85A.

## Banco

Sem nova migration. Esta rodada utiliza exclusivamente as tabelas publicadas na Rodada 85A.
