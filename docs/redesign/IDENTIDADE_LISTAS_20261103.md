# Identidade compartilhada e listas — 03/11/2026

Esta revisão corrige páginas com paleta própria, subabas de campeonatos ilegíveis e diferenças de densidade entre as listas.

## Causas encontradas

- `globals.css`, `system.css` e folhas de páginas redefiniam a mesma paleta, incluindo versões azul e roxa. Alguns componentes também usavam cores literais.
- O ranking tinha uma folha própria, sem consumir completamente a identidade atual.
- Em `championship-profile.css`, seletores de avatar alcançavam **todos os spans** das linhas de equipes e jogadores. Isso pintava nomes, descrições e contadores com o fundo escuro dos avatares.
- Os diretórios preservavam áreas de grid antigas no mobile, criando linhas vazias mesmo depois de reduzir a altura mínima.
- Lili e administração não usavam a mesma estrutura de navegação das demais páginas.

## Contrato atual

`web/styles/dropzone-identity.css` é o proprietário da paleta. As páginas consomem suas variáveis; aliases locais podem representar uma função do componente, mas não criar outra paleta.

`AppShell` fornece a estrutura compartilhada. Login e callback usam a mesma base com cabeçalho desativado; a Lili embutida mantém o chat sem duplicar a navegação. Pontuador, controle de transmissão e saída OBS têm três exceções explícitas de composição.

O contrato de listas usa `data-dz-list` e `data-dz-list-item`, já presentes em `DataList`. Diretórios, ranking e listas dos campeonatos foram integrados a esse contrato. `data-dz-list="legacy"` adapta 40 contêineres existentes em 15 arquivos; o inventário está em `list-adapters.json`. Tabelas da aplicação recebem a mesma alternância, com exclusões para renderizadores de transmissão e conteúdo com cor própria.

- Superfícies alternadas: `#fffef9` e `#e9e7df`.
- Altura mínima de linha: 54 px; conteúdos com mais informação podem crescer.
- Avatares dos diretórios e ranking: 32 px.
- Posição do ranking: 16 px; pontuação: 17 px.
- Textos secundários mais escuros para manter contraste sobre ambas as faixas.
- Controles de navegação e fechamento preservam áreas de toque de pelo menos 44 px.

As quatro abas de campeonatos cabem na largura do celular. Os filtros de estatísticas usam `Dialog`, com isolamento do fundo, foco, fechamento por Escape e restauração do foco. Equipes, jogadores, classificação, MVP e campeão usam as superfícies e fontes compartilhadas.

## Prevenção de regressões

`npm run audit:theme-contract` verifica o proprietário da paleta, aliases de componentes, ordem de importação e referências à estrutura compartilhada nas 43 fontes de páginas. Também rejeita a regra ampla que tratava spans de texto como avatares. Esse comando foi incluído no workflow de qualidade.

Os testes R20 e R23 foram atualizados para os requisitos atuais: manager usa os contextos normais, o menu público é um diálogo e a identidade Circuito substitui a folha mobile antiga. R21, R22 e R24 continuam sendo executados.

## Validação e alcance

Build, TypeScript, lint, contratos R20–R24 e delegação passaram. Os 42 cenários E2E de desktop e mobile passaram. A varredura pública registrou 61 estados de 22 rotas, sem azul legado, estouro horizontal ou baixo contraste nas áreas medidas.

Os ajustes finais de densidade do ranking e seleção dos filtros foram novamente conferidos em quatro cenários E2E e 19 estados de navegador, registrados em `identity-details/report.json`, também sem ocorrências.

O relatório `identity-final/report.json` registra a varredura em 1440 e 390 px, incluindo filtros e modais. Requisições de escrita são bloqueadas durante essa varredura. As verificações de cor azul/roxa são heurísticas; gráficos e cores semânticas explicitamente marcados são tratados separadamente. Contraste automatizado é verificado em superfícies planas das abas de campeonatos e diálogos, sem substituir uma certificação completa de acessibilidade.

Os cenários E2E usam o catálogo público e respostas controladas para contas, permissões e estatísticas preenchidas. Abrangem navegação e teclado, delegação, formulários, nove visões administrativas, listas compactas, filtros, MVP e campeão. As telas autenticadas não foram percorridas com todas as combinações possíveis de dados reais. A varredura anônima também pode alcançar login em rotas protegidas.

Comandos de reprodução:

```powershell
npm run audit:theme-contract
npm run test:workspace-delegation
npm run typecheck
npm run lint
npm run build
node scripts/design/audit-identity.mjs --url=http://localhost:3001 --output=docs/redesign/identity-final --strict
$env:E2E_BASE_URL='http://localhost:3001'
npx playwright test tests-e2e/controlled/circuito-theme-contract.spec.ts tests-e2e/controlled/circuito-navigation-delegation.spec.ts tests-e2e/controlled/home-categories-account.spec.ts tests-e2e/public/rodada-24-mobile-ux.spec.ts --workers=2
```
