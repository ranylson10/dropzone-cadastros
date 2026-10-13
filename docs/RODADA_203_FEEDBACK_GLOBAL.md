# R203 — Ações e feedback globais

Objetivo: retirar confirmações/prompts nativos e impedir que cada módulo mantenha sua própria infraestrutura de modal.

## Fundação
- `Dialog` é o primitive oficial de modal, com portal, Escape, restauração de foco, focus loop e lock de scroll.
- `SystemModal` continua compatível, mas agora é apenas um adapter para `Dialog`.
- `FeedbackProvider` é montado uma única vez no layout raiz.
- `confirmAction`, `promptAction` e `noticeAction` usam uma fila global, portanto chamadas simultâneas não se atropelam.
- `StatusMessage` é a base oficial para feedback inline novo.

## Migração
As 53 chamadas de `window.confirm` / `window.prompt` existentes foram migradas em 22 módulos. Nenhuma página deve voltar a chamar diálogo nativo diretamente.

## Regra
Qualquer confirmação, prompt ou aviso novo deve usar `@/components/feedback`. Conteúdo complexo continua podendo usar `SystemModal`, que já compartilha o mesmo primitive `Dialog`.
