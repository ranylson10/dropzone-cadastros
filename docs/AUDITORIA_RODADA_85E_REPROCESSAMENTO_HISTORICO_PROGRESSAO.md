# Rodada 85E — Reprocessamento seguro e histórico da progressão

## Entrega

- prévia com identificação de conflitos no destino;
- bloqueio padrão de substituições involuntárias;
- substituição controlada com preservação do vínculo anterior;
- registro de execução, usuário, data, regra, fase e snapshots;
- histórico dos itens promovidos ou substituídos;
- reversão que restaura origem e destino ao estado anterior;
- reprocessamento idempotente sem duplicar equipe na etapa;
- painel com histórico e motivo de reversão.

## Segurança

As novas tabelas têm RLS habilitado e são acessadas exclusivamente pela rota administrativa após autenticação e autorização no campeonato.
