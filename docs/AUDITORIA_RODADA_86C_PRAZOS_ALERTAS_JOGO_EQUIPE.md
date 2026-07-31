# Rodada 86C — Prazos e alertas por jogo e equipe

## Objetivo

Ampliar os Alertas Inteligentes para mostrar pendências diretamente ligadas a jogos e equipes, considerando o prazo geral do campeonato e o prazo específico configurado em cada jogo.

## Implementado

- leitura de `limite_escalacao_minutos` em cada jogo;
- cálculo do prazo específico a partir da data e do horário do jogo;
- uso do prazo geral de escalação como fallback;
- alerta por equipe com escalação incompleta para o jogo;
- alerta de equipe sem grupo ou slot;
- alerta de jogo sem grupos participantes;
- alerta de jogo com mapas incompletos;
- alerta de resultados pendentes depois do horário do jogo;
- prioridade crítica para prazo vencido ou próximo;
- identificação visual da equipe ou do jogo no alerta;
- chaves estáveis para evitar duplicação;
- nenhuma correção automática e nenhuma distribuição automática.

## Arquivos alterados

- `web/app/api/central-campeonato/route.ts`
- `web/components/campeonatos/ChampionshipCentral.tsx`
- `tests-e2e/controlled/rodada-86c-prazos-alertas-jogo-equipe.spec.ts`
- `docs/AUDITORIA_RODADA_86C_PRAZOS_ALERTAS_JOGO_EQUIPE.md`

## Banco

Nenhuma migration nova. O prazo por jogo já existe em `campeonato_jogos.limite_escalacao_minutos`. O prazo geral continua sendo obtido das regras ativas do campeonato.

## Validação esperada

```bat
npm run typecheck
npm run build
npm run audit:dropzone:full:orchestrated
```

A suíte completa permanece reservada para o encerramento da Rodada 86.
