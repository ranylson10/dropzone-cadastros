# Rodada 86E — Hotfix dos alertas por jogo e equipe

## Correção

A revisão final detectou que os contratos E2E da Rodada 86C estavam presentes, mas as regras detalhadas ainda não tinham sido incorporadas à rota da Central do Campeonato.

O hotfix adiciona:

- prazo específico de escalação por jogo usando `limite_escalacao_minutos`;
- alerta individual de escalação incompleta por equipe e jogo;
- alerta de jogo sem grupos vinculados;
- alerta de mapas incompletos conforme a quantidade de quedas;
- alerta de resultados pendentes depois do horário programado;
- alerta individual de equipe sem grupo ou slot;
- `entity_id` e `entity_label` para identificação operacional;
- chaves estáveis por jogo e equipe para impedir duplicação.

Nenhuma distribuição automática foi adicionada.
