# Rodada 86A — Alertas inteligentes: ciclo operacional

## Objetivo

Transformar os alertas calculados da Central do Campeonato em itens operacionais rastreáveis, sem executar correções automáticas ou ações destrutivas.

## Entregas

- estado persistente por campeonato e chave do alerta;
- estados `new`, `read`, `resolved` e `dismissed`;
- filtros para ativos, novos, lidos, encerrados e todos;
- ações de marcar como lido, resolver, dispensar e reabrir;
- observação opcional ao resolver ou dispensar;
- identificação do usuário responsável e datas operacionais;
- acesso exclusivo do backend por service role;
- nenhuma ação automática sobre equipes, vagas, grupos, jogos, pagamentos ou resultados.

## Banco

Migration: `20260731_campeonato_alertas_inteligentes_estados.sql`.

Após aplicar a migration, o inventário publicado deve ser atualizado antes da auditoria completa.

## Validação desta subrodada

Executar `npm run typecheck`, `npm run build` e `npm run audit:dropzone:full:orchestrated`. A suíte `npm run testar:tudo` permanece reservada para o fechamento da Rodada 86.
