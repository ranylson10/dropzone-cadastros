# Rodada 50 — Line existente e timeout seguro no E2E

## Diagnóstico

O endpoint de inscrição recusou corretamente a participação porque cada vaga exige uma line. O teste enviava equipe, campeonato e slot, mas não enviava `line_id` nem `nome_line`.

Criar uma nova line durante o teste deixaria um registro permanente. Por isso, esta rodada consulta as lines já existentes da equipe autenticada e usa uma line ativa.

## Alterações

- consulta `team_line` com a sessão real da equipe;
- seleciona uma line ativa pertencente ao perfil E2E;
- envia `line_id` na inscrição `championship_team`;
- não cria line temporária nem deixa dados permanentes;
- aumenta o timeout do cenário controlado para 90 segundos, permitindo a limpeza completa mesmo sob carga da Vercel.

## Segurança

O campeonato, fase, grupo, slot e participação continuam sendo removidos/arquivados no bloco `finally`.
