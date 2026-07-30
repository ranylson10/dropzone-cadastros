# Rodada 56 — Exibir erros reais da auditoria no comando único

Corrige o orquestrador para chamar automaticamente `printAuditFailures()` quando a etapa **Auditoria completa** reprovar.

O comando `npm run testar:tudo` continua executando todas as etapas até o fim e agora mostra, no próprio CMD, os quatro erros com área, título, detalhes e recomendação.
