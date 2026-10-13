# DROPZONE — RODADAS DE LAYOUT E ARQUITETURA V1

Data: 09/10/2026. Referência de organização: Stake.com, **sem copiar marca, assets, recursos ou CSS proprietário**.

## Regra de trabalho (obrigatória)

- Preservar endpoints, rotas existentes, tipos de perfil, Supabase/RLS, pagamentos, contratos de ingestão, MatchStats, pontuação e Engine.
- Não fazer substituições globais em `globals.css`; mudanças em CSS novos, escopadas a shell ou feature.
- Cada rodada deve gerar: arquivos completos alterados, relatório/diff, testes estáticos, lint/typecheck/build quando possível, checklist visual em desktop e mobile, backup e forma de rollback.
- Nunca tratar Playwright deslogado como validação de telas autenticadas. Validar permissões e estados reais em homologação antes de produzir.
- Não enviar `.env`, segredos, builds, cache ou `node_modules` nos pacotes de transferência.

## R01 — Navegação pública e tokens / IMPLEMENTADA NO CÓDIGO

**Páginas com sidebar desktop:** `/`, `/campeonatos`, `/campeonatos/[id]`, `/equipes`, `/equipes/[id]`, `/jogadores`, `/jogadores/[id]`, `/produtoras`, `/produtoras/[id]`, `/managers`, `/managers/[id]`, `/comunidade`, `/rank`.

**Mudanças:** cabeçalho de 64px/56px, busca existente, sidebar de 232px recolhível a 68px, menu inferior de 64px no mobile, menu extra pelo ícone, controles acessíveis e estado salvo em localStorage. A sidebar não se aplica ao pontuador, checkout, convites, OBS, control de live ou painéis operacionais.

**Arquivos:** `web/components/layout/StorefrontHeader.tsx`, `web/components/layout/storefront-header.css`, `web/styles/dz-layout-tokens.css`, `web/app/layout.tsx`.

**Critérios para homologar:** testar abertura/fechamento de sidebar, deep links de menu, busca (query q), troca de usuário, mobile teclado e menus, safe area, visual em 390/768/1024/1366/1920px; verificar que `/broadcast/obs/[token]` não tem navegação extra.

## R02 — Home compacta e card de campeonato / IMPLEMENTADA NO CÓDIGO

**Página:** `/` para visitantes e usuários com home pública.

**Mudanças:** hero ~300px desktop / mínimo ~230px mobile; controles menores e legíveis; categorias ~104px; grid de campeonatos 4 colunas desktop (3 compacto / 2 mobile); arte 16:9 `contain` sem corte; legenda fora da imagem; cards com dados oficiais e operações preservadas; destaques e footer compactados. Elimina `<main>` aninhado: `AppShell` continua como único `<main>` sem alterar âncoras.

**Arquivos:** `web/features/home/AuthenticatedHomeFeed.tsx`, `web/features/home/home-density-v1.css`.

**Critérios para homologar:** imagens de tamanhos/razões diferentes, números reais de vagas, ausência de preços, favorito/carrinho, skeleton, home logada/deslogada, CTA, busca, carrossel, largura 320px e texto longo.

## R03 — Diretórios e ranking / AINDA NÃO IMPLEMENTADA

**Páginas:** `/campeonatos`, `/equipes`, `/jogadores`, `/produtoras`, `/managers`, `/rank`, `/comunidade`.

**Componentes reais:** `DirectoryPage`, `DirectoryListClient`, `ChampionshipListRow`, diretório/rank, CSS específico.

**Plano:** banner de 185px desktop, filtros de 42px e 44px para toque, lista com linha de 60px, mídia 52px, paginador/empty state, sem substituir lista de campeonatos por card ou perder critérios de ordenação. Ranking mantém colunas e overflow horizontal no mobile.

**Aceite:** filtros e query string sincronizados; acessibilidade; scroll horizontal apenas de tabela, não do documento.

## R04 — Perfis públicos / AINDA NÃO IMPLEMENTADA

**Páginas:** `/campeonatos/[id]`, `/equipes/[id]`, `/jogadores/[id]`, `/produtoras/[id]`, `/managers/[id]`.

**Componentes reais:** `DirectoryProfilePage`, `ChampionshipPublicView`, `DirectoryProfileTabs`.

**Plano:** hero 220px, avatar 72–100px, grupo de até 4 KPIs, abas 44px, histórico com tabelas / queda / fase / jogo sem apagar granularidade. Não modificar queries, validações ou IDs.

## R05 — Painéis logados / AINDA NÃO IMPLEMENTADA

**Páginas:** home `/?painel=1`, `/central-campeonato`, `/agenda`, `/afiliados`, `/lili`.

**Componentes reais:** `WorkspaceShell`, `WorkspaceHeader`, `WorkspaceNav`, `WorkspaceSubnav`, painéis da produtora/equipe/jogador/manager.

**Plano:** shell operacional próprio, nav e subtabs 44px/38px, conteúdo max 1280px, botões 44px, KPIs legíveis, tabelas responsivas. Perfis diferentes devem manter menus/permissões atuais; não reutilizar a sidebar pública à força.

## R06 — Gestão de campeonatos e Engine / AINDA NÃO IMPLEMENTADA

**Itens:** 11 abas da produtora, formulários de campeonato, equipes/jogadores, fases, estrutura avançada, jogos, calls, estatísticas, rulebook, export, stream, pontuador por jogo.

**Plano:** extrair wrappers visuais sem alterar callbacks; densidade das tabelas, filtros contextuais por fase/jogo/queda, modais com estados claros e ações perigosas explícitas. Editor e pontuador usam modo operacional e não herdam CSS público.

**Aceite:** compare baseline e pontuação antes/depois, testes de idempotência e autorização, nenhuma divergência entre pontuador/Engine/histórico.

## R07 — Comércio e transações / AINDA NÃO IMPLEMENTADA

**Páginas:** `/carrinho`, `/carteira`, `/vagas` (redirect), `/vagas/compra/[token]`, `/vendas/[token]`, `/vendedor/[token]`, `/vendedores/[managerId]`.

**Plano:** wizard compacto, checkout com resumo e estados de carregamento; cartas de pagamento, preço, comissão e vagas legíveis. Integrações financeiras e payloads intactos. Não esconder mensagens de risco.

## R08 — Convites e login / AINDA NÃO IMPLEMENTADA

**Páginas:** `/convite/equipe/[token]`, `/convite/grupo/[token]`, `/convite/produtora/[token]`, `/equipe/entrar/[token]`, `/equipe/reivindicar/[token]`, `/escala/[token]`, `/i/[token]`, `/login`, `/atualizar-senha`.

**Plano:** FlowShell com cards centrados 680–880px, etapas e erros claros; manter tokens e autorizadores originais. Login e recuperação usam MinimalShell.

## R09 — Transmissão, administração e acabamento / AINDA NÃO IMPLEMENTADA

**Páginas:** `/broadcast/control/[token]`, `/broadcast/obs/[token]`, `/campeonatos/[id]/stream`, `/campeonatos/[id]/pontuador/[jogoId]`, `/admin`, termos, privacidade e exclusão de dados.

**Plano:** controle de broadcast com cards operacionais de 80–120px e estado de conexão explícito; `/broadcast/obs` continua limpa, 100vw/100vh, SEM header/sidebar/footer; admin com tabelas densas, filtros e permissões. Jurídicos em leitura de até 840px.

## Resultados desta entrega

- R01 e R02 foram editadas no código-fonte, mas **não foram publicadas**.
- Auditoria estática customizada, lint de TSX e auditorias de rotas/cartão/R207 passaram.
- Typecheck completo tentou executar, mas excedeu o limite do ambiente; **não está aprovado nem reprovado**.
- Smoke test geométrico em Chromium com HTML representativo aprovado para 320/390/768/1100/1440px; não testa o aplicativo real.
- Build Next, Playwright visual/autenticado no aplicativo, homologação com Supabase e teste em produção **não realizados**.
- Pacote acompanha `PATCH_R01_R02` de arquivos completos e backup para rollback.
