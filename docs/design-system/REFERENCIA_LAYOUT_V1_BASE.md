# DROPZONE · REGRA OFICIAL DE LAYOUT E ARQUITETURA VISUAL · V1.0

**Estado:** proposta técnica para aprovação; **nenhuma alteração aplicada ao aplicativo original**.
**Base:** inspeção do `dropzone-cadastros.zip` disponibilizado em 09/10/2026 e estudo da homepage pública de `https://stake.com/pt`.
**Objetivo:** herdar da referência a densidade, navegação, sistema de cards e consistência de interface, **sem copiar marca, recursos de apostas ou identidade visual**.
**Regra:** todo valor em px neste documento é um **alvo de projeto** para DropZone, não uma medição oficial do CSS da Stake. Adaptar por teste visual, conteúdo real, acessibilidade e resoluções suportadas.

## 0. Levantamento feito no código e limites

### Código real identificado
- `web/app/page.tsx` carrega `features/dropzone/DropZoneHome.tsx` (a mesma rota alterna vitrine e painel de acordo com a sessão e parâmetros).
- `components/layout/AppShell.tsx` usa **dois cabeçalhos**, `AppHeader` (sistema) e `StorefrontHeader` (vitrine). A home `AuthenticatedHomeFeed` renderiza o `StorefrontHeader` diretamente.
- `StorefrontHeader`: barra informativa superior de **30px**, cabeçalho de **78px** e menu horizontal. `AuthenticatedHomeFeed`: hero de **500px** e grade de categorias de 6 colunas; vitrine de produtos em 4 colunas, conforme CSS atual.
- A vitrine de campeonatos usa `components/championship/ChampionshipCard.tsx`; o diretório usa `DirectoryPage` e `DirectoryListClient`; os perfis usam `DirectoryProfilePage` e, no caso de campeonatos, `ChampionshipPublicView`.
- Os painéis logados compartilham `components/workspace/WorkspaceShell.tsx`, `WorkspaceHeader`, `WorkspaceNav`, `WorkspaceSubnav`, `WorkspaceContent`.
- Produtora: `ProducerTab` tem 11 abas organizadas em 5 grupos. Equipe: 8 abas em 5 grupos principais. Jogador: 5 abas. Manager usa contextos de produtora/equipe/jogador.
- `web/app/globals.css` tem cerca de 730 KiB, importa múltiplas camadas de estilos globais e registra regras de várias telas. Mudanças globais sem isolamento são de alto risco.
- A página `/campeonatos/[id]/stream` é atualmente um **handoff ao aplicativo DropZone Live Local**; não projetar ali um editor web completo como se já estivesse em operação.
- A rota `/vagas` redireciona para `/campeonatos?vagas=1`; não criar segunda vitrine.

### Limites da análise
- As dimensões da Stake são referências visuais aproximadas baseadas em páginas públicas/referências visuais, não uma extração de Figma, CSS privado ou navegador autenticado.
- Esse mapeamento é de **rotas e componentes encontrados**, não um teste funcional de cada controle logado com todos os estados de permissão. Elementos condicionais por perfil, edição ou token exigem validação visual autenticada.
- O aplicativo Expo e o editor desktop são produtos relacionados, mas não devem receber CSS web automaticamente; precisam do **mesmo design system traduzido para seus componentes nativos**.

## 1. Princípios inegociáveis

1. **Design system único:** tamanhos, cores, bordas, sombras, estados e tipografia vêm de tokens semânticos compartilhados.
2. **Casca de navegação consistente:** cabeçalho fixo + menu lateral no desktop + conteúdo fluido; telas especiais usam modos declarados.
3. **Conteúdo ganha espaço:** reduzir o hero e bordas decorativas; aumentar a quantidade de informações úteis visíveis sem tornar o texto ilegível.
4. **Cards por família:** campeonato, equipe, jogador, produtora, resultado, estatística, operação, transação — cada família tem contrato visual próprio.
5. **Vitrine e operação não são iguais:** home e diretórios usam cards/carrosséis; tabelas, planilhas de resultados, cadastro e edição usam grades operacionais.
6. **Não alterar lógica de negócio:** Supabase/RLS, IDs, cálculos, flags de inscrições, compras, pontuação, Engine, estatísticas e APIs continuam iguais nesta rodada de interface.
7. **Não usar cor como único estado:** badges incluem texto, ícones quando pertinentes e contraste adequado.
8. **Progressividade:** implantar por shell e componente, validar no Playwright, migrar rotas gradualmente, manter URLs e contratos públicos.
9. **Mínimo de interações ocultas:** ações importantes aparecem também no foco e toque; hover não é único caminho.
10. **Versões e rollback:** todo grupo de mudanças tem feature flag ou PR isolado, testes de regressão e rollback.

## 2. Arquitetura proposta: shells por contexto

```text
DesignSystem
├── tokens/            espaço, tipografia, superfície, dimensões, breakpoints
├── primitives/        Button, IconButton, Field, Badge, Tabs, Card, Dialog, Table
├── patterns/          SectionRail, CatalogGrid, FilterBar, PageHeader, StatCard,
│                     EntityRow, ProfileHero, ConfirmStep, EmptyState, DataToolbar
├── navigation/
│   ├── GlobalHeader   (logo, busca, usuário, alertas, carrinho)
│   ├── GlobalSidebar  (expandido/recolhido, itens conforme permissão)
│   ├── MobileNav      (5 entradas principais + gaveta Mais)
│   └── ContextNav     (abas específicas da página/painel)
├── shells/
│   ├── DiscoveryShell      home, comunidade, diretórios, ranking
│   ├── ProfileShell        perfis públicos, páginas de campeonato
│   ├── WorkspaceShell      produtora, equipe, jogador, manager, central
│   ├── CommerceShell       carrinho, carteira, vagas, vendas
│   ├── FlowShell           convites, inscrições por token, escalação
│   ├── OperationsShell     pontuador, calls, tabelas de operação
│   ├── StudioShell         controle de live/editor/preview
│   ├── AdminShell          gestão global e auditoria
│   └── MinimalShell        login, recuperação, jurídicos, OBS clean output
└── features/          mantém formulários, estado, fetch e regras do código atual
```

### Regra de encaixe sem reescrever o sistema
- `AppShell` permanece como **fachada compatível**. Adicionar propriedades `mode`, `sidebar`, `contentWidth`, `stickyHeader`, `hideChrome` e migrar as páginas progressivamente; evitar mudar todas de uma vez.
- `StorefrontHeader` e `AppHeader` devem, ao final, renderizar um `GlobalHeader` compartilhado com variações, sem perder props atuais (`onAccountClick`, `onSwitchAccount`, `onSignOut`, saldo, notificações, contas vinculadas).
- Renderizar **um único** elemento `<main>` por página. A home atual já tem um `<main>` dentro de `AuthenticatedHomeFeed`, e `AppShell` também renderiza `<main>`: corrigir essa duplicação ao refatorar o shell, preservando as âncoras e estrutura.
- Usar `features` e `components` existentes. Só extrair novas peças quando houver reutilização real. Evitar clone de `ChampionshipCard` ou dos formulários.
- Futuramente, route groups Next.js `(discovery)`, `(workspace)`, `(flows)`, `(operations)` podem organizar o `web/app` **sem alterar URLs**. Isso é fase posterior, não pré-requisito para a reformulação.

## 3. Geometria oficial proposta

### 3.1 Tokens estruturais

| Token | Desktop | Tablet | Mobile | Observação |
|---|---:|---:|---:|---|
| `--dz-header-h` | 64px | 60px | 56px | Cabeçalho único |
| `--dz-sidebar-expanded` | 232px | 72px | 0px | 72px = recolhido com ícones; mobile = drawer |
| `--dz-sidebar-collapsed` | 68px | 68px | 0px | Usuário pode recolher no desktop |
| `--dz-mobile-nav-h` | 0px | 0px | 64px | Respeitar safe area |
| `--dz-content-inline` | 28px | 20px | 14px | Padding horizontal na área útil |
| `--dz-section-gap` | 28px | 24px | 20px | Distância vertical entre seções |
| `--dz-card-gap` | 14px | 12px | 10px | Vão entre cards |
| `--dz-content-max` | 1600px | auto | auto | Limite **dentro** da área pós-sidebar |
| `--dz-panel-max` | 1280px | 100% | 100% | Formulários e conteúdo operacional |
| `--dz-reading-max` | 840px | 100% | 100% | Jurídicos, regulamento, instruções |
| `--dz-row-h` | 60px | 56px | 58px | Lista de entidade |
| `--dz-table-row-h` | 48px | 48px | 52px | Tabela; mobile pode ter scroll |
| `--dz-control-h` | 42px | 42px | 44px | Inputs, selects, botões |
| `--dz-touch-target` | 44px | 44px | 44px | Área clicável mínima |

**Pontos de quebra propostos**: 0–599 mobile estreito; 600–767 mobile largo; 768–1023 tablet; 1024–1279 desktop compacto; 1280+ desktop amplo. Não usar breakpoint para reduzir fonte abaixo de 12px de forma sistemática.

### 3.2 Fórmula do layout

Desktop: `width(conteúdo)=largura viewport - largura sidebar - 2*padding interno`, limitado a `--dz-content-max`. Sidebar não deve sobrepor a grid quando expandida. Header ocupa topo, sidebar fica abaixo dele ou alinhada ao lado conforme especificação definitiva. Definir essa escolha **uma única vez** no shell.

- 1440px, sidebar 232px, padding 28px → aproximadamente **1152px** úteis.
- 1366px, sidebar 232px, padding 28px → aproximadamente **1078px** úteis.
- 1920px, sidebar 232px, padding 28px → aproximadamente **1632px** úteis antes do limite de conteúdo.

Esses valores são cálculos da proposta, não medidas reais da Stake. Títulos e tabelas não devem atravessar o limite de leitura específico.

### 3.3 Tipografia

| Elemento | Desktop | Mobile | Regras |
|---|---:|---:|---|
| H1 página | 30px/36px | 24px/30px | Peso 700–800, máximo 2 linhas |
| H2 seção | 20px/26px | 18px/24px | Consistente nas coleções |
| H3/card título | 15–16px | 14px | Até 2 linhas, ellipsis por clamp |
| Corpo | 14px/21px | 14px/21px | Texto funcional acessível |
| Metadados | 12–13px | 12px | Nunca 7–9px para informação essencial |
| KPI número | 24–30px | 22–26px | Tabular nums |
| Ação | 13–14px | 13–14px | Não usar caixa-alta em excesso |

O DropZone atual utiliza fontes de 7–10px em áreas da vitrine, exigindo uma rodada de correção de legibilidade. Preservar a personalidade visual, mas não manter microtipografia crítica.

### 3.4 Componentes e tamanhos

| Componente | Alvo de dimensão | Comportamento |
|---|---|---|
| `GlobalHeader` | h64; logo 140–176w; busca 260–420w | Busca global com `Ctrl+K`, ícones 40–44, avatar 32–36 |
| `GlobalSidebar` | w232 expandida, w68 recolhida | Grupos, rótulos e destaque de rota, com scroll próprio |
| `PageHeader` | h72–112, conforme subtítulo | Título + breadcrumbs + ações; sem banner em toda página |
| Hero home | 260–320 de altura | 1 destaque e até 2 promo secundárias; desktop |
| Hero diretórios | 150–210 | Remover grandes espaços vazios |
| Hero perfil | 180–250 | Avatar/logo 80–112, título, status, ações |
| `SectionRail` | h32 cabeçalho + cards | Botões anterior/próximo e link Ver todos |
| `ChampionshipCard / featured` | largura 250–310; imagem 16:9; altura total variável ~270–330 | título 2 linhas, preço, vagas, CTA/favorito |
| `ChampionshipCard / compact` | largura 210–245; imagem 16:9 | menos texto; usar no carrossel |
| `EntityCard` | 170–230w × 190–235h | logo/foto 72–100; nome, categoria, metadado |
| `EntityListRow` | h60–76 | imagem 44–52, nome e status |
| `StatusBadge` | h24–28 | curto, não mais que 1 linha |
| `FilterBar` | h48–56 base | chips h34–36, filtros avançados no drawer/popover |
| `StatCard` | min h94, largura flexível | label, número, variação e contexto |
| `DataPanel` | p16–20 | título, filtros, conteúdo e rodapé |
| `DataTable` | h48 por linha | cabeçalho h44 sticky, scroll horizontal em mobile |
| Modal pequeno/médio/grande | 420 / 640 / 880 max-w | max-height calc(100dvh - 32px), rolagem interna |
| Modal de inscrição | max-w640 | progresso claro, preço/vaga, termos, ação |
| `InfoGrid` | 2–4 colunas | quebra em 1–2 colunas abaixo de 768px |
| `WorkspaceNav` | h44 item | navegação principal; subtabs h38 |
| Lili flutuante | canto inferior, 56px | acima da navegação mobile e sem tapar CTA |

**Proporções**: banner de campeonato em card **16:9**; card promocional largo **2.4:1** como opção; foto de jogador **1:1**; avatar circular/quadrado conforme entidade; logos com `object-fit:contain` para não recortar marcas; backgrounds promocionais com `cover`.

## 4. Navegação e arquitetura de informação

### Sidebar desktop — ordem sugerida

```
INÍCIO
  Página inicial
DESCOBRIR
  Campeonatos
  Equipes
  Jogadores
  Produtoras
  Managers
  Ranking
  Comunidade
MINHA ÁREA (somente logado)
  Meu painel
  Agenda
  Carteira
  Carrinho (quando aplicável)
  Convites e notificações
GESTÃO (conforme papel)
  Central do campeonato
  Meus campeonatos
  Minha equipe / Minhas lines
  Vendas / Afiliados
  Administração (somente admin)
MAIS
  Lili
  Ajuda / Regras
```

- Não mostrar áreas que o usuário não pode acessar; preservar URLs de deep link.
- Navegação ativa é derivada do pathname e da aba; não usar lógica duplicada em `nav.ts`, `StorefrontHeader` e `AppHeader`.
- Sidebar expandir/recolher com estado persistente por dispositivo; expansões não devem esconder ações do perfil.
- Menu mobile: **Início, Campeonatos, Comunidade, Agenda, Perfil**; Carteira/Carrinho e ferramentas em perfil/mais, sem esconder indicadores essenciais.
- Header: logo, busca, notificação, carrinho se habilitado, avatar/contexto ativo. Ocultar controles apenas em `minimal`, `live-output` e modais de fluxo.
- Busca deve explicitar escopo: `GlobalSearch` procura campeonatos/equipes/jogadores; `DirectorySearch` filtra a página; `WorkspaceSearch` opera dentro de tabelas.

## 5. Bibliotecas visuais e responsabilidades de cada item

### Card de campeonato (`ChampionshipCard.tsx`)
1. **Mídia**: `aspect-ratio:16/9`, borda 8px, imagem otimizada e fallback sem distorção.
2. **Status**: badge INSCRIÇÕES ABERTAS/ENCERRADO/ÚLTIMAS VAGAS (só exibir dados verídicos).
3. **Marca**: produtora discreta, 12px.
4. **Título**: até duas linhas, 15px.
5. **Metadados**: data, formato/servidor se disponíveis (não inventar). Ícones 14px.
6. **Comércio**: preço e ocupação `livres / totais` (não inferir proporção se dado ausente).
7. **Ações**: detalhes primária conforme contexto; comprar/inscrever somente se permitido; favorito/carrinho com aria-label e loading.
8. **Estados**: skeleton, indisponível, sem mídia, lotado, evento encerrado, pendente, comprado, participante.
9. **Variantes**: `compact`, `standard`, `featured`, `list` a partir do mesmo modelo.

### Card de equipe/jogador/produtora/manager
- **Imagem**: 72px/88px/100px segundo densidade; logo `contain`, foto `cover`.
- **Título**: nome com truncamento controlado e `title` acessível.
- **Subtítulo**: tag, cidade/região ou papel se existente.
- **Métricas públicas**: até duas em card compacto, até quatro em perfil detalhado; nunca expor dado privado.
- **Ações**: ver perfil, convite/solicitação somente sob autenticação e permissão.

### Linha de dados e ranking
- Posição/ordem h48; avatar 36–40; título 13–14; métricas alinhadas à direita com `font-variant-numeric:tabular-nums`.
- Tabelas classificatórias **não** devem virar cards com perda de colunas; rolagem horizontal em mobile, coluna de equipe sticky onde viável.
- Estabelecer status de filtro ativo, ordenação ativa, última atualização e fonte dos dados.

### Dialogs, formulários e transações
- Formulário com rótulo acima; erro abaixo; máscara sem substituir instrução; botões h44; primário de risco fica desabilitado durante submissão.
- Diálogos de confirmação com ação e consequências explícitas; não alterar nomes de comandos/métodos da API.
- Fluxos de token/inscrição: cabeçalho mínimo, resumo fixo, etapas numeradas, progresso, estado de expiração, sucesso/erro, alternativa clara.

## 6. Mapa de todas as rotas e do que mudar (web/app)

As linhas desta seção identificam as páginas existentes no arquivo; **não são rotas inventadas**. Abas condicionais são detalhadas na seção 7. Medidas adotam os padrões das seções 3–5.

| URL existente | Conteúdo/itens localizados | Shell alvo | Regra visual especial |
|---|---|---|---|
| `/` | `DropZoneHome`: vitrine `AuthenticatedHomeFeed` ou painel do perfil | Discovery/Workspace | Vitrine: hero 260–320; categorias 6→6/4/2; rail de campeonatos; painel mantém contexto atual |
| `/campeonatos` | `DirectoryPage`, `DirectoryListClient`: banner, busca, filtros status/preço/premiação/plataforma/servidor, favoritos, carrinho, listas | Discovery | Hero 170–210; filtros acima do grid, 3–4 colunas desktop; chips + drawer avançado |
| `/campeonatos/[id]` | `ChampionshipPublicView`: informações, equipes, jogadores, estatísticas, compra de vaga | Profile | Hero ~210; KPIs e CTA de inscrição visíveis; 4 tabs h44; tabelas dentro dos painéis |
| `/campeonatos/[id]/regulamento` | `RulebookViewer` | Minimal/Profile | Documento largura 840px; índice lateral desktop se houver seções; impressão legível |
| `/campeonatos/[id]/pontuador/[jogoId]` | seleção queda/mapa, upload MatchResult, Equipes/MVP, edição e confirmação | Operations | Toolbar sticky; filtros h40; tabelas full width; aviso de divergência evidente; nenhuma coluna cortada |
| `/campeonatos/[id]/stream` | `LocalStudioHandoff` | Operations/Studio | Card de handoff, instruções e estados; **não transformar em editor web novo** |
| `/equipes` | Diretório: busca, entidade, listagem | Discovery | Grid de logos e list rows; 4–5 colunas conforme espaço; manter busca |
| `/equipes/[id]` | `EntityProfileHero`, desempenho, seções, agenda e `TeamLinesWorkspace` | Profile | Hero + métricas compactas; tabs de detalhes; lines/elenco em listas e cards horizontais |
| `/jogadores` | Diretório: busca e listagem | Discovery | Avatar quadrado, tag/nick e 1–2 métricas; grid responsiva |
| `/jogadores/[id]` | Perfil, desempenho competitivo, seções | Profile | Hero avatar 96; KPI em rail; histórico por partida na tabela abaixo |
| `/produtoras` | Diretório de produtoras | Discovery | Logo `contain`, campeonatos e CTA de perfil (se presentes) |
| `/produtoras/[id]` | Perfil institucional, seções, vínculos | Profile | Hero horizontal e cards de campeonatos da produtora; sem esconder contatos públicos |
| `/managers` | Diretório de managers | Discovery | Card de perfil e função; resultados relevantes quando públicos |
| `/managers/[id]` | `EntityProfileHero` e `DirectoryProfileTabs` | Profile | Cabeçalho com avatar, contexto e tabs compactas |
| `/comunidade` | Hub por categorias (`community-hub-card`) | Discovery | Trocar cards muito altos por cards 2–3 por fileira; usar ícones, contagem se houver |
| `/rank` | Hero de ranking, `LiliRankHub` | Discovery/Data | Hero 150–180; tabs e tabela ranking; filtro destacado; colunas estáveis |
| `/agenda` | `AgendaCalendar`, toolbar, fallback para visitante | Workspace | Calendário principal com sidebar de próximo jogo; filtros top; mobile vira agenda/lista |
| `/central-campeonato` | Seletor campeonato, alertas, logs, escolha de grupos, resumo | Workspace/Operations | Seletor de contexto sticky; alertas em cards; logs em tabela; ações sensíveis explícitas |
| `/afiliados` | `AffiliatePage`: landing com hero, benefícios, CTA ou dashboard manager | Discovery/Workspace | Hero 260; benefício cards até 3 colunas; dashboard usa widgets de 100–160px |
| `/carrinho` | Itens, valores, método de pagamento, checkout | Commerce | 2 colunas 65/35 desktop; resumo e CTA sticky; 1 coluna mobile |
| `/carteira` | Abas extrato, saques, pagamentos, Pix; saldo e movimentações | Commerce | Saldo em stat card; tabs h44; tabela h48; aviso de status, ações financeiras claras |
| `/vagas` | Redireciona a `/campeonatos?vagas=1` | Sem shell próprio | Manter redirect, sem duplicar código ou card |
| `/vagas/compra/[token]` | Compra via token, validação e confirmação | Flow/Commerce | Stepper + resumo de item + pagamento, max width 640–880 |
| `/vendas/[token]` | Página de venda individual | Commerce/Flow | Mini-vitrine com 1 destaque e CTA; bloco do vendedor; sem sidebar visual pesada |
| `/vendedor/[token]` | Fluxo associado ao vendedor via token | Flow | Resumo do campeonato e atribuição preservada; etapas visíveis |
| `/vendedores/[managerId]` | Página pública/vitrine de vendas por manager | Discovery/Commerce | Header compacto e lista de campeonatos do vendedor; grid 3–4 colunas |
| `/convite/equipe/[token]` | Link para equipe, validação, passos e vaga | Flow | Max width 680; 3–4 passos; status e regras sem ocultar conteúdo |
| `/convite/grupo/[token]` | Inscrição mais longa por grupo, slots e equipes | Flow | Layout wizard com resumo lateral e slots; não cortar a lógica multiuso |
| `/convite/produtora/[token]` | Convite de produtora | Flow | Card central com quem convidou, autorização e ações de aceite |
| `/equipe/entrar/[token]` | Entrada na equipe via token | Flow | Card de decisão, equipe, estado e CTA |
| `/equipe/reivindicar/[token]` | Reivindicação de equipe | Flow | Detalhes e aviso de autorização, confirmação destacada |
| `/escala/[token]` | Escalação por token, chat e vinculação | Flow/Operations | Cabeçalho da equipe e jogo; lista de vagas; chat em coluna/drawer; mobile etapas |
| `/i/[token]` | Entrada de convite/inscrição genérica | Flow | Card com validade, resumo e ação contextual |
| `/broadcast/control/[token]` | Controle remoto de live: itens, overlays e comandos | Studio | Painel denso, cards de controle h80–120; status de conexão sempre visível |
| `/broadcast/obs/[token]` | Output para OBS (`StreamPackageStage`) | Studio clean | **SEM** header/sidebar/footer. Canvas 100vw/100vh, dimensões da transmissão |
| `/lili` | Chat, mensagens, sugestões e ações contextualizadas | Workspace/Chat | Conversa largura 760–900; composer fixo; cards de resposta compactos |
| `/admin` | Overview, home, produtoras, aprovações, preços, saques, contas, denúncias, auditoria | Admin | Sidebar secundária de seções, tabelas, filtros e ações de alto risco com confirmação |
| `/login` | Login social/conta, troca e recuperação de perfil | Minimal | Painel de autenticação 420–480; branding secundário; rolagem normal em mobile |
| `/atualizar-senha` | Redefinição de senha | Minimal | Card 420–480, erro/segurança claros |
| `/auth/mobile-callback` | Callback OAuth mobile | Minimal | Nunca adicionar navegação que interfira no deep link/redirecionamento |
| `/termos-de-servico` | `LegalPage` | Minimal | Texto 760–840; tipografia 15–16 e índice quando fizer sentido |
| `/politica-de-privacidade` | `LegalPage` | Minimal | Idem; sem hero ocupando a primeira tela |
| `/exclusao-de-dados` | `LegalPage` | Minimal | Instruções destacadas, campos e contatos identificáveis |

> A camada de diretórios usa cinco tipos de entidades, não cinco implementações completamente independentes. Ajustar `DirectoryPage`, `DirectoryListClient`, `DirectoryProfilePage`, `EntityProfileHero`, `EntityListRow` e `ChampionshipPublicView` uma vez para alcançar várias rotas.

## 7. Mapa das telas internas e abas: cada item de cada painel

### 7.1 Painel PRODUTORA — `features/dropzone/panels/produtora/ProdutoraPanel.tsx`

O projeto já organiza 11 abas em 5 grupos (`producer-tabs.ts`). **Não modificar a lógica que escolhe o campeonato, grupo ou aba**; substituir somente apresentação e permitir deep link na fase seguinte.

| Grupo | Aba real | Conteúdo | Ajuste de geometria |
|---|---|---|---|
| Visão geral | `visao` | Resumo do campeonato, fluxo operacional, status da temporada, pendências | Header 96; grid de KPIs 4 colunas; tarefas em cards h96–128 |
| Participantes | `equipes` | Inscritos, vagas, equipe, filtros | Toolbar h52; rows 60; grid/ tabela, seleção sem modal gigante |
| Participantes | `jogadores` | Lista de jogadores e status | Busca + filtros; tabela h48; avatar 36–40 |
| Participantes | `links` | Inscrições, links e tokens | Lista de links com chips status e copiar; formulário modal até 640 |
| Operação | `grupos` | Fases, grupos, slots, organização | Árvore à esquerda 280–320; workspace central fluido; slot 44–56 |
| Operação | `jogos` | Jogos e quedas, grade por fase | Header sticky, accordion por fase; cada queda em row h60 |
| Operação | `regulamento` | Editor/visualização de regras | Área de edição 840–960, preview isolado |
| Operação | `calls` | Calls de x-treino | Cards por call/mapa e calendário; respeitar condicional `xtreino` |
| Resultados | `estatisticas` | Classificação, MVP e estatísticas | Tabs secundárias e filtros h44; ranking em tabela responsiva |
| Financeiro | `financeiro` | Resumo, cobranças, reembolsos e chargeback | KPIs 4x, tabela h48; decisão crítica em diálogo explícito |
| Financeiro | `vendedores` | Vendedores e vendas por campeonato | Painel 2 colunas: seleção/ lista + detalhes; KPI de vendas |

Elementos acima das abas: identidade da produtora, seleção de campeonato, ação criar/editar, status e troca de contexto. O **campeonato selecionado** precisa continuar selecionado ao mudar de aba; evitar reset de filtros sem intenção.

### 7.2 Painel EQUIPE — `features/dropzone/panels/equipe/EquipePanel.tsx`

| Navegação principal | Subaba real | Ajuste |
|---|---|---|
| Início | `dashboard` | Acesso rápido em 3 mini-cards, `TeamAnalyticsDashboard`, indicadores + próximo jogo |
| Elenco | `jogadores` | Lista/avatar 40–48, estados e controles de vínculo |
| Elenco | `lines` | Cards horizontais de line e membros; rolagem vertical controlada |
| Elenco | `convites` | Cards de token e convites, ação copiar e expiração |
| Competições | `campeonatos` | Cards compactos e tabela de participação/agenda |
| Desempenho | `treinos` | KPIs, trends/gráficos e tabela por queda; não exagerar em cards verticais |
| Mais | `staff` | Lista de managers/staff e controles de permissão |
| Mais | `config` | `ProfileEditForm`, seções agrupadas por assunto |

### 7.3 Painel JOGADOR — `features/dropzone/panels/jogador/JogadorPanel.tsx`

| Aba real | Itens | Ajuste |
|---|---|---|
| `resumo` | Indicadores equipes/lines/campeonatos/partidas | 4 KPIs de 94–110h + tarefas curtas |
| `competicoes` | Jornada/inscrições/resultados/agenda | Lista de competições h64, chips fase/status, CTA alinhado |
| `equipe` | Vínculos com times, lines, pedido de entrada, token | Cards horizontais w260–360, busca e token em painel separado |
| `desempenho` | Stats, telemetria, gráficos de evolução, período e quedas | Filtros topo; painéis full-width; tabelas preservam atributos do Engine |
| `perfil` | `ProfileEditForm` | Formulário max 720, seções de dados e foto |

### 7.4 Painel MANAGER — `features/dropzone/panels/manager`

| Contexto | Subáreas | Ajuste |
|---|---|---|
| `produtora` | `vendas` e `campeonatos` | Selector compacto, métricas e lista de comissões |
| `produtora` → `campeonatos` | `equipes`, `jogadores`, `grupos`, `jogos`, `estatisticas`, `info` | Reusar componentes de resumo/lista; sempre limitar ações às permissões |
| `equipes` | Staff e vínculos | Cards/listas orientados ao time; ferramentas contextuais |
| `jogador` | Staff e vínculos | Card de pessoa e lista de participações |

### 7.5 Painel ADMIN — `/admin`

| Aba real | Geometria |
|---|---|
| `overview` | 4 KPIs por linha, atividade e alertas |
| `home` | Editor de destaques com prévia desktop/mobile e campos em painel lateral |
| `produtoras` | Tabela + formulário de convite compacto |
| `aprovacoes` | Fila em tabela, painel de decisão contextual |
| `precos` | Tabela editável, filtros, confirmação de preço |
| `saques` | Fila e estados explícitos; confirmação com valores/titular |
| `accounts` | Busca + tabela com coluna fixa de identidade |
| `reports` | Denúncias/relatórios em tabela/detalhe |
| `audit` | Filtros, timeline e exportação se houver contrato existente |

### 7.6 Campeonato PÚBLICO — `ChampionshipPublicView.tsx`

| Aba real | Geometria |
|---|---|
| `info` | Hero + 4 indicadores + grids de informação 2–3 colunas |
| `equipes` | Filtros fase/grupo; linhas ou cards, logos 40–48 |
| `jogadores` | Tabela/lista por equipe; foto 36–44 |
| `estatisticas` | Classificação e MVP sem cortar colunas; scroll de tabela em mobile |

### 7.7 Pontuador, live, agenda, compra: exceções importantes
- **Pontuador**: priorizar largura de tabela, persistência e legibilidade de campos sobre estética. Header local h64; tabela h48; separação clara entre prévia de arquivo, erros de vínculo, faltas, edição e publicação. Nunca trocar `scope`, `view`, `selectedDropId` ou controles por agrupamentos que mudem o resultado.
- **Stream/OBS**: modo preview/saída sem sidebar e sem header; renderização precisa respeitar resolução do overlay, não os tokens de largura de catálogo.
- **Agenda**: calendário desktop com grid próprio, não enquadrado em cards estreitos. Em celular, oferecer lista cronológica legível.
- **Compra/carrinho/carteira**: moeda, vagas, datas, identidade, condições e confirmações não podem ser resumidas a ícones, nem escondidas por novo visual.

## 8. Regras de componentes adaptativos

### DiscoveryShell (vitrine)

```text
[ GlobalHeader : 64 ]
[ Sidebar 232 ][ Main (padding 28)
                Breadcrumb / contexto (opcional)
                Hero 280 + destaques menores
                Busca h44 / filtros h40
                Título coleção + Ver todos + ← →
                [card][card][card][card]... horizontal
                Título coleção
                [card][card][card]...
                Calendário resumido / resultados
               ]
```

- Cards de catálogo: grid `repeat(auto-fill, minmax(250px,1fr))` quando houver largura suficiente, com `max` e clamps para controlar tamanho; home usa trilhos com largura fixa.
- Sliders não podem ter conteúdo essencial sem botão Ver todos; keyboard navigation, `scroll-snap-type:x mandatory`, foco visível.
- Hero configurável já existe no `HomePageEditor`, portanto preservar o contrato `homeConfig`/`hero_slides`; alterar apenas comportamento e dimensões.

### WorkspaceShell (produção)

```text
[ GlobalHeader ][ Sidebar ][ PageHeader: perfil/campeonato atual ][ Ação principal ]
                             [ WorkspaceNav h44 ]
                             [ WorkspaceSubnav h38 se houver ]
                             [ FilterBar h48 ]
                             [ KPI ][ KPI ][ KPI ][ KPI ]
                             [ Dados / tabela / editor ]
```

- Usar `WorkspaceNav` existente: visual de tabs fixado nos tokens; se muitas tabs, overflow-x auto + indicador de scroll.
- Carregar somente a aba ativa e preservar estado quando voltar, onde hoje já ocorre.
- Telas com dados sensíveis: ações destrutivas e financeiras fora de menus puramente visuais.

### FlowShell (convites / pagamento / inscrição)

```text
[ Logo ][ Título + estado de validade ]
[ Etapas: Acessar → Confirmar dados → Escolher → Concluir ]
[ Formulário (640px) ][ Resumo sticky (300px), somente desktop ]
[ Avisos / CTA ]
```

- O número de etapas varia conforme o fluxo real; a sequência acima é ilustrativa, não uma mudança no contrato funcional.
- Em mobile, resumo acima do CTA; cabeçalho simples, navegação sem distrações.

## 9. Componentes a reutilizar e arquivos de intervenção

| Camada | Arquivos atuais | Estratégia |
|---|---|---|
| Shell | `web/components/layout/AppShell.tsx` | Adicionar modos sem quebrar props e sessão |
| Cabeçalhos | `AppHeader.tsx`, `StorefrontHeader.tsx`, `storefront-header.css`, `web/app/header.css` | Extrair header/nav visuais para um único `GlobalHeader` |
| Navegação | `web/components/layout/nav.ts`, `web/components/workspace/WorkspaceShell.tsx` | Fonte única de itens e estados; manter tabs de domínio |
| Home | `features/home/AuthenticatedHomeFeed.tsx`, `.css`, `home-config.ts` | Hero compacto, rail, cards; preservar slides gerenciados |
| Home/contexto | `features/dropzone/DropZoneHome.tsx` | Preservar alternância vitrine/painel; resolver main aninhado |
| Campeonatos | `components/championship/ChampionshipCard.tsx`, `ChampionshipListRow.tsx`, `styles/championship-card.css` | Variantes por props, status e imagem |
| Diretórios | `features/directory/components/DirectoryPage.tsx`, `DirectoryListClient.tsx` | Banner curto, filtros e grid padrão |
| Perfis | `DirectoryProfilePage.tsx`, `ChampionshipPublicView.tsx`, `EntityProfileHero.tsx`, `DirectoryProfileTabs.tsx` | Hero + abas e metas uniformes |
| Painéis | `features/dropzone/panels/{produtora,equipe,jogador,manager}` | Migrar por grupo de tabs, não reescrever painéis |
| UI base | `components/ui/{Button,IconButton,Badge,Field,DataTable,Surface,Dialog,EmptyState}.tsx` | Mapeamento por token e variantes, não cópias |
| Agenda/ranking | `features/agenda/components/AgendaCalendar.tsx`, `components/lili/LiliRankHub.tsx` | Aplicar filtro, grid e tabela comum |
| Comércio | `features/commerce`, `features/billing`, `web/app/{carrinho,carteira}` | Shell transacional sem afetar pagamentos |
| Token flows | `features/token-flow/TokenFlow.tsx`, `web/app/convite`, `web/app/escala`, `web/app/i` | Etapas, feedback e validação padronizadas |
| Especializados | `web/app/campeonatos/[id]/pontuador`, `features/campeonatos/stream`, `web/app/broadcast` | Tema compartilhado, shell específico por operação |
| CSS legado | `web/app/globals.css`, `web/app/dropzone-refresh.css`, `features/directory/*.css` | Isolar e migrar incrementalmente; **não acrescentar 1000 regras no fim** |

## 10. Sequência de implementação segura

**Etapa 0 — Baseline**: guardar capturas, lista de rotas, estado dos botões em ambiente de homologação; rodar typecheck + lint + suite de regressão já existente. Não compartilhar `.env.local`.

**Etapa 1 — Tokens + primitives**: novo CSS semântico, `Button`, `Badge`, `Field`, `DataTable`, `Surface`, skeleton e estados. Componente por componente; nenhuma URL muda.

**Etapa 2 — Navegação**: `GlobalHeader`, `GlobalSidebar`, `MobileNav`; adaptar `AppShell`, teste de login/conta vinculada, carrinho, voltar e links existentes. Incluir opção de sidebar recolhida.

**Etapa 3 — Vitrine + diretórios**: home, `ChampionshipCard`, `/campeonatos`, `/equipes`, `/jogadores`, `/produtoras`, `/managers`, `/comunidade`, `/rank`.

**Etapa 4 — Perfis públicos**: as cinco páginas `/[id]`, principalmente `/campeonatos/[id]` (4 abas, inscrição, estatística).

**Etapa 5 — Painéis**: `WorkspaceShell` comum; produtora 5 grupos, equipe, jogador, manager, admin. Migrar um grupo por PR, validar cada tab.

**Etapa 6 — Conversão/fluxos**: carrinho, carteira, vagas, convites, escalação, venda e login. Priorizar testes de pagamento/inscrição/persistência.

**Etapa 7 — Ferramentas especializadas e apps**: pontuador, broadcast, handoff para Live Local, ajustes Expo e Electron com tokens equivalentes, sem tratar CSS web como compatível nativamente.

**Etapa 8 — Limpeza**: remover estilos legados somente após comparar visual e comportamento; atualizar guias do projeto. Nunca apagar CSS antigo em lote sem provar que não é referenciado.

## 11. Critérios objetivos de aceite (obrigatórios)

### Viewports
- Desktop: 1920×1080, 1440×900, 1366×768, 1280×800, 1024×768.
- Tablet: 820×1180 e 768×1024.
- Mobile: 390×844, 375×812 e 320×640.
- Testar também zoom 200% e teclado, não só CSS responsivo.

### Regras de aprovação
- Não existe scroll horizontal da **página** em 320px, exceto containers de tabelas/carrosséis explicitamente scrolláveis.
- Ações principais visíveis e acessíveis no teclado/toque; nenhum alvo crítico menor que 44×44px.
- Header não cobre título, abas sticky, dropdowns, toast ou modal.
- Nenhuma imagem de equipe cortada; banners preservam enquadramento adequado e fallback.
- Texto essencial em pelo menos 12px; corpo habitual 14px; contraste WCAG AA onde aplicável.
- `ChampionshipCard` mantém favorito, carrinho, informações e estado correto.
- `DirectoryListClient` mantém todos os filtros e ordenação (status, vagas, preço, prêmio, plataforma, servidor, favoritos, meus, etc.).
- Painel produtora mantém as 11 abas e seletor de campeonato; equipe 8 abas; jogador 5 abas; manager mantém permissões.
- Pontuador mantém importação/validação de MatchResult, vínculo, edição, salvar, fechar/abrir e MVP.
- Fluxos financeiros mantêm valores, titularidade, status, erro, loading e confirmação.
- `/broadcast/obs/[token]` permanece limpo sem shell visual.
- Não mudar modelos do banco/API nesta rodada; `npm run typecheck`, lint/testes existentes e smoke E2E aprovados.
- Sem duplicar wrappers `<main>`, sem scroll lock residual após navegar e fechar modais.

## 12. Proibições / antipadrões

- ❌ Copiar a marca ou layout pixel-a-pixel da Stake.
- ❌ Forçar hero de 500px em todas as páginas.
- ❌ Converter tabela de pontuação em cards que ocultem colunas importantes.
- ❌ Deixar breadcrumb/tab atrás do header sticky.
- ❌ Usar `!important` em massa para cobrir CSS antigo.
- ❌ Converter toda página em Client Component somente para exibir sidebar.
- ❌ Alterar SQL, autenticação, rotas de API, valores monetários, regras de campeonatos e Engine em tarefa de layout.
- ❌ Substituir a visualização OBS por UI responsiva de catálogo.
- ❌ Remover um controle porque não existe na Stake: o DropZone tem necessidades operacionais distintas.

## 13. Definition of Done por página

Cada alteração deve produzir uma ficha: rota exata; layout original; shell selecionado; componentes reutilizados; tokens usados; print em 1440/768/390; teste teclado; teste de leitura; teste de funcionalidades afetadas; histórico de mudança; aprovação e rollback. Uma página só está **concluída** quando a ficha existe e testes passam.

**Autoria do guia**: análise técnica de referência e de código existente. Documento para implementação por etapas; ainda não é uma alteração validada em homologação/produção.
