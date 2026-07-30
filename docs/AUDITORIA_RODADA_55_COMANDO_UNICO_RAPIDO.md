# Rodada 55 — Comando único mais rápido e diagnóstico automático

- Remove a repetição de TypeScript e build dentro da auditoria, pois essas etapas já são executadas pelo orquestrador.
- Não força mais `CI=1`, permitindo ao Playwright usar o paralelismo normal da máquina.
- Mantém a varredura até o fim mesmo com falhas.
- Quando a auditoria falhar, imprime no próprio terminal os títulos, detalhes e recomendações de cada erro.
- O único comando continua sendo `npm run testar:tudo`.
