# Rodada 71 — Lili: menu público e centrais privadas seguras

## Cobertura adicionada

- rejeição de mensagem vazia;
- abertura pública do menu da Lili;
- ações rápidas e idioma da resposta;
- bloqueio das centrais privadas sem autenticação;
- listagem de campeonatos da produtora;
- listagem e detalhe de equipe controlada;
- bloqueio de acesso a equipe não controlada;
- listagem e detalhe do próprio perfil de jogador;
- bloqueio de acesso a perfil de jogador de outra identidade;
- menu autenticado da equipe.

## Segurança

O teste é somente leitura. Nenhum campeonato, equipe, jogador, inscrição,
saldo ou mensagem persistente é criado ou alterado.

## Execução

Use apenas:

`npm run testar:tudo`

O total esperado passa de 66 para 68 testes, considerando desktop e mobile.
