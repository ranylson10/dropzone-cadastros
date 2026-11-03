# R19 — Homologação executável em laboratório separado

**Estado:** executor e atalhos Windows entregues; **a execução nativa do PostgreSQL, o build completo e o E2E autenticado continuam sem evidência neste ambiente**. Nenhuma migração foi aplicada ao Supabase de produção.

## Por que esta rodada é diferente

R13–R18 deixaram explícitas as dependências externas. A R19 cria a **execução real, sob ação do operador**, dos testes que antes exigiam copiar vários comandos manuais. O atalho não considera os resultados simulados como prova de concorrência no banco atual.

## 1. PostgreSQL 17 com Docker Desktop (teste nativo)

Pré-requisitos: Windows com Node.js 22+ e Docker Desktop ligado; arquivo **original** `dropzone-cadastros-ENVIO.zip` disponível localmente. Não utilizar o ZIP R19 como catálogo.

1. Extraia o ZIP completo R19 em pasta local.
2. Clique em `HOMOLOGAR_POSTGRES_R19.bat` ou arraste o ZIP **original** sobre ele.
3. Confirme a criação do laboratório sintético na mensagem de segurança.
4. O executor importa **somente** `relatorios-testes/banco-publicado.json`, verifica o daemon Docker local e cria um contêiner `postgres:17.6` com a rede desligada (`--network none`). Nunca publica portas nem usa a URL do Supabase.
5. Reconstrói o catálogo de 11/10/2026, cria um banco novo `dropzone_validation_r19_*` e executa `validate-native.mjs` com PostgreSQL real, chaves de repetição, constraints e transações concorrentes.
6. O relatório completo fica em `relatorios-testes/r19-laboratorio-*.json` e **não é distribuído**. Resultado esperado de sucesso parcial: `TESTES_NATIVOS_APROVADOS_EM_FIXTURE`. Esse resultado **não** significa pronto para publicação.

Segurança: o executor recusa daemon Docker remoto (`tcp`, `ssh` e contextos inesperados); recusa reutilizar contêiner com o nome reservado; verifica identidade, imagem e rede; não apaga nem sobrescreve volumes ou contêineres e não herda URLs/chaves do banco de produção. O ambiente local pode consumir imagem do Docker Hub na primeira execução.

Para repetição, **depois de salvar os relatórios**, confira manualmente o nome e a identidade do contêiner e remova **somente** o ambiente sintético dedicado pelo Docker Desktop. O executor nunca faz essa limpeza automaticamente.

Comando apenas para ver o plano, **sem executar Docker**: `node scripts/release/round19-laboratorio.mjs`.

## 2. Next.js — validação de build

`HOMOLOGAR_WEB_R19.bat` instala as dependências declaradas em `package-lock.json` usando `npm ci --no-audit` e roda `typecheck`, `lint` e `build` integral. Limpa variáveis usuais de banco de produção e define parâmetros públicos fictícios. É necessário acesso ao registro npm. Falhas de fetch, ambiente ou prerender são exibidas como falhas, não como aprovação. Esse atalho não executa E2E autenticado.

Para fluxos autenticados e pagamentos é obrigatório **staging isolado**, com contas e dados fictícios; não configurar credenciais administrativas de produção para testar telas.

## 3. Testes de contrato e gate

`TESTAR_RODADA_19.bat`, `npm run test:round19`, `npm run test:rounds` e `npm run release:readiness` permanecem disponíveis. O gate agora inclui R17, R18, R19 e fingerprint dos lançadores `.bat/.ps1`. Evidência de catálogo histórico ou sucesso do laboratório sintético nunca libera produção automaticamente. Migrations R09–R11, ACLs/owners reais, índices de reinscrição e rollback em staging continuam pendentes.

## Limites e próximos critérios

- Provar que o **schema atual** do Supabase em staging corresponde às funções candidatas e migrar em homologação, nunca direto em produção.
- Executar teste concorrente nativo **com as candidatas R09–R11 e todos os escritores**, além do candidato inicial que `validate-native` exercita. O fluxo R19 principal testa somente as candidatas de inscrição carregadas por `fresh-validation.mjs`.
- Comprovar rollback num banco isolado adicional e E2E autenticado com serviço web compilado.
- Fazer avaliação humana dos relatórios de homologação antes de qualquer publicação.

O atalho web chama `round19-web-check.mjs`, que filtra credenciais do ambiente do processo e registra `r19-web-evidence.json` com o resultado real das etapas. Você pode inspecionar o plano sem execução usando `node scripts/release/round19-web-check.mjs`.
