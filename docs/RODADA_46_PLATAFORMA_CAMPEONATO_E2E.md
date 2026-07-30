# Rodada 46 — Plataforma válida no campeonato E2E

O teste controlado enviava `plataforma: "Mobile"`, mas o banco aceita os valores normalizados em minúsculas (`mobile`, `emulador` ou `misto`).

A rodada altera somente o payload do teste para `plataforma: "mobile"`.

Nenhuma regra do sistema, migration ou dado real foi alterado.
