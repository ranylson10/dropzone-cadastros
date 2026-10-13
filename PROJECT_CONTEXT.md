# CONTEXTO CENTRAL — DROPZONE

> Este é o primeiro arquivo que deve ser lido antes de alterar o projeto.
> Atualize-o ao fim de cada rodada relevante.

**Última atualização:** 12 de outubro de 2026
**Estado:** auditoria das 43 rotas e correções locais em continuidade. Quatro P1 originais corrigidos; 20 achados originais corrigidos no escopo documentado e seis parciais. Duas pendências adicionais de banco (DBR01/P1 e DBR02/P2), transação completa e QA integral ainda impedem considerar a publicação pronta. GitHub/Vercel não atualizados. Relatório: `docs/CORRECOES_AUDITORIA_2026-10-11.md`.

## 1. Objetivo do sistema

O DropZone é uma plataforma para produtoras, campeonatos, equipes, jogadores e managers de Free Fire. O sistema deve oferecer páginas públicas, painéis administrativos, inscrições por link, organização de fases/grupos/jogos, escalações e substituições.

Princípios obrigatórios:

- componentes reutilizáveis, sem formulários duplicados;
- páginas pequenas e fáceis de localizar;
- regras de negócio no backend;
- carregamento somente dos dados necessários;
- segurança aplicada no servidor e no banco;
- nenhuma consulta administrativa deve retornar dados de outros usuários sem autorização;
- cada rodada deve manter o projeto compilável.

## 2. Estrutura oficial

```text
dropzone/
├── backend/        regras de negócio, permissões e acesso ao banco
├── web/            aplicação Next.js
├── app/            aplicativo móvel Expo / React Native ativo
├── desktop/        aplicativo Electron DropZone Live Local
├── database/       SQL, migrations, views, policies e funções
├── supabase/       histórico de migrations aplicado pelo CLI/MCP
├── docs/           documentação detalhada
└── PROJECT_CONTEXT.md
```

### Atenção aos dois nomes `app`

- `/app`: aplicativo móvel Expo SDK 54, com código em `src/`; não é uma segunda aplicação Next.js.
- `/web/app`: App Router do Next.js; contém rotas do site e endpoints HTTP.

## 3. Organização da aplicação web

```text
web/
├── app/            rotas, layouts e route handlers
├── components/     UI global e formulários reutilizáveis
├── features/       recursos específicos por domínio
├── hooks/          hooks compartilhados
├── lib/            utilitários exclusivos do frontend
├── providers/      providers globais
├── services/       cliente HTTP compartilhado
├── styles/         estilos compartilhados
├── types/          tipos compartilhados do frontend
└── public/         imagens e arquivos públicos
```

### Formulários reutilizáveis definidos

- Campeonato: `web/components/forms/campeonato/`
- Equipe: `web/components/forms/equipe/`

Eles serão usados em qualquer página que precise criar ou editar esses registros. Não devem acessar Supabase diretamente.

### Estrutura de campeonato definida

```text
web/features/campeonatos/
├── fases/
├── grupos/
├── jogos/
└── components/
```

Slots não terão formulário próprio. Ao criar um grupo, o backend deverá criar automaticamente a quantidade de slots informada, em uma operação transacional.

## 4. Estado atual da migração

Migração inicial de julho (histórico):

- Next.js movido da raiz para `web/`;
- código de servidor inicial movido para `backend/src/`;
- SQL movido para `database/supabase/`;
- pasta `app/` criada para o aplicativo futuro;
- árvores de componentes e recursos criadas;
- aliases ajustados para permitir imports do backend no Next.js;
- documentação central criada;
- `npm run typecheck` aprovado após a migração;
- `npm run build` aprovado após a migração.

Situação atual em outubro:

- as rotas HTTP continuam em `web/app/api` porque são route handlers do Next.js;
- `web/app/api/dropzone/route.ts` tem 55 linhas de transporte; serviços, consultas, permissões, tokens e configuração ficam em `backend/src/dropzone/entities/`;
- `web/features/dropzone` ainda contém componentes grandes do painel legado; a Lili já usa serviços por domínio em `backend/src/lili/`, com 88 comandos em 19 handlers e rota HTTP de 14 linhas;
- formulários e workspaces compartilhados existem, com partes do acabamento e da cascata ainda pendentes;
- as páginas públicas e os painéis dos cinco perfis existem e foram visitados; isso não certifica todos os modais e fluxos mutáveis.

## 5. Modelo de páginas aprovado

Páginas públicas:

```text
/produtoras
/produtoras/[id]
/equipes
/equipes/[id]
/jogadores
/jogadores/[id]
/managers
/managers/[id]
/campeonatos
/campeonatos/[id]
```

Painéis administrativos existentes:

```text
/?painel=1          workspace do perfil ativo: produtora, equipe, jogador ou manager
/admin             administração do sistema
```

As rotas `/painel/...` eram uma proposta histórica e não existem no App Router atual. A home autenticada seleciona os workspaces por perfil; páginas públicas usam os componentes de diretório. A matriz completa está em `docs/AUDITORIA_ROTAS_2026-10-10.csv`.

## 6. Banco conhecido

Tabelas informadas pelo usuário:

```text
campeonato_equipes
campeonato_fases
campeonato_grupo_slots
campeonato_grupos
campeonato_jogadores
campeonato_jogos
campeonato_jogos_grupos
campeonato_links
campeonato_links_inscricao
campeonato_regras
campeonato_regras_escalacao
campeonato_slots
campeonato_substituicoes
campeonatos
convites_tokens
equipe_jogadores
equipes
equipes_perfis
inscricoes_jogadores
inscricoes_substituicoes
jogadores
jogadores_equipes
manager_equipe
manager_jogador
manager_produtora
managers
produtoras
tokens
```

O uso definitivo de tabelas com nomes parecidos ainda não foi confirmado. Não substituir tabelas por suposição. Antes, consultar colunas, chaves estrangeiras, índices, constraints e políticas RLS.

Consulte `docs/BANCO_DE_DADOS.md`.

## 7. Riscos já identificados

- As leituras privadas corrigidas da API genérica aplicam o escopo no banco antes da paginação; novas consultas com `service_role` devem preservar essa regra e a cobertura de isolamento.
- A home solicita tipos por perfil. A produtora inicia somente com campeonatos; detalhes são carregados por área e campeonato, e indicadores usam contagens HEAD. Cinco seletores web, os dois diretórios móveis, a busca global e os seletores móveis de transferência/inscrição têm paginação. O catálogo público de campeonatos consulta somente as relações dos IDs da página. Listas agregadas e outros catálogos ainda precisam de migração.
- Consumo do **link de grupo** usa RPC `fn_consumir_vaga_link_grupo`, confirmada no catálogo do banco conectado em outubro; o código mantém fallback CAS para instalações antigas.
- Inscrição completa (slot + participação + uso do link + histórico) ainda não é uma única transação SQL end-to-end.
- Managers ainda não utilizam plenamente `manager_produtora`, `manager_equipe` e `manager_jogador` nas permissões.
- Existem possíveis tabelas antigas e novas para a mesma finalidade.
- Os serviços extraídos da API genérica ainda têm operações com várias etapas; a separação de arquivos não torna a inscrição uma transação SQL única.

### Corrigido em 21/07/2026

- webhook ASAAS exige token e confirmação direta na API ASAAS;
- pagamento de inscrição valida equipe/organizador e não aceita vendedor informado pelo cliente;
- crédito, solicitação de saque, débito e estorno usam RPCs transacionais;
- saques finalizados não podem mudar de estado;
- upload não confia no `x-profile-type` para obter permissão de campeonato/equipe.

### Operações de banco

Histórico SQL anterior à adoção do controle de migrations do Supabase:

`database/migrations/20260716_links_soft_delete_e_consumo_atomico.sql`

Aplicada em 21/07/2026:

`database/migrations/20260721_carteira_saques_atomicos.sql`

## 8. Convites de equipes (resumo)

- Doc: `docs/FLUXO_CONVITES_EQUIPES.md`
- Grupo: `/convite/grupo/[token]` · multi-uso · auto-slot · equipes esperadas opcionais (só admin)
- Único: `/convite/equipe/[token]` · um uso · mesmo padrão de acompanhamento quando indisponível
- Token morto → acompanhamento público (não tela de erro se o campeonato/grupo existir)

## 9. Estratégia de desempenho

- carregar somente dados da página ou aba ativa;
- paginar listas grandes;
- usar Server Components no carregamento inicial;
- usar Client Components apenas em áreas interativas;
- não executar `fetch('/api/dropzone')` para carregar o sistema inteiro;
- atualizar listas localmente ou invalidar somente o recurso alterado;
- evitar consultas N+1;
- criar índices após confirmar os filtros reais.

## 10. Comandos do projeto

Na raiz:

```bash
npm install
npm run dev
npm run typecheck
npm run build
```

Os scripts de desenvolvimento, typecheck e build encaminham os comandos ao workspace `web`. `npm run lint` cobre web e backend; `npm run test:security` inclui os serviços da Lili e o escopo das consultas privadas. `npm run check:release` executa a validação local sem publicar.

## 11. Regra para futuras conversas

Ao iniciar uma nova conversa:

1. enviar o ZIP mais recente;
2. informar que existe `PROJECT_CONTEXT.md`;
3. pedir para ler `PROJECT_CONTEXT.md` e `docs/` antes de alterar arquivos;
4. revisar `docs/CHANGELOG.md` para saber a última rodada concluída;
5. não reconstruir a arquitetura com base apenas na conversa nova.

## 12. Próxima etapa planejada

1. Revisar as alterações locais, validar CI remoto/preview e planejar a publicação das correções de outubro.
2. Dividir componentes grandes restantes e fluxos de convite por domínio, preservando os contratos de permissão e a arquitetura de serviços já extraída da Lili.
3. Reduzir o CSS global por domínio e consolidar as regras de densidade; a remoção do catálogo antigo não encerra essa migração.
4. Validar a instalação móvel Android/iOS em dispositivo, além do typecheck e do pacote JavaScript.
5. Completar a transação end-to-end de inscrição e sua cobertura de concorrência.

## 13. Integração DPZ Live — R03

- Endpoint: `GET /api/desktop/campeonatos/{id}/baseline?jogo_id=...&partida_id=...`.
- Autenticação: Bearer e permissão compartilhada do Studio local.
- Corte: somente quedas do mesmo jogo com `numero_partida` menor e `status = finalizada`.
- Pontos, kills e booyahs: agregadores oficiais existentes com `partidaIds`.
- Identidades: `campeonato_equipe_id` e `campeonato_jogador_id`; nunca agrupar por IDs externos.
- Detalhes e testes: `docs/DPZ_INTEGRACAO_R03_BASELINE.md`.

## 14. Auditoria e correções de outubro de 2026

- Diagnóstico original preservado em `docs/AUDITORIA_COMPLETA_2026-10-10.md`; evidências locais em `relatorios-testes/correcoes-2026-10-10/` (ignoradas pelo Git).
- Supabase DropZone `uukivzxabiydnrvjvabt`, organização SocialManager. RLS permanece habilitado em todas as 118 tabelas públicas. Tabelas sem policy usam acesso exclusivo do backend ou histórico classificado; não adicionar policies permissivas para eliminar avisos informativos.
- Migration `20261011023433_harden_public_profile_columns.sql` aplicada: contatos, identificadores de autenticação, senha do dono e tokens de inscrição não podem ser enumerados por `anon`/`authenticated`; campos públicos continuam com grants explícitos. Leitura privada autorizada usa o backend.
- Proteção contra senhas vazadas ativada e salva no painel de autenticação em 11/10. Advisor de segurança não retorna esse alerta.
- `site_home_config` reconciliada com a versão remota `20261004051145`; snapshot sanitizado atualizado. SQL legado não deve ser reaplicado apenas porque não consta no histórico iniciado em agosto.
- PayPal reconsulta a compra/reserva e valida o preço persistido/cotação assinada no backend; captura e webhook verificam referência, moeda e valor. `CURRENCY_QUOTE_SECRET` deve ser estável; a configuração aceita o segredo PayPal como fallback.
- Proxy de imagem permite assets locais próprios, Storage público conhecido ou HTTPS em `STREAM_IMAGE_ALLOWED_ORIGINS`; bloqueia IP privado, fixa o DNS da conexão, revalida redirects e limita o corpo a 25 MB.
- Catálogo padrão usa `ChampionshipListRow`, com métricas rotuladas e filtro real por tipo. Preço ausente significa `Sob consulta`; somente zero explícito é gratuito.
- Dez fluxos por token usam a fundação compartilhada; os quatro wrappers restantes foram movidos para `web/features/token-flow/flows/`. OBS não monta os provedores/atalhos globais e usa fundo transparente.
- `readPagedRows` evita o corte implícito de 300/1.000 registros nas consultas corrigidas; filtros de autorização devem ser aplicados antes da paginação e a ordenação deve ser determinística.
- API genérica extraída para `backend/src/dropzone/entities/`; o contexto autenticado vem da rota HTTP, e invalidações de cache usam callbacks. Tests verificam autenticação antes de ler o corpo e rejeição de estrutura/links de outra produtora.
- Leituras privadas recebem escopo antes da paginação e não dependem de outras entidades na resposta. Vínculos de staff são paginados, e filtros IN usam lotes de até 150 IDs. O seletor público de equipes não expõe UUID do dono de outra conta; jogador/equipe recebem campeonatos relacionados. Manager/broadcast não carregam o agregado da home.
- Lili extraída para `backend/src/lili/`: 88 comandos, 19 handlers, 15 módulos de ferramentas e quatro de helpers; tradução e reconhecimento de intenção de servidor ficam no backend. As 356 comparações com a implementação anterior passaram com fixtures, sem pagamento real. A rota mantém somente transporte.
- Carregamento do workspace da produtora: `workspace-entities.ts` define tipos por perfil/área; `useProducerEntities.ts` cancela/descarta respostas anteriores e vincula o escopo à conta ativa. A carga inicial caiu de 12 tipos para um; mapas e nove componentes especializados são carregados sob demanda. Áreas com API própria não recebem o agregado redundante. Indicadores do campeonato/resumo usam contagens HEAD com IDs autorizados; falhas oferecem nova tentativa, sem zero falso. A faixa da conta mostra campeonatos aprovados/em aprovação.
- Continuação de workspace verificada: oito testes Playwright desktop/celular (troca rápida, falha/nova tentativa, atalho da Lili, consultas por área e 1440/768/390/320 px); contagens reais HEAD comparadas com IDs paginados no Supabase, sem gravação. Segurança, tipos, lint web/backend, build e auditoria online de produção passaram. Evidências: `relatorios-testes/workspace-2026-10-11/`. Navegação usa APIs/sessão simuladas; a sessão antiga usada para HTTP foi recusada, portanto login real e mutações ficam para staging.
- Ajustes locais em `workspace.module.css`: título legível sobre fundo escuro, navegação inativa e faixa de conta sem sobrepor nome/botão no celular. Oito capturas finais em 320/390/768/1440 px confirmam zero sobreposição, overflow, texto abaixo de 12 px ou erro JS; botão mobile de 44 × 44 px. Build repetido após o CSS. Esta amostra não certifica acessibilidade integral.
- Chamadas internas da Lili aceitam somente origens configuradas, não seguem redirects e têm timeout de dez segundos antes de encaminhar sessão. Configure `APP_URL` ou `NEXT_PUBLIC_APP_URL` no desenvolvimento local; previews usam as origens declaradas pela Vercel. Consulte `backend/src/lili/README.md`.
- Chat da Lili usa CSS Module com 148 regras isoladas. Fontes abaixo de 12 px foram normalizadas em 31 folhas de estilo, preservando os estilos de exportação/stream; avatar e rótulos administrativos também foram corrigidos. Controles de idioma/reset têm 44 × 44 px; envio, nome acessível e foco foram verificados em 320/390/768/1440 px.
- Cópias órfãs da raiz arquivadas de forma reversível nas evidências locais. A aplicação web oficial fica em `web/`.
- Next.js/eslint-config-next 16.3.8; Expo 54.0.37; Electron 43.7.9. Auditoria de produção web ficou sem vulnerabilidades; ainda existem advisories no ferramental, detalhados na rodada de validação.
- `npm run test:security` verifica preço adulterado, assinatura, propriedade, captura repetida, webhook, paginação e SSRF com mocks. `npm run check:release` exige segurança, typecheck, lint, build e auditoria de produção.
- `deploy.bat` chama `scripts/publish-reviewed.ps1`, que requer seleção explícita de arquivos, validação e confirmação no terminal. O workflow local de qualidade foi criado; sua execução remota depende da publicação posterior.
- Validação: segurança, typecheck, lint web/backend, build e audit online de produção aprovados; 15 auditorias de layout, 18 verificações do catálogo e 44 testes Playwright passaram. Auditoria geral atual: 107 OK, dois avisos de CSS e zero erros. As 86 aberturas e 111 estados autenticados não apresentaram overflow/erro JS/main aninhado ou texto visível abaixo de 12 px nos cenários visitados; APIs de leitura sem erro. Evidências da continuação em `relatorios-testes/continuacao-2026-10-11/`.
- Buscas paginadas em `backend/src/directory/search-page.ts` e `backend/src/campeonatos/team-search.ts`: cinco seletores web (30 itens) e diretórios móveis de equipes/jogadores (50), cursor por nome/id e consulta/recurso, texto citado, projeção pública e autorização do campeonato antes da leitura. Consultas de jogador corrigidas ao esquema real (nome/avatar_url/id_jogo; sem nick/foto_url/public_id no banco). Compatibilidade do primeiro lote sem limit mantida para apps instalados; busca global/gestão de lines móveis foram paginadas na continuação posterior; hubs antigos da Lili não têm referências ativas. Passaram 16 testes de navegador (8 novos + 8 repetidos), fixtures de 1.093 equipes ativas/601 lines, leitura real e 19 GETs locais sem gravação; gate completo, typecheck móvel e exportação JS Android repetidos. Título do jogador corrigido no módulo local. Evidências em `relatorios-testes/paginacao-2026-10-11/`.
- Pendências: CSS global, painéis/convites grandes, cursor nas listas/catálogos restantes e consumidores legados, custo das áreas especializadas, contraste/zoom/modais e QA dos aplicativos permanecem parciais. Dependências completas confirmadas online: web cinco altas no ferramental, Expo 23 altas/13 moderadas e desktop oito moderadas; produção web zerada. Gates e fixtures não certificam pagamentos/inscrições reais ou concorrência. Nenhum commit/push/deploy executado.

### Continuação de consumidores móveis — 11/10/2026

Busca global em páginas de 20 e seletores de transferência/inscrição em páginas de 30; cancelamento/repetição compartilhados. Catálogo público de campeonatos extraído para backend, busca por nome/tipo/plataforma/servidor e relações limitadas à página. Hubs antigos da Lili não têm referências na interface ativa. Passaram 14 testes de comportamento móvel com DOM adaptado, 16 regressões web, sete suítes de segurança, tipos, lint, build, produção npm zerada e exportação JS Android. Auditoria geral: 107 OK, dois avisos CSS, zero erros. 49 GETs do serviço e 11 GETs locais, sem gravação real. Isso não certifica layout/dispositivo nativo. Sem commit/push/deploy; 20 achados corrigidos e seis parciais permanecem. Evidências: relatorios-testes/consumidores-2026-10-11/.

Preço móvel ausente/inválido: Sob consulta; só zero explícito: Grátis. Prêmio ausente/zero: Sem premiação informada. Formatador compartilhado e regressões do DTO verificados nesta continuação.

Vercel conferida por leitura: Root Directory web, Node 24.x; última produção listada Ready de 25/09. Main remota coincide com ef9416e1; GitHub Actions não retornou execuções recentes. Valores de ambiente não lidos; PayPal/assinatura de cotação precisam de configuração sandbox para preview. Sem alteração remota. Evidência: relatorios-testes/consumidores-2026-10-11/publication-preflight.json.

### Continuação dos perfis públicos — 11/10/2026

Base dos cinco perfis em backend/src/directory/public-profile-base.ts: ID validado/normalizado, projeção explícita e bloqueio de visibilidade antes das relações. Não chamar listDirectory para localizar um perfil. Adapter web conserva DTOs/mapeadores e cache de 30 segundos; auth_user_id interno não é publicado. Inativos históricos preservam a visibilidade anterior. Composição detalhada, algumas relações repetidas, ranking global, listas agregadas e limites de views estatísticas continuam pendentes; A01/A03 parciais.

CSS Modules locais em CompetitiveProfilePanel e LiliGlobalLauncher corrigem separação das médias, dois títulos de desempenho e sobreposição da Lili/compra mobile. Passaram 12 casos de navegação real + 24 regressões estáticas/modelos, 30 medições em 1440/390/320 px e dez capturas, sem as colisões/overflow/textos abaixo de 12 px medidos. Contraste mínimo dos dois títulos: 12.25:1, sem certificação integral.

Oito suítes de segurança, tipos, lint, build e produção npm zerada após o CSS final. Auditoria geral 107 OK/2 avisos CSS/zero erros. Fixtures de 1.203 pais por tipo e cap 7; paridade dos cinco DTOs completos com a versão anterior em fixture separada, sem benchmark de latência. Banco real: 31 GETs/zero gravações. Página inexistente: 404 visual/noindex; HTTP 200 é possível após streaming do Next. Evidências: relatorios-testes/perfis-2026-10-11/. Sem commit/push/deploy; 20 corrigidos e seis parciais mantidos.

### Continuação de estatísticas — 11/10/2026

Agregação de equipes/MVP e fallback Garena em statistics-read.service.ts; filtros/páginas em statistics-query.ts; regras públicas em published-statistics.service.ts, com exports compatíveis. Política pública em backend/src/shared/public-visibility.ts, reexportada pela base de diretórios. Estatísticas públicas conferem visibilidade do campeonato antes das relações. Ausência/nulo/vazio/valor inválido de delay mantém 300 segundos; só zero explícito é imediato.

Views ordenadas por resultado_id (não possuem id), tabelas por IDs; readPagedRows até terminar e IN de até 150. Partidas publicadas, enriquecimento, final/bônus/Booyah Ouro e súmula paginados. Perfil inicial usa um único corte publicado, sem slice(0,100) nem catch que transforme falha em tabela vazia. Leitura imediata autorizada continua no guard existente.

Fixture de 1.203 detalhes/301 participantes/lines/partidas e cap sete: filtros, publicação, campeonatos ocultos, fallback oficial, falhas tardias, campeão ainda aberto, vitória na queda 301 e bônus fora do primeiro lote passaram. Nove suítes de segurança, tipos, lint, build e produção npm zerada. Auditoria geral 107 OK/2 avisos CSS/zero erros; scanners seguem estatísticas e reconhecem requireCampeonatoScore após conferência do helper.

66 casos Playwright: 14 navegações reais (12 perfis repetidos + dois de estatísticas), dois casos GET HTTP e 50 estáticos/modelos. Estatísticas: 12 medições/oito capturas; perfis: 30 medições/dez capturas, sem overflow/texto visível abaixo de 12 px/main aninhado na amostra. Rótulos de filtros corrigidos em PublicStatistics.module.css, contraste mínimo 6.26:1; validação localizada. Direto no banco, execução registrada: 14+2 GETs, uma leitura de esquema; campeonato real com 10 equipes/40 jogadores de uma queda publicada. As duas views anônimas não retornaram linhas na amostra. Nenhuma gravação, pontuação/finalização real, commit/push/deploy.

A01/A03 e demais seis parciais mantidos: agregados/ranking global, relações repetidas, painéis/convites grandes, CSS/acessibilidade, QA nativo e transações/concorrência em staging. Paginação não é snapshot transacional. Evidências: relatorios-testes/estatisticas-2026-10-11/; reprodução da composição anterior documenta quebra do atraso e corte em 100 em fixture, sem provar divulgação real.

### Continuação de ranking — 11/10/2026

Consultas publicadas em tier-ranking.service.ts, fórmula pura em tier-ranking.engine.ts e histórico/composição em public-performance-read.service.ts/competitive-profile.service.ts. Partidas finalizadas por atraso e visibilidade em lote; imports concluídos/oficiais do mesmo campeonato. Páginas estáveis e IN até 150. Score global preservado (percentis/oito iterações); snapshot completo em cache alimenta perfil além da posição 100. API segue Top 100/no-store/erro genérico. Chaves versionadas e tag de campeonato associada às camadas; alterações por outros canais dependem da revalidação.

Fixtures 301 campeonatos/participantes/jogadores, 1.204 quedas/1.203 resultados/cap sete e 301 inscrições de uma equipe. Tiers/totais iguais entre caps; Top 100 DTO completo igual à versão anterior no mesmo conjunto publicado. Fixture bloqueada demonstra inclusão antiga de dados/armas, sem evidência de incidente real. Falhas tardias e esquema propagados; histórico filtrado por entidade antes da paginação.

Dialog compartilhado no ranking: Escape, foco inicial/circular/restaurado e body scroll conferidos; CSS Module local, fechar/link 44 px. 18 medições/oito capturas em três modos e 1440/390/320, contraste mínimo de títulos 12.18:1/rótulos 8.13:1, incluindo estatísticas expandidas. 74 Playwright: 22 navegações, dois GET HTTP e 50 estáticos/modelos; mais 30 medições/dez capturas de perfis e 12/oito estatísticas. Sem overflow/texto abaixo de 12 px/main aninhado na amostra.

Dez suítes, tipos, lint, build e produção npm zerada; scanner geral 107 OK/2 avisos CSS/zero erros. Banco real 27+1 GETs/zero gravações, 11 equipes/40 jogadores/dois campeonatos; duas amostras de perfil com histórico Garena vazio, relacionamento validado em leitura separada. Sem commit/push/deploy. 20 corrigidos/seis parciais mantidos; demais agregados, cache/carga, relações repetidas, módulos grandes, CSS/acessibilidade, QA nativo e transações em staging pendentes. Evidências: relatorios-testes/ranking-2026-10-11/.

### Continuação de inscrições — 11/10/2026

Convite de equipe separado em serviços backend (38 linhas na rota); grupo continua grande. Staff leitura não inscreve, escalação usa line existente, edição cria/reativa. Remoção/compensação passam a conferir o snapshot autorizado/criado, e espelho da aplicação exige escopo/ocupante. Slot inválido explícito recusado; token consumido com status/flag/prazo atuais. Paginação estável/IN150; POST evita board/roster. UI cancela carga, libera busy em erro, nova tentativa/clique duplo, cabeçalho visível/altura por conteúdo; Lili afastada das ações mobile.

Fixture 601 lines/301 slots/1.203 jogadores/cap7 e comparação de DTOs, duas falhas anteriores reproduzidas. 13 GETs reais/zero gravações: grupo de 12 slots vazios, uma line/participação; nenhum convite real disponível na amostra. 30 casos ao final (10 convite/8 tokens com fixtures/12 perfis reais); um timeout de conexão no perfil de campeonato, repetido isoladamente e aprovado. Seis medições/duas capturas do convite, contraste título 15.22:1, sem overflow/texto pequeno/main aninhado/colisão da Lili na amostra; mais 30/dez de perfis. Onze suítes/tipos/lint/build/audit produção zerada; build/lint após último CSS, fixture atualizada ao banco. Geral 107 OK/2 avisos/0 erros.

Banco PostgreSQL 17.6 conferido por SQL Editor: DBR01/P1, gatilho público libera com OR status ocupado e ocupa só por ID. Candidato docs/sql/20261011_slot_mirror_guard_candidate.sql validado em sete cenários sequenciais com tabelas/função temporárias + ROLLBACK; zero função temporária restante, público intacto. NÃO APLICADO; testar no esquema completo e registrar migration antes de publicar. DBR02/P2: campeonato_equipes_campeonato_line_unique inclui linhas removidas e impede reinscrição; índices ativo/pendente também existem. Não apagar restrições sem validar dependências e manter proteção por status. Plano docs/PLANO_TRANSACAO_INSCRICAO_2026-10-11.md.

Line/participação/token/metadados/contador ainda não são transação única; fixtures/interleavings e esquema reduzido não provam concorrência paralela. Os 26 originais continuam 20 corrigidos/seis parciais, mais duas pendências adicionais de banco (uma P1). Demais CSS/componentes/agregados e QA nativo continuam parciais. Sem alteração permanente de banco, commit/push/PR/deploy; evidências relatorios-testes/inscricoes-2026-10-11/.

### Continuação de convite de grupo — 11/10/2026

Rota de grupo 1.232 → 43 linhas; quatro serviços backend, grade compartilhada sem repetição/POST sem roster. GET sem heal, escopo/paginação/IN150, erro explícito, pai público, token exato/regex literal no legado e no-store/diagnóstico sanitizado. Counter CAS com snapshot/recibo/revisão opaca inclusive descricao; compensação preserva alterações posteriores, histórico merge e fechamento fresco. Staff leitura não inscreve/recebe tokens privados; escalação usa line existente, criação/reativação exige edição; line validada antes de consumir.

Doze suítes/gate, tipos/lint/build final, npm produção zero, scanner 107 OK/2 avisos/0 erros. 40 browser (10 grupo/10 equipe/8 outros tokens com fixtures + 12 perfis reais somente leitura). Duas falhas iniciais de Lili sobre CTA mobile corrigidas: seis medições/capturas 1440/390/320, sem overflow/tiny/main aninhado/colisão, título 16.18:1. Fixture cap7/601 lines/301 slots/1.203 jogadores e seis consumos simulados com limite2/duas aceitações; sem duas transações PostgreSQL reais. 4 GETs reais/zero gravações; nenhum convite existente retornado na amostra, aceite real não exercitado.

DBR01/P1/DBR02/P2 e transação integral continuam pendentes: line pode ficar criada após falha posterior e uso pode permanecer reservado se devolução segura não for possível. CAS não protege escritores externos não cooperantes; precisa staging com esquema completo/concorrência e metadata volumosa. GroupInviteFlow ainda 2086 linhas, chat/CSS/acessibilidade integral e QA nativo parciais. Nenhuma alteração permanente de banco, commit/push/PR/deploy. Evidências relatorios-testes/convite-grupo-2026-10-11/.

### Continuação de PostgreSQL e política de inscrições — 11/10/2026

Usuário definiu que convites equipe/grupo respeitam fechamento e prazo geral. Política compartilhada no backend, GET acompanhamento/motivo, POST antes de writes e antes de concluir; prazo inválido/read failure recusados. GET equipe confere No Ar antes das relações. A janela HTTP entre consultas/gravações ainda exige RPC atômica.

Docker PostgreSQL17.6 sem rede/portas/dados reais: catálogo 02:46UTC, 118 tabelas/818 constraints/74 funções/76 triggers/RLS policies; 18 masks UPDATE e duas identities locais. Views/precisão/atributos/owner ACL/infra Supabase não completos; Auth/roles fixtures. 35 casos nativos finais, seis sessões/locks reais/quota2 aceita2 de6; metadata552726bytes/301→302hist. Volume repetido após corrigir labels duplicados das fixtures. Transferência legítima rejeitada pelo candidato anterior reproduzida e corrigida; RPC nativa de transfer passou.

Cinco SQLs em docs/sql preparados, NÃO APLICADOS: mirror, rejoin index guard, atomic enrollment (service-only/ator/permissões/NoAr/fechamento prazo/grupo slot line/token quota/history/receipt), readonly preflight e guarded rollback. Rollback conserva rows/recibos e recusa se rejoinhist existe; restaura mirror anterior/DBR01, preferir forward. Script/harness scripts/testes/postgres-inscricoes/README.md separado do gate; exige catálogo local ignorado e lab com label/rede none.

12 suítes/gate tipos/lint/build/npmprod0; 28 browserfixtures (8novos policy+20convites regressão), desktop/celular. 4HEAD reais/0writes: ativos semline0/semslot0/removidosline0/ocupados14. BrowserSupabase semresposta; não houve novo catálogo/ACL completo. DBR01P1/DBR02P2 e integração RPC/UUIDpersistida/DTO/staging atual/writers locks deadlock retry/retention/legacy DELETE/Unicode continuam pendentes. 20 corrigidos/6 parciais originais +2 banco mantidos; CSS/QA nativo/componentes grandes pendentes. Sem commit push PR deploy. Evidências relatorios-testes/banco-inscricoes-2026-10-11/.

Laboratório fictício encerrado ao fim: contêiner/volume próprios removidos após verificar ID/label, Docker Desktop restaurado ao estado parado. Auditoria geral final 107 OK/2 avisos CSS/0 erros; primeira execução sem escalada falhou só no subprocesso npm e foi repetida com sucesso. Canvas atualizado/typecheck estrito/idempotência aprovados; abertura UI queued, sem prova de render. HEAD ef9416e1, sem publicação.


### Continuação de integração de inscrições — 11/10/2026

Integração local backend/web/Lili/app preparada, NÃO ATIVADA. INVITE_ENROLLMENT_MODE default legacy; atomic uma RPC sem fallback, valor desconhecido bloqueia. Autenticação antes do body, ator trusted da sessão, ignora ator/request_id enviados, UUIDs/body/index/DTO validados; SQL revalida permissões. Nenhum pre-read de token/slot para permitir receipt replay. Erros SQL sanitizados, conflito/deadlock manual, resultado incerto preserva chave. Apps antigos sem Idempotency-Key precisam atualização quando ativar.

Web: digest SHA256/UUID em sessionStorage antesPOST, mesma conta/kind/token/body após erro/abort/recarga da mesma aba; sucesso confirmado retira. Sem storage não envia. Team envia equipe selecionada; token literal % sem doubledecode. Lili encaminha chave, resposta enrollmentConfirmed explícita e retry na mensagem mais recente; primeiro browser mostrou confirmação antiga desabilitada após erro, corrigida. App: secureStorage existente+expo-crypto15.0.9 SDK54, digest/UUID sem token/PII, preparo serializado e UI submitLock, actorId das props Auth. API de jogador preservada.

15 suítes/gate finais, 41backend+15web+16mobile=72fixtures de integração, 42browser (36convites+6Lili;14novos+28regressões), mobiletypecheck e exportJSAndroid. BrowserLili inicial2falhas corretivas, final6pass/0flaky; convites36pass/0flaky. Geral107OK/2CSS/0erros e whitespacepass, HEADef9416e1. Funções SQL iguais aos35nativos anteriores; só comentário candidato atualizado, hash histórico conferido após restaurar comentário. Nenhuma suíte nativa reexecutada nesta fase.

Inventário AST293fontes:144writes literais/30arquivos,7alvos dinâmicos,12funções catálogo antigo. Escolha-grupo/estrutura-avançada/equipes escrevem participação/slot fora daRPC, com rollback/liberação sem ocupante esperado em caminhos; revisar antesativar, não é inventário exaustivo/prova de lockorder. Ainda dump/preflight atual/staging/PostgREST/Auth real, DBR01P1/DBR02P2/aplicação SQL, todoswriters/locks/deadlocks/receiptsretention/reconciliação, reservas/pagamentos sandbox, legacyDELETE/Unicode, appinstalado/QAdevice, CSS/acessibilidade/componentes e seisparciais. 20corrigidos/6parciais +2banco mantidos; publicação NÃO PRONTA. Semprodrowwrites/DDL/remoteenvchanges/commit/push/PR/deploy. Evidências relatorios-testes/rpc-inscricoes-2026-10-11/.

Final: gate check-release-auth-final.log passou após ajuste de login anônimo na Lili; última matriz Lili6/6 inclui esse fluxo, totalbrowser42. Android JS final e mobiletypes passaram; expo-crypto instalado, cadeia mobile continua23high/13moderate conhecida. Canvas atualizado/strict/idempotente; open UI queued, sem prova de render. Whitespacefinal0, HEADef9416e1 inalterado. Docker/lab da fase anterior permanecem encerrados; sem novo banco real/lab nesta fase.


### Continuação de movimentações de slots — 11/10/2026

Revisão escolha-grupo/estrutura-avançada/equipes: cinco sequências nativas baseline reproduzidas — slot_id reidratado por grupo/numero, swap parcial após clear, rollback entre fases sobrescreve substituta, claim zero rows seguido de mirror por ID e reserva da mesma line em duas posições da fase rejeitada pelo índice. Não é incidente real; writers continuam multistatement/compensações cegas pendentes.

Correção HTTP local escolha-grupo: política compartilhada em backend group-choice-window.ts rejeita data inválida/janela invertida; limites inclusivos; respostas no-store e diagnósticos DB sanitizados. 36policy/HTTPfixtures, authbeforebody/blockedwrites0. Root16suites/check:release types/lint/build/npmprod0. Auditor quick108OK/3warnings/0errors (2CSS+build skipped no modo quick; build completo passou no gate). Whitespace0/HEADef9416e1, sem novosbrowser/nativoapp.

Sexto SQL candidato: docs/sql/20261011_slot_plan_candidate.sql, NÃO INTEGRADO/APLICADO, somenteowner/service. Plano snapshot id/version/equipe/line/localização+target, locks ordenados/fresh scope/mirror, detach todastrês colunas antesattach, histórico/agenda/receipt atorUUIDfingerprint único transaction. activeonly/cancel locationnotremoval/tokenquota/paymentunchanged. Replay aftercommit; stale/ocupanteexterno/reservado recusados semcompensar; oldmirror póscheckrecusa/rollback. Sem staff/workspace/seller/teamchoicewindowblocks/contracts/distributioncomplete/outbox/UI/retention.

Docker17.6 networknone/zeroport/sintético, catálogo02:46UTC118tables818constraints74functions76triggers+18localmasks/2identities; Authrolesfixture/viewsprecisionACLinfra incomplete. Final31slotcases+35inscrregressions=66nativepass;6sessions1commit5replay/lockobserved, differentparticipants targetrace +enrollmentrace, agenda fixturegame rollback. Primeiras failures fixtures vagas/aplicado_por e constraint descoberta preservadas; final31zero. Não staging/PostgREST/Auth real/1000planbenchmark/realnetworkloss/totalwriters. Expandedinventory294sources178writes35files7dynamic13functions/18tables; corrigido produtora_membros, counts não comparáveis diretamente ao escopo10tabelas.

DBR01P1/DBR02P2 e writers atuais pendentes; INVITE_ENROLLMENT_MODE legacy. Ainda dump/preflight/staging/perms/contracts/locks/receipts/reconciliation/tokenreserve/sandboxpayments/appsinstalled/QAdevice/CSS/accessibility/sixpartials. 20corrigidos6partial originais+2DBmantidos. Supabasereads/writes/DDL/remoteenv/commit/push/PR/deploy0. Evidências relatorios-testes/movimentacoes-2026-10-11/. Cleanup status registrado em lab-cleanup.json; container/volumeremoved=true, Dockerrestoredstopped=true, imagecachepreservado.

Canvas da auditoria atualizado, TypeScript estrito e idempotência aprovados; fonte gerenciada igual à validada. Abertura no Codex retornou queued, sem prova de renderização. Verificação final inclui hashes do SQL e canvas. Laboratório/volume removidos e Docker Desktop sem processos ativos ao conferir; imagem mantida no cache.

<!-- end-slot-context-20261011 -->

<!-- slot-transfer-context-start -->
### Continuação de move/swap e permissões — 11/10/2026

Autorização local corrigida: apenas true JSON, paginação/IN150 e precedência determinística sem unir grants. SQL helper igual para 15 casos sobre rows nativas. managers_auth_user_unique e vendedor campeonato/manager unique impedem duplicatas; fixture301perfis é compatibilidade legada. Grant selecionado FOR SHARE e revogação observada; novos vínculos/restrições e legacy manager_invite expiry/used ainda pendentes.

SLOT_MOVEMENT_MODE default legacy, NÃO ATIVADO. Opt-in atomic PATCH equipes move/swap uma RPC, ator sessão/headerUUID/expectedparticipantIDs, no pre-read/retry/compensation/fallback, DTO whitelisted/errors private. Outros PATCH modes recusam atomic; POST/DELETE/outras rotas stilllegacy. Nenhum consumidor web ativo de movimento integrado. App ChampionshipTeamsPanel/Management passa actorId, guarda intenção original+UUID por actor/champ antesPATCH, umpendingscope, storagefailureblock, restart/replay mesmo sourceempty, accountisolation/doubleclicklock; UI confirmar resultado/descarte local explícito após conferência. Legacy não tem idempotência DB; pending pode exigir conciliação manual.

Oito SQLs candidatos: helperperm7/wrappertransfer8/plancore6revisado, NÃO APLICADOS; owner default/manage wrapper, requestadvisory antes team/group/slots, intentfingerprint receiptantesrebuild, snapshot fresh/tupledetach/historyagenda receipt transaction. service sem writes diretos em receipt até sob defaults permissivos. Escolha-team windows/blocks, POSTDELETE/allwriters, fasecontracts/distribuição/progresso/outbox/grantphantoms/retention reconciliation continuam pendentes.

99nativos finais:31coredefaultowner+33wrapperparityACLreplayracegrantrevocation+35inscrregressões, zero failures. Docker17.6 catálogo02:46UTC118tables818constraints74functions76triggers+18masks/2identities; Authrolesfixtures/views precisionACLinfra incomplete. 15backendparityfixtures rowsnativas/cap1; 6sessions1commit5replay/lockobserved, mesma equipe enrollmentrace2commits e revocationwait. Não stagingatual/PostgRESTAuthreal/networkloss/load1000/writersproof.

45transporte+17perms+23mobile=85fixtures/gate19suites typeslintbuildnpmprod0. 24browser DOMadaptado (10newmove+14directoryregressions), zero flaky/skipped; initial8fail seletorsemspace, correctedrepeated. Nativeinitialfixtures violated realunique, preservedlogs/fixedwithoutdroppingconstraints. Mobiletypes/exportJSAndroidpassed, não certifica device crypto/storage/layout. Auditorquick108OK/3warnings/0errors (2CSS+buildskipquick; fullgatebuildpassed). Whitespace0/HEADef9416e1. Inventory295sources178literalwrites35files7dynamic13oldfunctions18tables.

Rastreabilidade: primeirocore rerun reutilizou folder antigo e substituiu2JSONdetails, original logs/finalverification preserved, originalPIDdetails unavailable semfabricar. Currentcopy core-native-initial.json; outputarg3/README corrected. Note history-evidence-note.json. Laboratório próprioID76b74f0f/labelimage/network verified thenremovedwithownvolume; Dockerrestoredstopped/imagecachepreserved. SupabasereadswritesDDL/remoteenv/commitpushPRdeploy0. INVITE_ENROLLMENT_MODE legacy. DBR01P1/DBR02P2 stillpublished,20corrected6partial +2DB, QA/CSS/modules/agregados/deps/sandboxpending; publicação NÃO PRONTA. Evidências relatorios-testes/movimento-rpc-2026-10-11/.
Canvas atualizado: TypeScript estrito e idempotência aprovados, fonte gerenciada igual à validada. Abertura queued, sem prova de render. Hashes SQL/código/relatórios/canvas em relatorios-testes/movimento-rpc-2026-10-11/final-artifacts.json.

<!-- slot-transfer-context-end -->

<!-- group-choice-context-start -->
### Continuação de escolha de grupo e escopo administrativo — 11/10/2026

Escolher, cancelar e restaurar grupo por equipe/admin têm integração local preparada, sem ativação. SLOT_MOVEMENT_MODE e INVITE_ENROLLMENT_MODE continuam legacy. O nono candidato SQL, group_choice, depende dos helpers e plano revisados. Uma RPC usa ator da sessão, chave UUID, source_slot_id explícito e history_id do cancelamento exato, sem consulta prévia, retry automático, compensação ou fallback. Equipe precisa ser proprietária da participação ativa e respeitar janela/troca/bloqueios; restauração agora respeita o bloqueio do destino. Administração conserva a intervenção manual com janela fechada. Histórico, agenda, notificação e recibo pertencem à transação; falha da notificação reverte tudo. Replay recupera o resultado antes do estado/janela atuais; propriedade revogada ainda o impede.

ChampionshipCentral e AdvancedStructureTab compartilham hook e intenção/UUID em sessionStorage antes do envio, por conta/campeonato/equipe-ou-admin. Guardam só UUIDs, sem sessão, nomes ou notas. Uma pendência impede outra intenção; há confirmação após recarga e descarte local explícito depois de conferir slots, sem desfazer a operação no servidor. Outra aba não compartilha a tentativa automaticamente. Snapshots do servidor são vinculados à conta/recurso e setters de respostas antigas são ignorados. O teste novo encontrou que apenas ocultar o snapshot antigo apagava o atual; corrigido e repetido. Perfil legado é preservado só na mesma conta/recurso e permissão visual exige true explícito. Legacy ainda não oferece idempotência de banco.

STR01/P1 adicional corrigido localmente: exclusão genérica por ID e criação/vínculos/franquia sem validar campeonato/pais. A exclusão antiga foi reproduzida somente na fixture. Nove tabelas agora usam campeonato ou cadeia edição/etapa; DELETE confere o pai esperado e recusa zero rows/falhas. Criação e relações validam IDs antes de gravar. A ação normalizada validada é a mesma do dispatcher, incluindo o teste com espaços. Validação prévia não protege todas as mudanças concorrentes dos pais; reparenting e demais writers/locks ainda pendentes. Os 26 originais continuam 20 corrigidos/seis parciais, mais duas pendências de banco e STR01 corrigido localmente.

134 cenários nativos finais: 35 escolha + 31 plano + 33 transferência/permissões + 35 inscrição, zero falhas. Seis sessões/chave: um commit/cinco replays, espera por lock observada. Disputa de destino, fechamento durante espera, prazo encerrado por gatilho, histórico exato e falhas de histórico/notificação/recibo passaram. PostgreSQL 17.6, catálogo anterior 02:46 UTC, baseline 118 tabelas públicas/818 constraints/74 funções/76 gatilhos e masks/identities locais; Auth/roles fixtures, views/precisão/owners/infra incompletos. realtime.send é um capturador fictício de eventos transacionais para o gatilho nativo, sem certificação de entrega real. Primeiras falhas de schema Realtime e unicidade equipes_auth_user_unique corrigidas sem remover índices; logs preservados. Pastas de evidências explícitas, sem sobrescrever fase anterior.

125 fixtures no gate final: 52 transporte + 18 storage + 55 escopo. 24 browser: 14 novos web + dez regressões do app, zero flaky/skipped. Componentes/hook reais com auth/controles/icons/feedback/API adaptados; sem certificação visual integral ou dispositivo. Falhas iniciais do adaptador, seletores, option escondida, snapshot atual e tipagem de projeções corrigidas antes do final. Gate de 22 suítes, tipos, lint, build e npm produção zero aprovado. App não mudou e QA Android/dispositivo não repetido. Auditor rápido: 108 OK/3 avisos/zero erros (dois CSS, build pulado só no rápido; build completo aprovado). Inventário: 298 fontes, 178 writes literais/35 arquivos, sete alvos dinâmicos/13 funções antigas, 18 tabelas. Whitespace sem erros, HEAD ef9416e1.

Ainda faltam POST/DELETE de inscrições, shuffle/distribuição/progressão, transferência de line, reservas/pagamentos, pais/bloqueios/concessões/restrições concorrentes, tokens legados, recibos/retenção/conciliação/outbox, staging/PostgREST/Auth/Realtime reais, apps instalados e seis parciais de CSS/acessibilidade/módulos/agregados/dependências/QA. DBR01/P1 e DBR02/P2 permanecem no publicado; nove SQLs NÃO APLICADOS e publicação NÃO PRONTA. Nenhuma consulta/gravação/DDL de Supabase, mudança de ambiente, commit, push, PR ou deploy nesta etapa.

Laboratório próprio 3c4c9345 removido com seu volume após conferir ID/label/imagem/rede; Docker restaurado parado, cache da imagem preservado. Evidências em relatorios-testes/escolha-atomica-2026-10-11/. Relatório e canvas atualizados; TypeScript estrito/idempotência aprovados, fonte gerenciada igual à validada. Abertura queued, sem prova de render. Hashes e confirmação final em final-artifacts.json.
<!-- group-choice-context-end -->

<!-- slot-batch-context-start -->
### Continuação de sorteio/distribuição — 11/10/2026

Sorteio e distribuição no PATCH equipes têm candidato SQL/dispatcher backend preparados e NÃO ATIVADOS. Dez SQLs candidatos não aplicados; flags legacy. BATCH01/P1: limpeza ampla do legado apagou reserva na fixture, sem incidente real. Novo caminho recebe ator da sessão, UUID do header e snapshot completo id/slot/equipe/line/updated_at, conservando microssegundos. Uma RPC, sem pre-read/retry/compensação/fallback. Locks de equipes/grupos/fase pai/slots/lines/participações antes de comparar conjunto/versão. Reservas excluídas dos destinos e preservadas, posições utilizáveis equilibradas por grupo. Ordem fixa pela chave; replay anterior ao estado atual, gestão atual ainda obrigatória. Histórico/agenda/recibo transacionais. Administração mantém intervenção com inscrições/escolha fechadas; tokens/cotas/pagamentos intactos.

174 nativos finais: 40 batch (39 candidato/uma reprodução legado), 31 plano, 35 escolha, 33 transferência e 35 inscrição; zero falhas. Cinco reproduções antigas do plano também repetidas. Seis sessões/chave: um commit/cinco replays, lock observado; duas distribuições com o mesmo snapshot produzem uma confirmação/uma recusa. Reserva concluída durante espera preservada. Fixtures de capacidade e unicidade por fase corrigidas mantendo restrições; logs anteriores conservados. PostgreSQL 17.6, catálogo anterior de 02:46 UTC: 118 tabelas, 818 constraints, 74 funções e 76 gatilhos, mais masks e identities locais. Auth/roles são fixtures; views, precisão, owners e infraestrutura incompletos. Realtime usa capturador fictício. Não certifica staging, HTTP ou rede reais, nem carga de mil participantes.

68 fixtures HTTP e gate de 23 suítes, tipos, lint, build e npm produção zero passaram; auditor rápido com 108 OK, três avisos e zero erros. Inventário 299 fontes/178writes/35arquivos/7dinâmicos/13funções antigas/18tabelas, não prova todoswriters. UI/app não alterados; browser/device não repetidos. Batch tem só consumidores órfãos da Lili, sem import ativo; precisam snapshot completo/UUID persistida/contratos antes de ativar. Ainda POST/DELETE/revisão de inscrições/season/progressão/line/reserva/pagamento/pais/bloqueios/grants/recibos/conciliação/outbox/staging/QA e seis parciais. DBR01/P1 e DBR02/P2 continuam no publicado; os 26 originais têm 20 corrigidos e seis parciais, além de STR01 corrigido localmente. Publicação NÃO PRONTA.

Laboratório/volume próprios removidos após conferir identidade/label/imagem/rede; Docker restaurado parado/cache mantido. Nenhuma consulta, gravação ou DDL do Supabase, alteração de ambiente remoto, commit, push, PR ou deploy. HEAD ef9416e1 e whitespace sem erros. Evidências relatorios-testes/distribuicao-atomica-2026-10-11/; hashes finais em final-artifacts.json.
<!-- slot-batch-context-end -->

<!-- participation-context-start -->
### Continuação de participação e Liga — 11/10/2026

PARTICIPATION_WRITE_MODE default legacy; nova flag só no exemplo. Solicitar/adicionar/aprovar/rejeitar/remover têm uma RPC preparada, sem ativação. Ator da sessão, header UUID e corpo/snapshot filtrados (equipe/line/slot/status/updated_at, microssegundos). Sem pre-read/retry/compensação/fallback; season recusa atomic. Team request exige propriedade/atividade e No Ar/janela. Administração conserva adicionar/aprovar com inscrições fechadas. Quota direta sob advisory antes de equipe; conta origens Liga. Liga exige origem planejada/cota e equipe única. Aprovação mantém criado_por do pedido e não debita quota de adição direta do revisor, conservando regra antiga; política unificada de quotas ainda pendente.

Line/participação/espelho/agenda/auditoria/recibo atômicos; tabelas privadas, RLS/service somente leitura direta e execute backend. Revalidar visibilidade/janela/propriedade/permissão/row exata depois dos gatilhos. Replay anterior à janela/localização atuais exige acesso atual; equipe ainda deve ser proprietária da solicitação. Rejeitada reenviada com ID igual; remoção preserva histórico e reinscrição com outro ID. Clientes ativos web/app NÃO atualizados para UUID/corpo persistidos/snapshot/DTO de versão e confirmação após recarga/troca de conta. Nenhum cliente novo, UI ou browser/device QA nesta fase.

PAR01/P1 local: flags remover todas/próprias distintas, autoria/origem obrigatórias para próprias; workspace pode remover, seller real selecionado por ID e manager atual/ativo, sem depender de cache nulo (incompatível recusa). PAR02/P1 local: GET público read-only/no-store, No Ar/status antes do roster/tokens; limpeza de expirados removida, reserva expirada ainda exige writer autorizado. PAR03/P2 local: solicitação No Ar/política compartilhada de prazo e erro fail-closed; rj/review status/version CAS. Admin add/approve recusa reservado e contador seller inclui seis origens Liga. Erros DB sanitizados; legacy ainda multistatement e DBR01/P1 não aplicado.

LG01/P2 reproduzido no catálogo antigo: falta liga_divisoes e CHECK de origem recusa seis liga_* da UI. Migration local 20260814 não altera origem. Candidato12 compara a definição antiga validada, mantém oito origens e acrescenta seis Liga/quatro campos do plano/arrays. Aplicado SOMENTE no lab, sem relaxar fixture; recusa definição desconhecida/reaplicação. Exige schema atual/owners/preflight/staging. Candidato11 é participação. Doze SQLs NÃO APLICADOS ao Supabase, flags legacy. Rollback dos novos candidatos ainda pendente, não apagar dados; preferir forward.

233 nativos finais: 59 participação + 40 batch + 31 plano + 35 escolha + 33 transferência + 35 convite; zero falhas. Seis sessões/chave: um commit/cinco replays, lock observado. Corridas de slot/quota/review, rejeitar/reenvio/rejoin, dez falhas ação×audit/receipt, prazo cruzando gatilho, unpublish e mutação de row pelo gatilho passaram. Liga foi testada após instalar candidato guardado apenas no lab; ausência inicial recusa. Inscrição baseline em DB separado antes de seu rejoin guard. Catálogo02:46UTC, PG17.6 baseline118tabelas/818constraints/74funções/76gatilhos + masks/identities; Auth/roles/views/precisão/owners/infra não completos e Realtime fictício. Não staging/HTTP real/carga/device. Logs iniciais preservados.

83 fixtures HTTP, 20 permissões, gate24/tipos/lint/build/npm produção0; auditor rápido108OK/3avisos/0erros. Inventário 300 fontes/176 gravações/35 arquivos/7dinâmicos/13funções antigas/18tabelas, não prova todos writers. Originais20corrigidos/seis parciais + STR01/PAR01/02/03 locais; DBR01/DBR02 publicados e LG01 no snapshot. Ainda clientes/bulk/season/progressão/line/reservas/pagamentos/expirados/locks/pais/grants/bloqueios/recibos/retenção/outbox/staging/QA/layout/arquitetura. Publicação NÃO PRONTA. Laboratório/volume removidos, Docker parado/cache mantido. HEADef9416e1 e whitespace0. Sem consultas/gravações/DDL de Supabase, ambiente remoto, commit/push/PR/deploy. Evidências relatorios-testes/participacoes-atomicas-2026-10-11/ e hashes em final-artifacts.json.
<!-- participation-context-end -->

<!-- participation-clients-context-start -->
### Continuação atual: clientes de participação — 11/10/2026

Principais clientes web/app preparados **sem ativação**. Contrato puro compartilhado, sem dependência de servidor/credenciais no bundle; adapters de persistência separados. O actor da leitura é conferido com a conta atual antes de enviar. Guarda UUID/corpo original antes do HTTP, uma intenção por conta/campeonato, versão equipe/line/slot/status/updated_at com microssegundos e campos filtrados. Nova consulta não troca o corpo de uma tentativa incerta. Confirmação exige DTO explícito; falha de rede/DTO/limpeza mantém recuperação. Sem retry automático/fallback. Recarga e cliques consecutivos foram exercitados; mesma conta com token renovado conserva a confirmação. Descarte local exige conferência e não desfaz a operação do servidor.

GET de equipes/estrutura entrega versão somente a quem administra/remove, consulta CE paginada/escopada e recusa associação divergente. A versão de revisão vem da própria row exibida, sem substituir por revisão mais recente de leitura paralela. Resposta no-store; erros DB de estrutura sanitizados. Web Equipes/Estrutura/Lili usam transporte comum; lote de inclusão é sequencial e pode ficar parcialmente confirmado. App ChampionshipTeamsPanel integra adicionar/aprovar/rejeitar/remover, origem da Liga, reserva não selecionável e recuperação. Solicitação comum tem API cliente preparada; não houve novo fluxo de tela de solicitação.

**72 fixtures dos clientes +15 HTTP de acompanhamento =87 novas verificações**; 83 HTTP e20 permissões anteriores preservadas. Gate **26 suítes/tipos/lint/build/npm produção web zero**. Browser **30 cenários de estado/transporte +2 contratos estáticos**, final32/32 sem retries/skips/flaky. DOM adapta rendering/autenticação/storage nativos; não é QA de dispositivo ou layout nativo. Export JavaScript Android1066módulos e mobile typecheck passaram. App é instalado fora dos workspaces web: Metro SDK54 recebeu watchFolder explícita da pasta de contratos, conservando o default. [Referência Expo](https://docs.expo.dev/guides/monorepos/) e código instalado; export inicial falhou, final passou. Não houve atualização de dependências.

Histórico preservado: browser inicial24/26 por ícone sem área no adaptador, depois26/26; ampliação32 teve2 contratos legados desatualizados e1 timeout/fechamento Chrome, final32/32. Falha inicial do mock HTTP/sintaxe do script e caminho do redirecionamento corrigidos, sem relaxar regras de negócio. Scanner108OK/3avisos/0erros (dois CSS/build pulado só no scanner). Inventário 303fontes/176writes/35arquivos/7dinâmicos/13funções antigas/18tabelas; não certifica todos os escritores. Os **233 PostgreSQL anteriores não foram repetidos**; candidatos SQL intactos.

Armazenamento contém só intenção filtrada, UUIDs/versão e, se enviados, nome de line/motivo limitados a120/500caracteres; não contém sessão, token de convite, pagamento ou campos extras. Web persiste na aba; app usa SecureStore quando disponível e fallback AsyncStorage existente. Retenção/reconciliação, tamanho Unicode/limites reais do SecureStore e QA de dispositivo ainda exigem staging/device.

Originais20corrigidos/seis parciais mantidos; flags legacy e12 SQLs não aplicados. Ainda origem de Liga na Estrutura/Lili web, demais consumidores/bulk/season/movimentos, writers/locks, DBR01/DBR02/LG01 esquema atual/staging, quotas/recibos/retention/outbox, reservas/pagamentos e layout/arquitetura/QA. Publicação não pronta. Sem consultas/gravações/DDL Supabase, ambiente remoto, commit/push/PR/deploy nesta etapa. [Evidências](E:/dropzone-cadastros/relatorios-testes/clientes-participacoes-2026-10-11/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/clientes-participacoes-2026-10-11/check-release-verified.log) · [Browser](E:/dropzone-cadastros/relatorios-testes/clientes-participacoes-2026-10-11/browser-final.json).
<!-- participation-clients-context-end -->

<!-- liga-web-context-start -->
### Continuação atual: origens da Liga na Estrutura e Lili — 11/10/2026

Integração local de inclusão individual/lote na Estrutura e individual na Lili. Seletor compartilhado com label associado, origem planejada e cota disponível; mantém origem original em persistência/recuperação. Plano operacional privado retornado no GET de estrutura autorizado, com projeção de campos e sem consultar colunas Liga em campeonatos comuns. Liga sem configuração recusa; campos ausentes no banco continuam erro controlado e exigem candidato 12/preflight. A Estrutura deixou de buscar todo o roster novamente: remoção usa participação/versão do mesmo GET de estrutura. Não houve alteração de CSS.

Lote valida todas as escolhas/cotas/equipes/slots antes do primeiro POST, conta outras seleções do rascunho e envia sequencialmente. Cada linha confirmada sai do rascunho; a incerta conserva a intenção e UUID. Recuperação usa a mesma origem/corpo/chave após recarga. **O lote não é uma transação única.** Concorrência real e demais escritores continuam dependentes do banco. Troca de campeonato limpa rascunho; troca de perfil na Lili remonta a visão privada. Respostas antigas de detalhe/leitura são ignoradas. Reserva/bloqueio não selecionáveis na Lili; Estrutura deixa bloqueado fora das vagas livres.

**LG02/P2 adicional — parcial.** Normalização do plano e inclusão legacy agora recusam quantidades fracionárias/não finitas/não inteiras, booleanos/objetos e zero inválido, antes de gravar; agrupamento ambíguo ou sem origem também recusa. O SQL candidato 11 ainda permite quota decimal: a comparação contagem inteira versus 1.5 pode admitir duas inclusões. Este último risco é **análise estática**, não reprodução PostgreSQL nesta fase. Ajustar SQL/paridade e ampliar teste nativo antes de ativar; não corrigido no banco publicado. Os 12 scripts SQL preparados permaneceram iguais: 11 candidatos a alteração e um preflight de leitura. Nenhuma alteração foi aplicada.

**54 fixtures novas, gate com 27 suítes/tipos/lint/build/npm produção web zero; browser 46/46 =14 cenários novos +30 regressões de estado/transporte +2 contratos estáticos**, sem retries/skips/flaky no final. Harness executa os componentes reais com API/Auth/ícones/modais auxiliares fictícios e sem CSS integral; não comprova layout completo, staging, Auth/PostgREST/Realtime/rede/carga reais ou deviceQA. Android/export/mobile não repetidos; evidências anteriores permanecem históricas. Os 233 PostgreSQL anteriores também não foram repetidos.

Histórico preservado: browser 6/10 inicial, depois 10/14 ampliado, por expectativas/locators de origem null e texto acessível concatenado; correção nos testes, sem afrouxar regras. Scanner inicial: 106 OK/3 avisos/2 erros em subprocessos restritos de npm/TypeScript; execução autorizada: 108 OK/3 avisos/0 erros. Três avisos conhecidos: dois CSS e build pulado só no scanner; build completo aprovado no gate. Inventário: 305 fontes/176 writes/35 arquivos/7 dinâmicos/13 funções do catálogo antigo/18 tabelas, não prova todos os writers/locks. A inspeção confirmou que o gerenciador de slots e o distribuidor da Lili são consumidores ativos; referências anteriores a consumidores órfãos são históricas e não descrevem este estado.

Originais: 20 corrigidos/seis parciais mantidos. Flags legacy; publicação **não pronta**. São 12 scripts SQL preparados (11 candidatos e um preflight de leitura); a contagem anterior de doze candidatos incluía o preflight. Ainda LG02/paridade SQL/nativos, DBR01/DBR02/LG01/current schema/staging/owners/ACL, movimentos/distribuição e demais writers/season/progressão/reservas/pagamentos, locks/quotas/recibos/retenção/outbox, layout/arquitetura/QA integral e dispositivo. HEAD ef9416e1/whitespace zero. Nenhuma consulta/gravação/DDL Supabase, ambiente remoto, commit/push/PR/deploy nesta etapa.

[Evidências](E:/dropzone-cadastros/relatorios-testes/liga-web-2026-10-11/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/liga-web-2026-10-11/check-release-verified.log) · [Browser](E:/dropzone-cadastros/relatorios-testes/liga-web-2026-10-11/browser-final.json).
<!-- liga-web-context-end -->

<!-- liga-sql-context-start -->
### Continuação atual: cotas SQL da Liga — preparação pendente de validação nativa

O candidato de participação foi alterado localmente: exige agrupamento único/não vazio, valida todas as origens do agrupamento e aceita quantidades numéricas/textuais inteiras dentro do limite seguro9007199254740991. Recusa frações, negativos, tipos inválidos e soma por origem acima do limite; zero não cria vaga. Texto é validado antes do cast; zeros iniciais e whitespace ASCII são aceitos. Mantidos autorização, locks, recibos e replay anteriores, sem novos grants. A projeção/helper operacionais também recusam arrays usados como quantidade/origem, sem convertê-los em valores válidos.

**LG02 continua parcial.** Há99fixtures operacionais aprovadas (45 além das54 anteriores), TypeScript e lint dos arquivos alterados. As27suítes de segurança passaram com98casos Liga; depois uma fixture de whitespace elevou a suíte isolada para99. Corpus39variantes JSON compartilhado e91cenários nativos preparados para adicionar/aprovar, rollback, corrida pela última cota e replay depois de mudar o plano. Apenas sintaxe JavaScript/preparação foram verificadas. **Nenhum SQL novo foi compilado ou executado em PostgreSQL; a reprodução nativa do problema também não ocorreu.** Os233resultados nativos anteriores pertencem ao hash antigo; build/browser/Android não repetidos nesta fase.

**Bloqueio real:** revisão automática falhou por limite de uso ao criar o contêiner PostgreSQL17.6 isolado. O comando não foi executado; a revisão não concluiu nem classificou a ação como insegura. O Docker havia sido iniciado com aprovação e seus processos continuam ativos; nenhum contêiner da auditoria foi criado. A restauração do Docker ao estado parado continua pendente, junto com os testes nativos, até a revisão automática voltar a funcionar ou orientação do usuário. Não contornar a revisão usando outra ferramenta.

Backup/diff/hash do candidato anterior preservados. Dos12scripts SQL preparados (11candidatos e1preflight), somente participação foi alterado; os11outros arquivos continuam iguais aos hashes anteriores. Nenhuma aplicação no Supabase, leitura/gravação/DDL remota, alteração de ambiente remoto, commit/push/PR/deploy. Flagslegacy; publicação não pronta. Originais20corrigidos/seis parciais mantidos; DBR01/DBR02/LG01/schema atual/owners/ACL/staging/outroswriters/quotas/recibos/retention/outbox/layout/arquitetura/QA integral e dispositivo seguem pendentes.

Consultadas as skills Supabase e PostgreSQL e a documentação primária de [funções](https://supabase.com/docs/guides/database/functions), [JSON PostgreSQL17](https://www.postgresql.org/docs/17/functions-json.html) e [literais/escapes](https://www.postgresql.org/docs/17/sql-syntax-lexical.html). Changelog markdown indisponível; HTML consultado. Estado atual do servidor Supabase não consultado nesta fase.

[Evidências locais](E:/dropzone-cadastros/relatorios-testes/liga-sql-2026-10-11/final-verification.json) · [Preparação/nativos não executados](E:/dropzone-cadastros/relatorios-testes/liga-sql-2026-10-11/preparation-check.json) · [Fixtures99](E:/dropzone-cadastros/relatorios-testes/liga-sql-2026-10-11/liga-fixtures-final.log) · [Diff SQL](E:/dropzone-cadastros/relatorios-testes/liga-sql-2026-10-11/candidate.diff).
<!-- liga-sql-context-end -->

<!-- liga-manual-context-start -->
### Encaminhamento atual: execução local pelo usuário

O usuário escolheu: “Vou executar os comandos locais preparados”. Não reexecutar por conta própria as ações bloqueadas pela revisão automática. Controlador [run-liga-validation.ps1](E:/dropzone-cadastros/scripts/testes/postgres-inscricoes/run-liga-validation.ps1) preparado para uma execução manual na raiz. Parser PowerShell e -CheckOnly passaram; execução Docker/SQL ainda não feita.

Contexto Docker Desktop Linux local explícito/endpoint npipe, imagem17.6 em cache sem pull/rede/portas publicadas. Recusa contêiner preexistente; somente o ID criado nesta execução com labels exatos pode ser removido, com volumes próprios. Logs e run-result.json em pasta nova liga-sql-exec-UTC-sufixo. Bancos distintos para baseline/candidato/regressão/plano;324casos previstos (59participação/91Liga/40batch/35escolha/33transferência/35convite/31plano). As reproduções antigas ficam separadas. Falha interrompe etapas seguintes e tenta limpeza; Docker será solicitado a parar quando não houver outros contêineres ativos. Envs anteriores restauradas.

Reprodução do candidato antigo passou a exigir banco/pasta explícitos e usa a função salva somente no banco baseline. Corrigidos nome real native-transfer.json, espaços nos comandos PowerShell e guarda de portas sem bindings antes de entregar. Nenhum teste nativo executado nesta preparação; LG02 continua parcial, flagslegacy, SQL não aplicado, sem produção/GitHub/Vercel. Aguardar resultado do usuário, examinar logs/hashes e corrigir qualquer falha antes de atualizar os achados como validados.
<!-- liga-manual-context-end -->

<!-- liga-native-context-start -->
### Continuação atual: Liga SQL validada em laboratório — execução manual verificada

**324 testes nativos passaram, zero falhas:** 59 participação  +91 cotas Liga +40 batch +35 escolha +33 transferência +35 convite +31 plano. O usuário executou o controlador no PowerShell; foram conferidos os sete JSONs, contagens/listas de resultados e hashes registrados. SHA256 do candidato coincide com as suítes de participação/Liga e o arquivo local atual. **LG02 foi corrigido e validado no candidato local**, ainda sem aplicação no banco publicado. Baseline antigo reproduziu duas inclusões com quota 1.5; as91 verificações recusam frações/tipos inválidos/somas inseguras/grupos ambíguos, preservam rollback, disputam última cota e repetem o resultado original após mudança do plano. Cinco reproduções antigas do plano ficam separadas do total 324.

**Falha real do controlador, corrigida:** depois de todas as suítes passarem, a soma por Measure-Object -Property passed não reconheceu as chaves dos hashtables no Windows PowerShell. Por isso run-result.json ficou nativeCompleted=false/passed 0, sem invalidar os resultados SQL. O resumo original foi preservado; foi criado resultado reconciliado com 324/0 após conferir provas individuais. Controlador agora soma chaves em foreach; as próprias instruções extraídas do arquivo foram executadas contra sete registros reais em **Windows PowerShell 5.1.19041.6456 e PowerShell 7.6.5**, obtendo 324. Não repetir PostgreSQL para esse ajuste de relatório.

**Limpeza confirmada:** ID/labels/imagem/rede none/ausência de portas publicados conferidos com inspeção salva. Contêiner 1c8d7818... e volume próprio 916e6d18... removidos, verificações de ausência vazias, nenhum outro contêiner ativo e Docker solicitado a parar. Leitura local posterior observou zero processos Docker Desktop/com.docker.backend; cache mantido. O bloqueio anterior da revisão automática foi atendido por execução manual escolhida pelo usuário, sem contorná-lo por ferramenta do agente. Não há laboratório ativo nem restauração pendente.

Laboratório PostgreSQL 17.6, catálogo anterior de 02:46 UTC: 118 tabelas/818 constraints/74 funções/76 gatilhos/18 masks e identities locais. Auth/roles sintéticos; views, precisão, owners/ACL e infraestrutura incompletos. Realtime com capturador fictício. **Não certifica schema atual/staging/Auth/PostgREST/Realtime/rede/carga/device reais.**99 fixtures operacionais/gate com 27 suítes/tipos/lint/build/browser anteriores são históricos; build/browser/Android não repetidos neste acompanhamento. SQL permaneceu no hash testado.

Originais: 20 corrigidos/seis parciais mantidos. Flags legacy;11 candidatos SQL e 1 preflight preparados, nada aplicado ao Supabase nesta etapa. Nenhuma consulta/gravação/DDL de produção, ambiente remoto, commit/push/PR/deploy. Ainda DBR01/P1 e DBR02/P2 no publicado, LG01/schema atual/owners/ACL/preflight/staging/aplicação revisada, outros writers/consumidores ativos/season/progressão/reservas/pagamentos/expirados, locks/quotas/recibos/retenção/outbox, layout/arquitetura/QA integral e dispositivo. **Publicação não pronta.**

[Resultado reconciliado](E:/dropzone-cadastros/relatorios-testes/liga-sql-validada-2026-10-11/reconciled-run-result.json) · [Original preservado](E:/dropzone-cadastros/relatorios-testes/liga-sql-exec-20261012015537-a5fe/run-result.json) · [Windows PowerShell 5.1](E:/dropzone-cadastros/relatorios-testes/liga-sql-validada-2026-10-11/controller-summary-windows-powershell.json) · [Docker encerrado](E:/dropzone-cadastros/relatorios-testes/liga-sql-validada-2026-10-11/docker-process-state.json).
<!-- liga-native-context-end -->

<!-- lili-movement-context-start -->
### Continuação atual: movimentação Lili e recuperação — preparação local

Move/swap/shuffle e distribuição equilibrada/aleatória usam contrato puro, persistência e recuperação compartilhada. **No modo atomic**, a intenção normalizada e UUID ficam em sessionStorage por conta/campeonato antes do PATCH, sem tokens/campos extras; replay explícito conserva corpo/chave mesmo após recarga e nova leitura. Sessão/ator da leitura são conferidos, token é renovado para o envio e DTO incompleto conserva pendência. Encerrar após conferência limpa somente a tentativa local, sem compensação no servidor. O armazenamento é desta aba, não entre abas/dispositivos nem após fechá-la.

GET estrutura fornece snapshots privados/no-store, paginados e restritos à gestão, independentemente da flag de inscrições; leitura compartilhada evita duplicação. **Dados preenchidos para exibição não valem como prova do espelho bruto:** divergência, espelho vazio ou versão inválida retornam null. Sorteio/distribuição enviam conjunto completo id/slot/equipe/line/updated_at, preservando microssegundos. Move/swap enviam os ocupantes/slots originais; a RPC existente compara identidade dos ocupantes, não updated_at fornecido pelo cliente. A confirmação desses dois modos usa seu DTO explícito existente, sem inventar operation_confirmed.

Lease e guardas de pendência impedem cruzar inscrição/movimento nesta aba web; cliques atômicos idênticos compartilham uma requisição, intenções diferentes recusam. Mudança de conta/perfil/campeonato e desmontagem invalidam callbacks. Distribuição trava fase/método/grupos durante confirmação/envio.

**Correção de classificação/acesso:** navegador confirmou move/swap/shuffle acessíveis, mas distribuição estava numa aba config sem navegação. Referências anteriores a quatro consumidores ativos não descreviam o estado real. Distribuição agora está em Grupos **somente quando o modo atomic estiver ativado**; com flags legacy continua oculta. Sorteio Lili legacy passa a recusar grupos com reserva/bloqueio antes do HTTP. BATCH01 do backend/outros clientes não fica globalmente resolvido por essa guarda.

**Validação final:** 28 suítes no gate, tipos, lint web/backend, build e npm produção zero aprovados. 95 fixtures de cliente +25 de leitura HTTP +72 regressões de inscrições; 105 verificações novas em relação ao gate anterior. **72 cenários de navegador =28 novos Lili +44 regressões; dois contratos estáticos separados, total 74**, zero falhas/retries/skips/flaky. Scanner 108 OK/3 avisos/0 erros (dois CSS e build pulado só no scanner; build completo no gate). Inventário 307 fontes/176 writes/35 arquivos/7 dinâmicos/13 funções do catálogo histórico/18 tabelas, sem provar todos os writers/locks.

Histórico preservado: subprocesso Playwright restrito EPERM antes dos testes; execução autorizada inicial revelou distribuição inacessível; depois 24/24 passaram. Ampliação com 72 cenários parou 20 aprovados/1 falha por ícone fictício vazio sem área de clique; dimensões corrigidas no harness. Final 72+2 passou. Componentes reais com Auth/HTTP/ícones/confirmação/API adaptados e CSS não integral; não certifica staging/Auth/PostgREST/Realtime/rede/carga/device, todas as 43 rotas/111 estados/contraste/a11y/modais ou arquitetura integral. App/export/Android/instalador não repetidos.

**SQLs iguais aos hashes anteriores:** 11 candidatos não aplicados e 1 preflight de leitura. Os 324 nativos continuam históricos, sem nova execução SQL nesta fase. LG02 já validado no candidato local; flags legacy e publicação não pronta. Servidor local de fixtures encerrado/porta 43197 sem listener; Docker não iniciado, nenhum processo Desktop/backend observado. HEAD ef9416e1 e whitespace zero. Nenhuma consulta/gravação/DDL Supabase, ambiente remoto, commit/push/PR/deploy nesta etapa.

Originais: 20 corrigidos/seis parciais mantidos. Ainda DBR01/DBR02 publicados, LG01/schema atual/owners/ACL/preflight/staging/aplicação revisada, demais consumidores/writers/concorrência entre famílias no app, season/progressão/lines/reservas/pagamentos/expirados, phantoms/locks/quotas/recibos/retenção/conciliação/outbox e QA integral/layout/acessibilidade/arquitetura/dependências/device.

[Evidências](E:/dropzone-cadastros/relatorios-testes/lili-movimentos-2026-10-11/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/lili-movimentos-2026-10-11/check-release-final.log) · [Navegador 72](E:/dropzone-cadastros/relatorios-testes/lili-movimentos-2026-10-11/browser-verified.json) · [Contratos 2](E:/dropzone-cadastros/relatorios-testes/lili-movimentos-2026-10-11/static-final.json).
<!-- lili-movement-context-end -->

<!-- mobile-concurrency-context-start -->
### Continuação atual: concorrência do app e confirmação de movimentos — 12/10/2026

**Inscrições e movimentos do app compartilham o mesmo controle do web**, extraído para módulo puro. Ele cobre leitura, persistência, HTTP e descarte explícito local no app. Ações atômicas idênticas compartilham uma requisição; outra intenção/família é recusada. Uma inscrição pendente bloqueia move/swap, e um movimento pendente bloqueia adicionar/solicitar/aprovar/rejeitar/remover, inclusive no legacy. Duas pendências antigas simultâneas exigem conferência e encerramento explícito de uma; nenhum envio ou compensação automático. O controle é local ao runtime, sem garantir exclusão entre aparelhos/abas/servidores.

O app agora recebe modo/ator da leitura. **Atomic** guarda UUID/corpo original no namespace existente e exige confirmação completa de campeonato/ação/slots/participantes antes de encerrar. **Legacy** envia sem chave nem registro de tentativa; uma pendência atômica retida bloqueia nova ação legacy e mantém encerramento após conferência. A sessão é conferida antes/depois da persistência e o bearer atual é usado. Esse vínculo do cliente não substitui autorização de servidor: [getSession lê a sessão do armazenamento](https://supabase.com/docs/reference/javascript/auth-getsession); getBearerUser/permissão/RPC permanecem responsáveis pela autorização.

GET equipes privado/no-store fornece versões apenas à gestão autorizada, independentemente da flag de participação. Snapshots e **espelho físico de slots** são paginados e restritos ao campeonato. A view de exibição não serve sozinha de prova: espelho vazio/divergente/não ocupado, versão inválida ou participação órfã retornam snapshot null. Componente valida origem/destino ocupados antes do diálogo. A RPC move/swap continua comparando IDs dos ocupantes/slots originais, não updated_at enviado pelo cliente; não afirmar CAS completo da versão exibida.

Renovar token preserva seleção/recurso. Conta/campeonato usam revisão monotônica, inclusive ida/volta A→B→A; fechar painel invalida callbacks. Descarte confere sessão/tentativa atuais e não faz HTTP. Remoção ignorada pelo armazenamento é detectada; limpeza falha após confirmação conserva recuperação. SecureStore/AsyncStorage continuam no adaptador existente; Map/localStorage dos testes não certificam implementação nativa ou criptografia.

**Validação final:** gate de 29 suítes, tipos web/mobile, lint web/backend, build e npm produção web zero aprovados. 138 novas fixtures de operações +42 HTTP (17 adicionais); 155 verificações novas no gate. Regressões72 inscrições/23 transferência/95 movimento web repetidas. **106 cenários de navegador =20 novos +86 regressões, além de 2 contratos estáticos; total 108**, zero falhas/skips/flaky/retries no resultado final. Três repetições isoladas da Liga ficam fora desse total. Scanner 108 OK/3 avisos/0 erros; dois CSS e build pulado só no scanner, build completo no gate. Inventário 308 fontes/176 writes/35 arquivos/7 dinâmicos/13 funções antigas/18 tabelas, sem provar todos os writers/locks.

**Android JS exportado:** 1072 módulos, bundle 4.39 MB (4388335 bytes), hash registrado. Não é APK/iOS assinado, execução instalada ou deviceQA. Componentes reais com Auth/HTTP/armazenamento/Alert/nativeDOM adaptados, sem CSS integral; não certifica 43 rotas/111 estados/contraste/a11y/modais/arquitetura completos, Auth/PostgREST/Realtime/staging/rede/carga/dispositivo/OBS reais. Dependências mobile/desktop e auditorias npm desses pacotes não repetidas.

Histórico preservado: cenário novo parou com 3 aprovados/1 falha por label esperado incorreto, corrigido no teste, depois 20/20. Regressão completa teve setup/teardown de page interrompido antes da ação; retomada depois do build com inicialização de 90 s. Duas expectativas antigas de storage corrigidas (40/1 e 48/1), sem afrouxar zero HTTP. Lote Liga interrompeu em 55/1 com confirmação ainda Salvando em 5 s; trace registra POST 200 e segundo POST ERR_FAILED. Passou três vezes isolado com espera de 15 s, usado no final 108/108; causa exata da demora não comprovada e nenhuma correção da aplicação atribuída a ela. Expectativas funcionais conservadas; retries 0.

**SQLs iguais aos hashes anteriores:** 11 candidatos não aplicados e 1 preflight preparado. Os 324 nativos continuam históricos, sem execução SQL nova; LG02 validado só no candidato local. Flags legacy, publicação não pronta. Servidor local de fixtures encerrado/porta 43197 sem listener; Docker não iniciado e zero processos Desktop/backend observados. HEAD ef9416e1/whitespace zero. Nenhuma consulta/gravação/DDL Supabase, ambiente remoto, commit/push/PR/deploy.

Originais: 20 corrigidos/seis parciais mantidos. Ainda DBR01/DBR02 publicados, LG01/banco atual/owners/ACL/preflight/staging/aplicação revisada, outros writers/season/progressão/lines/reservas/pagamentos/expirados, compatibilidade de flags/cache/rollback, phantoms/locks/quotas/recibos/retenção/conciliação/outbox e revisão integral/layout/acessibilidade/arquitetura/dependências/dispositivo. Esta etapa conclui a frente de concorrência dos **clientes principais**, não o bloco completo de escritores.

[Evidências](E:/dropzone-cadastros/relatorios-testes/mobile-concorrencia-2026-10-12/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/mobile-concorrencia-2026-10-12/check-release-initial.log) · [Navegador](E:/dropzone-cadastros/relatorios-testes/mobile-concorrencia-2026-10-12/browser-confirmed.json) · [Android JS](E:/dropzone-cadastros/relatorios-testes/mobile-concorrencia-2026-10-12/android-export/metadata.json).
<!-- mobile-concurrency-context-end -->

<!-- atomic-routes-context-start -->
### Continuação atual: troca de flags e versões de servidor — 12/10/2026

**AT01/P1 de integração corrigido na preparação local:** operações que receberam contrato atomic usam URLs próprias de participação e movimento. O servidor autentica bearer antes de exigir a flag/família correta; desativação/valor inválido retorna 503/no-store sem leituras ou gravações legadas. Corpo de outra família é rejeitado. Uma versão sem essas rotas pode responder 404/405; o cliente mantém a tentativa e não reenvia para a URL antiga. UUID/corpo original, recuperação explícita e confirmação por DTO completo continuam obrigatórios.

A URL canônica continua compatível com clientes históricos, inclusive os que já enviavam Idempotency-Key no legacy. A chave sozinha não serve de negociação de modo: fixture da remoção legacy confirmou leitura e chamada de remoção com chave presente. **Clientes antigos nessa URL não recebem proteção retroativa.** Novas rotas de participação e movimento exigem flags independentes, verificadas inclusive com a outra flag inválida. No PATCH canônico legacy, permissão de gestão continua antes da leitura do corpo. Cabeçalho interno identifica protocolo; autorização permanece no servidor/RPC. Configurações locais Next/Vercel não reescrevem os novos caminhos para a URL antiga; proxies/deploy antigo real não foram testados.

**Validação:** 122 novas fixtures HTTP com SDK e handlers reais, Auth/recibos/armazenamento controlados. Cobrem seis formas de inscrição, quatro movimentos, flag legacy/ausente/inválida, família errada, chave ausente, RPC ausente, perda após commit e replay original. Gate de 30 suítes, tipos web/app, lint web/backend, build com as duas rotas e npm de produção web/root zero. Navegador final: **114 runtime + 2 contratos estáticos = 116**, oito novos/106 regressões runtime, zero falhas/skips/flaky/retries. Os oito iniciais também passaram; são execução adicional e não entram duas vezes no total final. Respostas HTML 503/404/405 preservam a recuperação em ambos os clientes/famílias. Timeout de expectativas15s/setup90s.

**Inventário mais amplo:**311 fontes,486 writes literais/90 arquivos/90 tabelas, sete destinos dinâmicos e26 chamadas RPC. O inventário focado conserva176 writes/35 arquivos/18 tabelas e13 funções do catálogo antigo; escopos diferentes, não aumento de falhas. É análise AST local, não prova de reachability/dataflow/SQL completo ou ordem de locks.

**Quatro fluxos revisados ainda exigem correção transacional:** sugestões de season validam e inserem em sequência; aplicação de progressão marca execução aplicada antes de gravar destino/origem/itens/snapshot; reversão restaura vínculos em requisições separadas e algumas restaurações não conferem versão/execução atual; estrutura ainda combina writes/compensações e validação prévia de pais sem locks. Esses riscos vêm do código, não de incidente ou reprodução concorrente nativa. Cada branch, linha, hash, consequência e próximo passo está no inventário ampliado. A recusa de season pela flag de participação atomic continua existente; a nova URL não torna esses fluxos transacionais.

Histórico de falhas preservado: fixture avulsa de movimento esperava HTTP em15ms; substituída por evento de entrada com limite5s, sem alteração do lease. Primeiro gate tinha expectativa antiga de503 para review_request sem dados sob a flag de movimento; agora400 da participação/zeroRPC. Segundo gate detectou JSON antes da permissão no PATCH legacy; ordem restaurada e teste original preservado. Gate final aprovado. Componentes/HTTP/Auth/nativeDOM adaptados não certificam staging, PostgreSQL paralelo, rede/carga, SecureStore/dispositivo,43 rotas/111 estados/modais/contraste/a11y/arquitetura completos. Export Android anterior é histórico e não foi refeito para estes novos caminhos; auditorias npm mobile/desktop/full web anteriores não repetidas.

**Banco e publicação:**12 SQLs com hashes iguais,11 candidatos de alteração e1 preflight não aplicados;324 PostgreSQL históricos, sem reexecução/Docker. Flags legacy e HEAD ef9416e1. Sem consultas ou gravações Supabase remoto/produção, ambiente remoto, commit/push/PR/deploy. Ainda DBR01/DBR02 publicados/LG01/banco atual/ACL/staging, demais writers/reservas/pagamentos/expirados, convites/escolha de grupo/versões/cache/rollback e seis parciais originais. Originais20 corrigidos/seis parciais mantidos. Esta frente protege os clientes atualizados; o bloco inteiro de escritores permanece aberto.

[Evidências](E:/dropzone-cadastros/relatorios-testes/contrato-atomico-2026-10-12/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/contrato-atomico-2026-10-12/check-release.log) · [Navegador](E:/dropzone-cadastros/relatorios-testes/contrato-atomico-2026-10-12/browser.json) · [Writers ampliados](E:/dropzone-cadastros/relatorios-testes/contrato-atomico-2026-10-12/writers-expanded.json).
<!-- atomic-routes-context-end -->

<!-- current-db-context-start -->
### Banco alvo e prévia de progressão — 12/10/2026

**Banco atual consultado somente em leitura.** O projeto DropZone foi confirmado pela URL pública configurada. Foram quatro transações somente leitura, duas consultas aos Advisors e uma listagem de projetos, sem alteração de dados, SQLs, Auth ou ambiente remoto. Catálogo obtido às 04:26 UTC (01:26 em São Paulo); permissões, preflight e população às 04:31–04:32 UTC (01:31–01:32). São 118 tabelas, 14 views, 1910 colunas, 818 constraints, 453 índices, 76 gatilhos, 74 funções e 46 policies. Nomes de tabelas/colunas, definições de constraints/índices, policies normalizadas e assinaturas/MD5s das 74 funções correspondem ao catálogo de 11/10. Owners, ACLs, tipos exatos, identity/generated, máscaras dos gatilhos e definições das views agora têm evidência atual. É metadado de catálogo, não pg_dump, backup de dados ou certificação de staging/infraestrutura.

As 118 tabelas públicas têm RLS. Nenhuma das 74 funções permite EXECUTE a anon/authenticated; 53 usam SECURITY DEFINER. As 13 views com SELECT público têm security_invoker=true; uma view privada não permite SELECT público. Os Advisors retornaram 84 avisos informativos de RLS sem policy, 191 FKs sem índice de suporte, 32 índices apontados como não usados e limite fixo de 10 conexões do Auth. RLS sem policy nega linhas ao cliente por padrão; o acesso administrativo deve continuar autorizado no backend. Não criar policies genéricas nem adicionar/remover índices em lote para apagar avisos: performance exige planos, carga e dependências. [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) · [FK sem índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).

**As dez contagens de anomalia deram zero**, sobre 3 campeonatos, 14 participações ativas e 456 slots. Há zero vínculos de etapa e execuções de progressão no agregado observado. Nenhum ID ou dado pessoal de usuários foi exportado. Zero não prova concorrência nem invariantes não consultadas. O preflight com várias SELECTs devolveu apenas suas contagens finais; metadados foram registrados em consultas separadas. **DBR01 e DBR02 continuam presentes:** liberação insegura no gatilho de espelho e índice único campeonato/line sem filtro de status. **LG01 foi confirmado:** faltam estrutura_planejada, liga_usa_divisoes, liga_nome_agrupamento e liga_divisoes, e a constraint de origem não aceita valores liga. Quatro RPCs dos candidatos continuam ausentes. Os 11 candidatos não foram aplicados; 12 hashes SQL iguais e 324 testes nativos históricos preservados.

**PR01/P2 corrigido na preparação local.** A prévia anterior subestimava ocupação e conflitos quando a API cortava a lista. Capacidade zero era tratada como ilimitada, contrariando o gatilho publicado. Duas reproduções com a função anterior e HTTP sintético confirmaram: dois vínculos ocupados com limite de uma linha na API viravam occupied=1, available=1 e canApply=true; capacidade zero virava null e canApply=true. A prévia foi extraída para backend/src/campeonatos/progression-preview.ts. Regra, origem, destino e participantes são filtrados pelo campeonato; vínculos de destino têm paginação ordenada por ID e participantes usam IN com até 150 IDs. Última fase/execução têm ordem estável e limit 1. Faixas, ranking, duplicidade, capacidade e identidades são validados; falha tardia não produz sucesso parcial e erros privados são ocultados. A resposta da prévia usa no-store. NULL continua ilimitado; zero significa zero vagas. A aplicação legada rejeita excesso conhecido antes de criar a execução.

**A aplicação e a reversão continuam sem transação única.** Leituras separadas e paginação por offset não compartilham um snapshot; outro escritor pode mudar o plano durante a leitura. Aplicar/reverter ainda usam gravações separadas, sem locks, CAS e recibo completo. A FK explícita foi conferida no catálogo atual; join e filtro foram verificados na documentação, SDK e fixtures, sem chamada à nova função via PostgREST remoto. loadStructure, temporada, alterações de estrutura e demais escritores continuam pendentes. [Joins e filtros](https://supabase.com/docs/guides/database/joins-and-nesting) · [Funções no banco](https://supabase.com/docs/guides/database/functions).

**Verificação final:** 57 checks, sendo 55 permanentes e duas reproduções históricas; gate com 31 suítes, tipos web, lint web/backend, build e npm de produção web/root zero aprovados. O gate inicial executou 55 antes dos dois testes finais; tipos/lint/build verificaram o código final, e as 31 suítes foram repetidas com 57. Oito contratos estáticos de progressão/histórico passaram, sem falhas ou retries. Nenhuma nova abertura runtime de navegador; tipos mobile, exportação Android e QA de aparelho/instalador não foram repetidos para esta alteração de backend. Auth, HTTP e estatísticas adaptados não certificam concorrência real, staging, carga, todas as páginas/modais ou acessibilidade.

Histórico preservado: a fixture antiga recebeu o objeto de estatísticas em vez da função, corrigido no teste; a inferência de join como array recebeu tipo explícito com validação runtime. O teste de overflow encontrou fallback não validado, corrigido no código. NaN vira NULL no JSON, então a fixture passou a usar um booleano inválido. A simulação de vínculo estrangeiro passou a ignorar somente seu filtro de campeonato. Todos os logs iniciais foram conservados e os resultados finais passaram.

**Infraestrutura:** o servidor atual informa PostgreSQL 17.6. [O Supabase documenta atualização para 17.11 com correções de segurança](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). Não há índices ltree, chaves GiST float ou estimadores customizados no catálogo consultado. Nenhuma das 74 funções públicas ou código local pesquisado usa PGP; clientes externos e outros schemas não foram certificados. Não foram feitas provas de decifração, reindexação ou upgrade. Confirmar release elegível, backup, staging e janela antes de alterar a infraestrutura.

Os 20 achados originais corrigidos e seis parciais continuam registrados. Flags legacy, HEAD ef9416e1, whitespace zero, Docker parado e porta 43197 sem listener. Sem gravações remotas, commit, push, PR ou deploy. A leitura do catálogo atual avançou; backup completo, staging, aplicação revisada dos candidatos, DBR01/DBR02/LG01, escritores de temporada/progressão/estrutura, compatibilidade de rollout e os seis parciais ainda impedem considerar a publicação pronta.

[Evidências](E:/dropzone-cadastros/relatorios-testes/banco-atual-2026-10-12/final-verification.json) · [Comparação atual](E:/dropzone-cadastros/relatorios-testes/banco-atual-2026-10-12/catalog-comparison.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/banco-atual-2026-10-12/check-release.log) · [Segurança final](E:/dropzone-cadastros/relatorios-testes/banco-atual-2026-10-12/security-final.log) · [Contratos](E:/dropzone-cadastros/relatorios-testes/banco-atual-2026-10-12/static.json).
<!-- current-db-context-end -->

<!-- structure-read-context-start -->
### Leitura da Estrutura Avançada — 12/10/2026

**STR02/P2 corrigido localmente.** Listas de grupos, slots, etapas e outros componentes da Estrutura Avançada eram lidas em uma só requisição. Um limite baixo da Data API podia esconder linhas, inclusive no histórico e nos itens de progressão. Três reproduções da função anterior, com dados fictícios e SDK/HTTP controlados, confirmaram o corte em uma linha, dez consultas simultâneas ao Auth para dez responsáveis e e-mail privado usado como rótulo quando não havia nome. São reproduções locais; não há incidente demonstrado com usuários reais.

O leitor foi extraído para [advanced-structure-read.ts](E:/dropzone-cadastros/backend/src/campeonatos/advanced-structure-read.ts). As coleções completas têm paginação, ordenação de apresentação com desempate por ID e filtros de campeonato/edição/etapa/execução. Filhos usam lotes de até 150 IDs, com ordem global reconstruída entre lotes. A resposta é conferida quanto a IDs, escopo e duplicatas. O histórico continua limitado às últimas 500 escolhas e 30 execuções, agora preenchidas por páginas mesmo sob um limite menor da API; todos os itens das execuções selecionadas são carregados. Não é histórico ilimitado. A busca dos nomes dos responsáveis é deduplicada e limita a oito chamadas simultâneas por carregamento; indisponibilidade do Auth usa o rótulo alternativo anterior. E-mail privado do Auth deixou de ser usado como nome; sem nome público, a resposta usa o identificador genérico. Os 72 campos consultados e a unicidade da edição foram conferidos no metadado atual já salvo, sem novas chamadas remotas.

**GET exige autenticação/permissão antes de carregar as listas**, usa no-store em sucesso e erro, e oculta diagnósticos privados. As quatro recargas de estrutura após gravação também usam o novo leitor. Não houve alteração da UI; o DTO permanece compatível, com campeonato_id nas quatro seleções que precisam conferir escopo. Essa extração reduz lógica da rota; não encerra a dívida de arquitetura.

**122 checks permanentes e três reproduções históricas passaram.** Cobertura de 16 coleções, cap de uma linha, falhas em páginas seguintes, IDs estrangeiros/duplicados, mais de 300 etapas com IN até 150, histórico de 501 escolhas/31 execuções recortado para 500/30 e 701 itens de uma execução, ordenação global, Auth com no máximo oito chamadas, rótulos alternativos, ausência do e-mail privado na resposta GET do caso sem nome, visitante/sessão inválida/permissão negada, no-store e privacidade dos erros. Gate completo com 32 suítes, tipos web, lint web/backend, build e npm de produção web/root zero aprovado. Dez contratos estáticos de progressão/histórico passaram, sem falha, retry, skip ou teste flaky. Não houve novo navegador runtime; testes usam código real com serviços adaptados, sem PostgREST remoto ou concorrência PostgreSQL. Mobile, exportação Android, npm mobile/desktop/full web e QA de aparelho/instalador não foram repetidos.

Histórico preservado: o primeiro gate passou as suítes, mas TypeScript apontou quatro chamadas ao nome antigo deixadas na extração. Todas foram corrigidas e o gate completo foi repetido. O primeiro teste avulso passou com dez diagnósticos esperados do SDK para a falha fictícia de rede Auth; a fixture passou a capturá-los e conferi-los nesse caso específico, restaurando console.error. O logging da aplicação não foi alterado. Depois, foi removido o uso do e-mail privado como nome e o gate completo e os contratos estáticos foram repetidos no código final.

**Leitura paginada não é snapshot transacional.** Consultas separadas podem observar alterações entre páginas. IDs repetidos são recusados, mas isso não detecta todos os estados mistos. Uma recarga pode falhar depois de uma gravação legada já persistida; erro não significa rollback e esta etapa não torna a repetição idempotente. Aplicar/reverter progressão, temporada, alterações/exclusões de estrutura e demais escritores continuam exigindo transação, locks/versões, recibos/reconciliação/outbox. Esta correção fecha o corte das listas do leitor, não o bloco inteiro de gravações.

Inventário atual: 313 fontes; no escopo focado, 176 writes literais/35 arquivos/18 tabelas, sete destinos dinâmicos e 13 funções do catálogo histórico. O escopo ampliado conserva 486 writes/90 arquivos/90 tabelas e 26 chamadas RPC. Linhas e hashes dos fluxos revisados foram atualizados; análise estática não prova todos os escritores ou a ordem de locks. Os 20 achados originais corrigidos e seis parciais permanecem. DBR01/DBR02 e LG01 confirmado, dump/backup/staging/aplicação revisada, rollout e QA integral ainda impedem considerar a publicação pronta. Doze hashes SQL iguais: 11 candidatos de alteração e um preflight não aplicados; 324 testes nativos históricos sem reexecução. Flags legacy, HEAD ef9416e1, whitespace zero, Docker parado e porta 43197 sem listener. Nesta etapa: zero chamadas ou gravações Supabase, alteração remota de ambiente/Auth, commit, push, PR ou deploy.

[Evidências](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/final-verification.json) · [Gate](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/check-release.log) · [Fixtures](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/fixtures.log) · [Contratos estáticos](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/static.json) · [Writers](E:/dropzone-cadastros/relatorios-testes/estrutura-leitura-2026-10-12/writers-expanded.json).
<!-- structure-read-context-end -->

<!-- progression-atomic-20261012 -->

### Progressão transacional — 12/10/2026

Candidato e cliente web preparados: ranking autoritativo, fence/UUID/recibo/imagens, reversão completa com proteção de alterações posteriores, guard de seis escritores e rota dedicada sem fallback. PR02 confirma consulta de coluna inexistente no validador salvo; correção exata com MD5 preparada no mesmo candidato. Validação local: 53 nativos, 47 HTTP/cliente, 12 runtime, dez estáticos e gate33/tipos/lint/build/npm produção zero. Contêiner/volume removidos e Docker parado. 12 candidatos + um preflight sem aplicação remota, flags legacy; temporada/demais estrutura, staging, integração/rollout e QA integral continuam pendentes. [Detalhes e limites](E:/dropzone-cadastros/docs/PROGRESSAO_TRANSACIONAL_2026-10-12.md) · [Fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). Sem commit/push/PR/deploy.


<!-- season-atomic-20261012 -->

### Temporada da Liga: candidato e integração local — 12/10/2026

SE01/SE02: lote transacional e leitor privado/paginado preparados. Prévia revisada, UUID/recibo mestre e inclusões filhas na mesma transação; oito guards, pós-condições, cotas insuficientes recusadas, slots bloqueados/reservados protegidos. Cliente recupera intenção original e protege troca de conta/recurso/desmontagem. Código local recusa lote legado com 503; flag LEAGUE_SEASON_WRITE_MODE=legacy e serviço publicado inalterado. 35 nativos + conferência complementar de cinco corpos/oito guards/ACL/seleção mista, 25 leitor, 41 HTTP/cliente, 16 runtime de temporada +12 progressão repetidos, 18 estáticos e gate35/tipos/lint/build/npm produção zero. Falhas iniciais preservadas. 13 candidatos + um preflight sem aplicação remota; 13 hashes anteriores iguais. Docker/volume próprios removidos e Docker parado. Não fecha demais writers/estrutura/staging nem os seis parciais originais. [Relatório](E:/dropzone-cadastros/docs/SEASON_TRANSACIONAL_2026-10-12.md) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). Sem commit/push/PR/deploy.


<!-- daily-group-atomic-20261012 -->

### Diário: vínculo de horário/grupo — 12/10/2026

DJ01/DJ02: vínculo bidirecional preparado em transação, com limpeza dos dois endpoints deslocados, comparação do snapshot e recibo; leitor sem edição inclui grupos paginados e versões. UI exige confirmação, guarda UUID/corpo, recupera resposta perdida e protege conta/recurso/desmontagem. Legado local recusado com 503, DAILY_GROUP_WRITE_MODE=legacy; Supabase/GitHub/Vercel inalterados nesta etapa. 24 nativos em banco novo (inclui reprodução do legado), quatro corpos/dois guards/ACL, 38 HTTP/cliente, leitor125+3 históricos, 16 runtime Diário +12 progressão repetidos, 14 estáticos e gate36/tipos/lint/build/npm produção zero. 14 candidatos + um preflight não aplicados; 14 hashes anteriores iguais. Docker e volume próprios removidos, Docker parado. Não fecha demais gravações/writers/staging nem os seis parciais originais. [Relatório](E:/dropzone-cadastros/docs/DIARIO_VINCULO_TRANSACIONAL_2026-10-12.md) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md). Sem commit/push/PR/deploy.


<!-- edition-atomic-20261012 -->

### Edição/franquia: salvamento transacional preparado — 12/10/2026

Regra confirmada pelo usuário: alterar nome/descrição/status compartilhados exige gerenciar todos os campeonatos da franquia; edição individual mantém sua permissão própria. ED01/ED02/ED03: franquia/origem/edição/recibo juntos, campos omitidos preservados, snapshots legados exatos, pós-condições e replay protegido. Editor extraído e helper de criação recuperam UUID/corpo originais. Criação básica/fases/lifecycle continuam em operações separadas, sem rollback completo certificado. Legado save_edition local recusado com503, EDITION_WRITE_MODE=legacy. 30 nativos em banco novo, quatro corpos/dois guards/ACL, 52 HTTP/cliente, 16 runtime edição +16 Diário/12 progressão repetidos, 18 estáticos e gate37/tipos/lint/build/npm produção zero. 15 candidatos + um preflight não aplicados; 15 hashes anteriores iguais. Dois laboratórios/volumes próprios removidos, Docker parado. Nenhum SQL/MCP ao projeto nesta etapa; leituras externas do build normal não foram instrumentadas. Sem commit/push/PR/deploy. 20 achados originais corrigidos/seis parciais mantidos; demais transações/writers/staging/QA integral pendentes. [Relatório](E:/dropzone-cadastros/docs/EDICAO_FRANQUIA_TRANSACIONAL_2026-10-12.md) · [Fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

<!-- lifecycle-safety-20261012 -->

### Encerramento/reabertura: diagnóstico e contenção — 12/10/2026

LC01/LC02/LC03 reproduzidos com handler antigo/SDK reais e dados fictícios: gravações parciais, publicação com queda nova pendente e repetição sem recibo. Ramos inseguros removidos; POST/PATCH/DELETE locais recusam503 após autenticação/gestão, antes das tabelas. GET informa unavailable; web/mobile exibem indisponibilidade e controles desativados. **Transação substituta ainda não preparada; pendência de lifecycle permanece aberta.** Web consulta com proteção de conta/recurso/epoch; demais callbacks mobile/painel não certificados. 41 checks (11 históricos/30 atuais),32 runtime finais (16 lifecycle/16 edição),16 estáticos; 38 suítes/tipos/lint passaram, build inicial interrompido por spawn EPERM e final retomado aprovado; tipos mobile e npm produção root/web zero. Falhas iniciais preservadas. Nenhum novo SQL/Docker/SQL-MCP ao projeto, alteração remota, commit/push/PR/deploy; build normal pode ler diretório/cache externo, tráfego não instrumentado. 16 hashes SQL iguais,15 candidatos+um preflight; nativos anteriores históricos. Originais20 corrigidos/seis parciais mantidos. [Relatório](E:/dropzone-cadastros/docs/LIFECYCLE_SEGURANCA_2026-10-12.md) · [Fechamento](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

<!-- lifecycle-atomic-20261012 -->

### Encerramento/reabertura: operação transacional preparada — 12/10/2026

Encerramento/reabertura: candidato SQL e cliente web preparados localmente. Regra confirmada: ativar todas as etapas/divisões encerradas na reabertura, preservar canceladas e manter inscrições fechadas. LC01/LC02/LC03 tratados por transação, ranking autoritativo, revisão/fence, guards, imagens e recibos. 51 nativos em PostgreSQL sintético,54 HTTP/cliente,76 runtime,16 estáticos e gate39/tipos/lint/build aprovados; npm produção root/web zero. LIFECYCLE_WRITE_MODE permanece legacy; mobile continua bloqueado. 17 SQLs (16 candidatos+um preflight),16 hashes anteriores preservados; nenhum SQL/MCP ao projeto nesta etapa. Docker/volume próprios removidos e Docker parado. Staging/ativação, mobile, históricos sem imagem, mudanças após publicação, Booyah com regras não padrão, demais writers e seis parciais originais pendentes. Sem commit/push/PR/deploy; tráfego externo de leitura do build normal não instrumentado.

[Relatório](E:/dropzone-cadastros/docs/LIFECYCLE_TRANSACIONAL_2026-10-12.md) · [Validação](E:/dropzone-cadastros/relatorios-testes/lifecycle-transacao-2026-10-12/final-verification.json) · [Pendências](E:/dropzone-cadastros/docs/PENDENCIAS_FECHAMENTO_2026-10-12.md).

<!-- parallel-batch-20261012 -->

### Duas frentes em paralelo — 12/10/2026

Lote com duas frentes paralelas concluído localmente: cliente mobile de encerramento/reabertura preparado, com 53 checks de transporte e 28 runtime React; convites de manager extraídos para backend (rota 243→39 linhas), cancelamento limitado a convite próprio pendente e 35 cenários (34 atuais/um histórico, incluindo 20 paridades). Gate conjunto 41/tipos/lint/build aprovado. Flags legacy e 17 SQLs inalterados; nenhum banco nativo repetido nesta etapa. QA real de dispositivo, staging/ativação e demais pendências permanecem; originais 20 corrigidos/seis parciais. Sem commit/push/PR/deploy.

[Relatório do lote](E:/dropzone-cadastros/docs/LOTE_PARALELO_2026-10-12.md).

<!-- structure-dependencies-20261012 -->

### Grupo e slots / dependências móveis — 12/10/2026

Grupo e slots: candidato SQL e cliente web preparados, writer legado individual contido com flag legacy; 44 verificações nativas (43 atuais/uma sequência histórica), 52 HTTP/cliente e 18 runtime React passaram. Permissão organizar_grupos preservada; quatro corpos/cinco guards/duas tabelas privadas verificados, gatilho de capacidade original intacto. Dependências móveis: audit online36→23 pacotes (13 moderados eliminados;23 altos permanecem), duas overrides compatíveis,19 checks de consumidores, Expo/tipos/export Android aprovados. Validação conjunta de código42/tipos/lint/build e seis contratos passou. Web produção onlinezero; raiz não verificada por escolha do usuário, guarda de release retorna2 sem consultar registro.18 SQLs datados (17 candidatos+um preflight),17 hashes anteriores iguais; laboratório/volume removidos e Docker parado. Sem SQL/MCP ao projeto, alteração remota, commit/push/PR/deploy. Originais20 corrigidos/seis parciais; staging/ativação, grupo mobile, demais writers, acessibilidade/layout integral e dispositivos pendentes.

[Relatório](E:/dropzone-cadastros/docs/GRUPOS_E_DEPENDENCIAS_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/lote-estrutura-deps-2026-10-12/final-verification.json).

<!-- mobile-group-prizes-20261012 -->

### Grupos e premiações no mobile — 12/10/2026

Cliente mobile de criação individual de grupo/slots integrado ao contrato transacional, com sessão atualizada, chave/corpo originais recuperáveis e proteção contra troca de conta/campeonato. Leituras privadas, rascunhos e confirmações de premiação isolados por conta/campeonato/geração; premiações ainda sem certificação transacional ou recibos.27 checks de cliente e36 runtime (22 grupos/14 premiações) passaram; código43 suítes/tipos/lint/build, dois contratos mobile, tipos do app e export JS Android aprovados.18 SQLs anteriores e dependências móveis iguais por hash; sem novo banco/audit/SQL/MCP ao projeto ou publicação. Flags legacy; staging/ativação, dispositivos, demais writers e matriz integral de layout/acessibilidade pendentes. Audit anterior mobile23 altos; raiz online não verificada por escolha do usuário. Originais20 corrigidos/seis parciais.

[Relatório](E:/dropzone-cadastros/docs/MOBILE_GRUPOS_PREMIOS_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/mobile-grupo-premios-2026-10-12/final-verification.json).

<!-- mobile-management-matrix-20261012 -->

### Painel mobile e matriz de fontes — 12/10/2026

Painel principal mobile protegido contra respostas, rascunhos e confirmações antigas após troca de conta/perfil/campeonato; chamadas próprias usam sessão atualizada. Retorno à lista corrigido e resposta tardia da lista não apaga erro do detalhe.32 cenários do pai e36 regressões grupos/premiações passaram; código43 suítes/tipos/lint/build, dois contratos mobile, tipos do app e export JS Android aprovados. Matriz atual de43 rotas/16 subáreas/326 fontes por imports e hashes; presença e histórico separados de conformidade visual/arquitetural, ainda sem nova navegação web.18 SQLs e dependências móveis anteriores iguais por hash, sem novo audit/banco/SQL/MCP ao projeto/publicação. Atomicidade dos writers, staging/ativação, dispositivos e matriz integral de estados/acessibilidade permanecem pendentes. Raiz online não verificada por escolha do usuário; mobile23 altos no último audit. Originais20 corrigidos/seis parciais.

[Relatório](E:/dropzone-cadastros/docs/PAINEL_MOBILE_E_MATRIZ_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/painel-matriz-2026-10-12/final-verification.json).

<!-- dialog-accessibility-20261012 -->

### Diálogos e acessibilidade — 12/10/2026

Fechamento em13/10/2026. Diálogo compartilhado corrigido: somente a janela superior trata Escape/Tab, fundo inert com restauração, foco inicial visível e retorno preservado inclusive em StrictMode. Planilha de stream e recorte de imagens migrados; planilha embutida é região.3 falhas anteriores reproduzidas,38 cenários finais e 14 amostras de contraste passaram; título17,44:1/orientação6,89:1, rótulos/abas/cabeçalhos/números de linha com pelo menos12px; reflow320px com alvo de fechamento44px.19 checks feedback/fundação UI e código43 suítes/tipos/lint/build aprovados. Matriz atual43 rotas/16 subáreas/327 fontes. Testes de componentes/CSS locais com serviços e ícones adaptados, rede interceptada; sem todas as páginas/temas/estados, zoom real, leitor de tela ou dispositivo.18 SQLs/dependências anteriores iguais, sem novo audit/banco/SQL/MCP ao projeto ou publicação. Originais20 corrigidos/seis parciais; L03 permanece parcial, staging/demais writers/dispositivos pendentes. Raiz online não verificada por escolha do usuário.

[Relatório](E:/dropzone-cadastros/docs/DIALOGOS_ACESSIBILIDADE_2026-10-12.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/dialogos-2026-10-12/final-verification.json).

<!-- form-accessibility-20261013 -->

### Formulários e localidade — 13/10/2026

Formulários em 13/10/2026: Field associa nomes, dicas e erros aos controles compartilhados, preserva ARIA/IDs explícitos e sinaliza obrigatório sem impor validação nativa. Localidade aceita setas/Enter/Escape/Tab, mantém foco e separa Escape da lista e do diálogo. Checkbox causava largura327 em viewport320; CSS compartilhado corrigido e largura final320, sem elementos excedentes.38 cenários de formulários,38 regressões de diálogo/14 amostras e29 checks estáticos passaram; código43 suítes/tipos/lint/build aprovado após o CSS final. Matriz43 rotas/16 subáreas/327 fontes, sem certificação visual integral. Rede dos testes interceptada, IBGE fictício; cadastro real usado como componente, sem gravação/upload/aceite de convite. Leitor de tela, zoom real, dispositivos e todos os estados continuam pendentes.18 SQLs/dependências anteriores iguais; sem novo audit/banco/SQL-MCP ao projeto ou publicação. Originais20 corrigidos/seis parciais; L03 parcial. Falta de espaço impediu uma autorização automática; após aumento do espaço, execução retomada com revisão. Audit online da raiz não verificado por escolha do usuário.

[Relatório](E:/dropzone-cadastros/docs/FORMULARIOS_ACESSIBILIDADE_2026-10-13.md) · [Verificação](E:/dropzone-cadastros/relatorios-testes/formularios-2026-10-13/final-verification.json).
