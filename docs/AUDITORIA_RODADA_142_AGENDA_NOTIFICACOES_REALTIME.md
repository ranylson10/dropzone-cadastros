# Rodada 142 — Agenda, notificações e Realtime seguro

## Objetivo

Melhorar o uso diário do DropZone Web sem misturar captura técnica do DPZ Live Engine com o site. A rodada concentra agenda, notificações e atualização automática da interface.

## Decisões

- Notificações passam a usar **Supabase Realtime Broadcast em canal privado** como sinal de invalidação.
- O Broadcast não envia título, corpo, payload nem registro completo. Envia somente `id` e `operation`.
- O navegador continua lendo o conteúdo de notificações por `/api/notificacoes`, mantendo autorização e regras de negócio no backend.
- Não foi adotado `postgres_changes` e a tabela `public.notificacoes` não ganhou policy de leitura para o navegador.
- O cliente mantém polling de fallback e atualização ao recuperar foco/visibilidade, então a UX continua funcional se o WebSocket estiver indisponível.
- A agenda pessoal passa a destacar os próximos compromissos antes da visualização mensal e atualiza automaticamente.
- Agendas contextuais (campeonato/equipe e embeds compactos) usam sequência de datas com eventos, sem expor dias vazios.

## Supabase

A migration `20260924153000_notificacoes_realtime_privado.sql` cria:

1. trigger em `public.notificacoes`;
2. chamada `realtime.send` para `user:<auth.uid>:notifications`;
3. policy `SELECT` em `realtime.messages` limitada ao tópico do próprio usuário e à extensão `broadcast`.

Não existe policy de envio pelo cliente.

## Compatibilidade

- As ações de aceitar/recusar/arquivar continuam nas APIs existentes.
- O sistema não captura SPEC, HP, derrubados ou qualquer dado bruto de partida no site.
- Nenhuma nova dependência JavaScript foi adicionada; a implementação usa `@supabase/supabase-js`, já presente no projeto.
