# Rodada 81 — Hotfix de estabilidade E2E remota

## Sintoma

A suíte funcional permaneceu íntegra, mas testes distintos falharam alternadamente com timeout exato de 12 segundos ao executar oito workers contra a Vercel.

## Ajuste

- limita a suíte remota a quatro workers;
- amplia apenas o `actionTimeout` remoto para 30 segundos;
- preserva 12 segundos em execução local;
- não altera contratos, permissões, rotas, dados ou expectativas funcionais;
- mantém timeout finito para continuar detectando travamentos reais.

## Justificativa

Os testes isolados passam e as falhas alternam entre rotas antigas, evidenciando contenção/cold start no ambiente remoto, e não regressão funcional determinística.
