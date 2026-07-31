# Rodada 84 — Logs operacionais completos

## Objetivo

Adicionar à Central do Campeonato um histórico operacional rastreável e somente leitura, preservando autorização por campeonato e sem duplicar eventos no banco.

## Implementação

A API da Central consolida eventos reais já registrados nas fontes oficiais do sistema:

- criação do campeonato;
- fases e grupos;
- ocupação de slots;
- inscrições de equipes;
- escalações de jogadores;
- jogos e quedas;
- resultados;
- pagamentos;
- publicação do regulamento;
- ações administrativas existentes em `sistema_auditoria`.

Os eventos são normalizados com categoria, ação, título, detalhe, data, ator operacional e tabela de origem. A resposta é ordenada do mais recente para o mais antigo e limitada aos 120 eventos mais recentes para preservar desempenho.

## Segurança

- o histórico somente é retornado após `getCampeonatoPermission`;
- apenas owner, manager ou seller com `canView` acessam o resumo;
- nenhuma rota pública nova foi criada;
- nenhum log revela token, e-mail, senha ou conteúdo sensível;
- não há escrita adicional nem duplicação de auditoria nesta rodada.

## Interface

A Central recebeu a seção “Logs operacionais”, com filtros por categoria e apresentação responsiva para desktop e mobile.

## Arquivos alterados

- `web/app/api/central-campeonato/route.ts`
- `web/components/campeonatos/ChampionshipCentral.tsx`
- `web/app/globals.css`
- `tests-e2e/controlled/logs-operacionais-central.spec.ts`
- `docs/AUDITORIA_RODADA_84_LOGS_OPERACIONAIS_COMPLETOS.md`
