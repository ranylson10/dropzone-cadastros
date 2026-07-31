# Rodada 86D — painel administrativo, filtros e histórico dos alertas

## Entrega

- contadores por estado dos alertas;
- filtros por estado, prioridade, categoria, escopo, texto e período;
- ação em massa para marcar os alertas novos filtrados como lidos;
- exportação dos alertas filtrados em CSV;
- histórico imutável das mudanças de estado;
- identificação do responsável por UUID e e-mail da conta autenticada;
- exportação do histórico filtrado em CSV;
- limite de 200 alertas por ação em massa e 500 eventos carregados por campeonato;
- nenhuma correção automática destrutiva.

## Banco

A migration `20260731_campeonato_alertas_inteligentes_historico.sql` cria `campeonato_alerta_historico`, com RLS habilitado e acesso exclusivo por Service Role após autorização do campeonato.

## Validação esperada

- `npm run typecheck`
- `npm run build`
- `npm run audit:dropzone:full:orchestrated`

A suíte completa permanece reservada para a Rodada 86E.
