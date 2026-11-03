## Rodada 22 — painéis por perfil (redesign)

A R22 cria uma área de ações prioritárias única para produtora, equipe, jogador, manager e vendedor. Na conta de manager, **Início** e **Vendas** agora são áreas visuais separadas; convites, permissões, pagamentos e rotas de API permanecem os mesmos. Veja `docs/redesign/RODADA_22_PAINEIS_POR_PERFIL.md` e execute `TESTAR_RODADA_22.bat` no Windows.

> **Correcao pos-testes R19 (27/10/2026):** ajustado o prerender dos cinco diretorios publicos para nao consultar o Supabase durante um build com URL ficticia; teste do launcher Windows robustecido e atalho PostgreSQL com melhor tratamento do ZIP original. Rode `HOMOLOGAR_WEB_R19.bat` na versao corrigida. Detalhes: `docs/POST_TESTES_R19_CORRECAO.md`. Nao significa homologacao de producao.

> **Rodada 17:** laboratório PostgreSQL revalida identidade do contêiner antes de cada SQL e executa por ID imutável, com 26 verificações offline. Veja `docs/RODADA_17_SEGURANCA_LABORATORIO.md`. Build e PostgreSQL reais ainda pendentes.

# DropZone Platform

Plataforma de produtoras, campeonatos, equipes, jogadores e managers.

## Comece por aqui

Leia [`PROJECT_CONTEXT.md`](./PROJECT_CONTEXT.md) antes de alterar o projeto.

## Estrutura

- `backend/`: regras de negócio e servidor;
- `web/`: aplicação Next.js;
- `app/`: aplicativo móvel futuro;
- `database/`: scripts e estrutura de banco;
- `docs/`: documentação detalhada.

## Comandos

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

## Mudar a pasta do projeto

O projeto usa caminhos relativos e pode ficar fora da Área de Trabalho, inclusive
em outro disco. Abra o terminal na nova pasta antes de executar os comandos npm.
Preserve os arquivos locais `web/.env.local` e `app/.env`, que não ficam no Git.
O `deploy.bat` e o `TESTAR_DROPZONE.bat` usam a própria pasta como base.

Após mover, execute `npm install` para atualizar os vínculos do workspace e
`npm run build` para validar a aplicação web no novo local. Atualize também
eventuais atalhos ou terminais que ainda apontem para a pasta antiga.

## DropZone — Rodada 04 (21/10/2026)

Versão local acumulada R01 + R02 + R03 + R04. Correções de navegação, acesso a Minha área e alinhamento/rolagem de tabelas: consulte `docs/RODADA_04_UI_NAVEGACAO_TABELAS.md`. Para checagens sem rede, execute `TESTAR_RODADA_04.bat` (Windows) ou `node scripts/testes/test-round4-ui.mjs`. **Sem publicação nem migrações automáticas no Supabase; testes visuais e build integral pendentes.**

## DropZone — Rodada 05 (22/10/2026)

Correcoes locais R01–R05 acumuladas. R05 fortalece downloads de imagens e links do Electron, valida dados opcionais do Engine, conserva vinculos legados de jogadores no MatchStats e protege PlayerIDs numericos do SPEC. Veja `docs/RODADA_05_INTEGRACOES_SPEC_ENGINE_ELECTRON.md` e rode `TESTAR_RODADA_05.bat` no Windows. Nao houve deploy ou alteracao no Supabase.

## DropZone — Rodada 06 (25/10/2026)

Auditoria de distribuição detectou estados de sessão Supabase em ZIPs completos anteriores. **Não reutilize nem redistribua pacotes R01–R05 sem sanitização.** A versão completa da R06 remove artefatos `.auth`, `.temp` e credenciais. O empacotador seguro está em `scripts/release/empacotar-fonte.mjs`; a regressão acumulada em `npm run test:rounds` ou `TESTAR_RODADA_06.bat`. Detalhes: `docs/RODADA_06_HOMOLOGACAO_E_DISTRIBUICAO.md`. Build Next completo, QA E2E e transações PostgreSQL seguem pendentes. Nenhuma escrita no Supabase nem publicação nesta rodada.

## Rodada 07 — escolha e restauração de grupos (26/10/2026)

A restauração por equipe no fluxo legado volta a conferir bloqueios administrativos,
reservas da Lili, convites válidos e contexto de fase antes de alterar slots.
`TESTAR_RODADA_07.bat` executa os testes acumulados R01–R07. Consulte
`docs/RODADA_07_ESCOLHA_GRUPOS_2026-10-26.md` para evidências e limites.
Alterações não implantadas no Supabase nem no site.

## Rodada 08 — integridade de escolhas administrativas (26/10/2026)

Equipe e administração compartilham validações prévias para slots bloqueados, reservas Lili, convites e fases. O painel administrativo também exige participação ativa e espelho atual consistente nas ações de escolha, cancelamento e restauração. Rode `TESTAR_RODADA_08.bat` ou `npm run test:rounds` e consulte `docs/RODADA_08_INTEGRIDADE_ESCOLHAS_2026-10-26.md`. **Mudanças somente no código; sem escrita em produção, sem atomicidade completa do legado.**

## Rodada 09 — SQL transacional e exclusões (26/10/2026)

As candidatas SQL de inscrição/movimentação agora conferem bloqueios de grupo/slot, reservas Lili e convites válidos, inclusive no caminho administrativo. O banco **não foi modificado**; os testes verificam contratos estruturais, não concorrência PostgreSQL. Veja `docs/RODADA_09_TRANSACOES_POSTGRES_2026-10-26.md` e rode `TESTAR_RODADA_09.bat`. As flags atômicas continuam desligadas até homologação isolada.

## Rodada 10 (26/10/2026) — escritores concorrentes (candidata)

A R10 acrescenta RPCs candidatas de bloqueio administrativo e reserva da Lili (`docs/sql/20261026_round10_*_candidate.sql`), roteamento opt-in com falha fechada e testes locais. Ambas as flags `DROPZONE_LILI_RESERVATION_MODE` e `DROPZONE_GROUP_BLOCK_WRITE_MODE` ficam em `legacy` por padrão. **Nada foi implantado no Supabase.** Leia `docs/RODADA_10_PROTOCOLO_CONCORRENCIA_2026-10-26.md` e `TESTAR_RODADA_10.bat`. A homologação real com PostgreSQL em duas sessões continua pendente.

## Rodada 11 (26/10/2026) — convites e limpeza de reservas

Consumo genérico de tokens protegido por UPDATE condicional, candidato SQL transacional para renovar/cancelar convites e limpeza Lili limitada por lote com locks grupo -> slot. Modos atomicos continuam DESLIGADOS ate homologacao PostgreSQL. Consulte `docs/RODADA_11_CONVITES_TOKENS_RESERVAS_2026-10-26.md` e `TESTAR_RODADA_11.bat`. Sem alteracao Supabase/deploy.

## Rodada 12 (26/10/2026) — consumo de convites de jogadores e vendedores

Proteções de UPDATE condicional para aceitar convites de elenco/vendedor, recuperação de aceites incompletos pelo destinatário, filtros concorrentes em renovação/cancelamento e comparação exata de tokens na Lili. Teste `npm run test:round12` ou `TESTAR_RODADA_12.bat`; detalhes em `docs/RODADA_12_TOKENS_ESCRITORES_2026-10-26.md`. **Sem deploy, sem SQL aplicado; PostgreSQL concorrente e build integral pendentes.**


## Rodada 13 — Homologação (26/10/2026)

As correções acumuladas R01–R12 foram acompanhadas de um portão de prontidão R13.
Execute `npm run test:round13` para o teste estrutural e `npm run release:readiness` para consultar bloqueios de publicação.
A implantação segue **bloqueada** enquanto o build integral, PostgreSQL concorrente, E2E e rollback não estiverem homologados.
Detalhes: `docs/RODADA_13_HOMOLOGACAO_2026-10-26.md`.

## Homologação R14 (26/10/2026)

Use `TESTAR_RODADA_14.bat` no Windows após `npm ci`, ou `npm run release:verify -- --full`.
O relatório local fica em `relatorios-testes/round14-local-evidence.json` (não é distribuído no ZIP).
**Código 2 significa release bloqueado por verificações incompletas**, não necessariamente erro funcional.
A release permanece impedida até que as provas de PostgreSQL, rollback, E2E e integrações reais sejam revisadas.
Consulte `docs/RODADA_14_VALIDACAO_E_LIBERACAO_2026-10-26.md`. Não execute SQL candidato em produção.


## Rodada 15 — homologação por evidências

A R15 amplia o fingerprint para incluir testes E2E/configurações e torna o build Next.js integral obrigatório para aprovação. `TESTAR_RODADA_15.bat` e `npm run release:lab-preflight` ajudam a localizar bloqueios do laboratório. Leia `docs/RODADA_15_HOMOLOGACAO.md`. **Não aplicar SQL em produção.**

## Rodada 16 — recuperação do laboratório (26/10/2026)

Agora é possível recuperar o catálogo **histórico** diretamente do ZIP original com `IMPORTAR_CATALOGO_R16.bat`, sem extrair sessões ou usar o banco de produção. `build-schema.mjs --emit-only` cria a pasta de saída na primeira execução. Teste: `npm run test:round16`. Veja `docs/RODADA_16_RECUPERACAO_LABORATORIO.md`. Não substitui Docker/PostgreSQL ou staging e **não autoriza publicação**.

## R18 — Destinatários de convites

Revisão de convites de equipe e reservas Lili: IDs de equipe/line destinados são checados antes das gravações e no consumo condicional do convite; convites abertos permanecem suportados. A SQL candidata R11 recusa renovar convites bloqueados administrativamente. Ver `docs/RODADA_18_DESTINATARIOS_CONVITES.md`, `TESTAR_RODADA_18.bat` e `npm run test:round18`. **Não houve implantação ou homologação em PostgreSQL nesta rodada.**


## R19 — homologação com execução guiada (27/10/2026)

A R19 inclui `HOMOLOGAR_POSTGRES_R19.bat` (Docker Desktop e ZIP original do DropZone), `HOMOLOGAR_WEB_R19.bat` (npm ci, lint, tipos e build integral) e `TESTAR_RODADA_19.bat` (regressões locais). O primeiro executa a suíte nativa em um PostgreSQL 17 **isolado com dados sintéticos**, não no banco de produção, e salva o resultado em `relatorios-testes/`. O gate de publicação passa a exigir explicitamente os testes R17–R19 e considerar lançadores Windows na impressão digital do código. Consulte `docs/RODADA_19_LABORATORIO_EXECUTAVEL.md`. **O laboratório nativo e o build ainda não foram executados neste ambiente, portanto a publicação permanece bloqueada.**

## Correção R19 Windows — testes `.env.local` e ZIP original

Corrigida a asserção de segurança que falhava ao encontrar `.env.local` no computador do usuário; o teste agora distingue remoção de variáveis herdadas e substituição segura de variáveis carregadas de arquivos. O atalho `HOMOLOGAR_POSTGRES_R19.bat` agora valida o ZIP original antes da confirmação para criar Docker, recusando `.bat` e arquivos inválidos. Ver `docs/CORRECAO_R19_WINDOWS_ENV_E_ZIP.md`. **Sem homologação nativa/implantação.**


### Correção Windows R19 V3 (27/10/2026)
A execução real no Windows confirmou `BUILD_WEB_LOCAL_APROVADO` (TypeScript, lint e build Next.js). O teste de laboratório R19 foi corrigido para ser independente de `.env.local`. Para testar PostgreSQL local, use `HOMOLOGAR_POSTGRES_R19.bat` com o ZIP original ou com o arquivo privado separado `DROPZONE_CATALOGO_LAB_PRIVADO.zip` no diretório principal. Esse ZIP de catálogo **não é incluído na distribuição pública do projeto**. Consulte `LEIA_CORRECAO_R19_V3.txt`.

## Redesign Arena UI — R21
- Criação rápida por padrão para campeonato: tipo → essenciais → cotação/revisão → cadastro pendente; assistente completo continua disponível.
- Após criar, botão **Configurar campeonato** direciona ao painel existente.
- Cadastro inicial de equipe/jogador: campos obrigatórios em destaque, personalização opcional recolhida.
- `TESTAR_RODADA_21.bat` ou `npm run test:round21`. Mais detalhes em `docs/redesign/RODADA_21_CRIACAO_RAPIDA.md`.

## Redesign R23 — visual premium e mobile
A R23 inclui o menu público em formato de painel inferior, navegação ativa acessível, cartões de ações adaptativos, transições curtas e suporte a movimento reduzido. Consulte `docs/redesign/RODADA_23_VISUAL_MOBILE.md`.

## Redesign R24 — encerramento do ciclo R20–R24 (03/11/2026)

Revisão de foco nos menus inferiores, rótulos acessíveis, overflow em celulares de 320 px e suíte de QA público. Execute `TESTAR_RODADA_24.bat` para checagens locais, `HOMOLOGAR_WEB_R19.bat` para o build e `HOMOLOGAR_MOBILE_R24.bat` para testes públicos no Chromium. **Testes autenticados e homologação do PostgreSQL permanecem fora do escopo dos testes locais.** Consulte `docs/redesign/RODADA_24_HOMOLOGACAO_REDESIGN.md`.
