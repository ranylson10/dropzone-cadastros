# Rodada 67 — Timeout e repetição controlada da API E2E

- Aumenta o timeout das criações em `/api/dropzone` de 12 para 30 segundos.
- Repete somente a criação que sofrer timeout, no máximo 3 vezes.
- Aplica espera progressiva curta entre tentativas.
- Não altera APIs, banco, migrations ou regras de negócio.
- Mantém o comando único `npm run testar:tudo`.
