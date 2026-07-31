# Rodada 86B — regras e prioridades dos Alertas Inteligentes

## Objetivo
Tornar os alertas da Central do Campeonato mais acionáveis, previsíveis e fáceis de priorizar, sem executar correções automáticas.

## Entregas
- Classificação por categoria: vagas, estrutura, programação, escalação, inscrições, pagamentos, resultados e regulamento.
- Escopo explícito por campeonato, equipe ou jogo.
- Pontuação de prioridade combinando severidade e proximidade de prazo.
- Ordenação por estado, prioridade, severidade e título.
- Deduplicação por chave estável antes da apresentação.
- Conteúdo dinâmico atualizado a cada leitura quando a situação melhora ou piora.
- Exibição de impacto e ação recomendada.
- Identificação visual de categoria, escopo e prazo.
- Nenhuma distribuição automática ou correção destrutiva.

## Banco
Sem migration nova. A rodada reutiliza `campeonato_alerta_estados` para o ciclo operacional persistente.

## Validação rápida
```bat
npm run typecheck
npm run build
npm run audit:dropzone:full:orchestrated
```
