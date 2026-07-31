# Rodada 81 — Hotfix de autorização do manager na Central

## Sintoma

A suíte publicada chegou a 87/90 testes aprovados. A produtora passou no desktop, mas o manager continuou recebendo resposta não satisfatória em `/api/central-campeonato`; houve ainda uma falha intermitente da listagem no projeto mobile.

## Causa corrigida

A resolução de permissão dependia de `maybeSingle()` para o perfil manager e varria todos os campeonatos, consultando a permissão individualmente. Isso tornava a listagem sensível a mais de um perfil manager ligado ao mesmo login e criava muitas consultas concorrentes durante os testes desktop/mobile.

## Alterações

- `getCampeonatoPermission` aceita todos os perfis manager ativos do login e procura vínculos em lote.
- Vínculos de produtora, vendedor e token legado são resolvidos com `manager_id in (...)`.
- A Central monta primeiro a lista de campeonatos candidatos por propriedade ou vínculo.
- A permissão completa é validada somente nos candidatos, reduzindo consultas e mantendo a autorização por entidade.
- Nenhuma tabela, migration, RLS ou payload público novo foi criado.

## Resultado esperado

- visitante: 401;
- produtora dona: 200;
- manager autorizado: 200, mesmo sem campeonatos visíveis (lista vazia válida);
- usuário sem vínculo: não recebe campeonato protegido;
- comportamento consistente em desktop e mobile.
