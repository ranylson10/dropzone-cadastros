# Rodada 83 — Alertas inteligentes

## Objetivo

Transformar os avisos simples da Central do Campeonato em prioridades operacionais acionáveis, calculadas em tempo real e sem persistir notificações duplicadas.

## Implementação

- gravidades `critical`, `warning` e `info`;
- título, problema, contexto, ação recomendada e atalho por alerta;
- ordenação automática por gravidade;
- resumo numérico por nível;
- alertas para vagas, estrutura inicial, grupos, jogos, escalações, inscrições, pagamentos, resultados e regulamento;
- escalada de gravidade quando um jogo ou prazo está próximo;
- estado positivo quando nenhuma pendência acionável é encontrada.

## Segurança e compatibilidade

- leitura somente para owner, manager ou seller já autorizados;
- sem migration;
- sem gravação automática na tabela de notificações;
- campos opcionais e relações legadas continuam tratados com fallback seguro;
- a fonte oficial de vagas permanece `campeonato_configuracoes.numero_vagas`.

## Cobertura

O teste `tests-e2e/controlled/alertas-inteligentes-central.spec.ts` valida o contrato completo dos alertas: gravidade, identificação, mensagem, contexto, ação e atalho autorizado.
