# Rodada 85L — Histórico e logs operacionais das escolhas

## Entrega

- Linha do tempo de confirmação, movimentação/troca, cancelamento e restauração.
- Identificação da equipe/line, origem e responsável pela ação.
- Exibição de fase, grupo e slot anteriores e novos.
- Motivo ou observação operacional preservado.
- Filtros por equipe, ação, fase, grupo e período.
- Exportação CSV dos registros filtrados.
- Consulta ampliada para até 500 registros recentes.
- Nenhuma distribuição automática e nenhuma migration nova.

## Validação prevista

```bat
npm run typecheck
npm run build
npm run audit:dropzone:full:orchestrated
```

A suíte `npm run testar:tudo` permanece reservada ao fechamento da Rodada 85.
