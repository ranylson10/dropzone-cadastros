# Rodada 81 — Correções de vagas e notificações

## Objetivo

Corrigir dois problemas operacionais identificados após a Fundação da Central do Campeonato.

## Alterações

- A capacidade da Central agora reutiliza `getCampeonatoCapacidade`, que considera somente os slots da fase de entrada (menor ordem).
- O catálogo público de vagas ignora grupos de fases posteriores, pois essas fases recebem equipes classificadas e não novas inscrições.
- Ao abrir o correio, avisos comuns não lidos são marcados como lidos e deixam de contar no badge.
- Convites e solicitações acionáveis permanecem pendentes até aceitar ou recusar, evitando perder ações importantes.
- Foi adicionada a ação “Marcar avisos como lidos”.
- A interface atualiza imediatamente o contador ao marcar uma notificação individual.

## Segurança

- Nenhuma tabela ou migration foi criada.
- A leitura continua limitada ao próprio usuário.
- A atualização em massa não altera convites e solicitações acionáveis por padrão.
- O teste não modifica notificações reais.

## Validação obrigatória

```bat
npm run testar:tudo
```

A rodada só termina com `Resultado: TUDO APROVADO.`
