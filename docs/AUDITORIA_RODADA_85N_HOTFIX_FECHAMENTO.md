# Rodada 85N — hotfix de fechamento

## Objetivo

Corrigir as três falhas restantes do Playwright completo da Rodada 85 sem alterar as regras operacionais aprovadas.

## Correções

- A listagem administrativa da Central do Campeonato deixa de falhar quando a consulta complementar de participações encontra incompatibilidade de schema ou erro isolado.
- A busca de equipes participantes possui fallback para `auth_user_id` em bancos que ainda não disponham de `dono_auth_user_id`.
- O painel da Estrutura Avançada volta a expor o título contratual `Progressão automática`.
- Foram preservados os contratos `Gerar prévia`, `Aplicar progressão` e `Já aplicada`.
- Nenhuma distribuição automática de grupo ou slot foi introduzida.
- Nenhuma migration foi necessária.

## Validação esperada

Executar `npm run testar:tudo` e confirmar o encerramento com todas as etapas aprovadas.
