# Auditoria completa — DropZone

> Diagnóstico original de 10/10 preservado. Consulte o resultado posterior em [Correções e validação de 11/10](E:/dropzone-cadastros/docs/CORRECOES_AUDITORIA_2026-10-11.md).

Data: 10/10/2026, America/Sao_Paulo. Fonte: checkout local em E:/dropzone-cadastros, HEAD ef9416e1, dependências instaladas e banco Supabase conectado ao projeto DropZone. Esta é uma análise do estado encontrado, incluindo alterações locais anteriores à auditoria.

**Parecer: a aplicação compila e grande parte das fundações novas existe, mas layout e arquitetura ainda estão parcialmente migrados. Não recomendo publicar este conjunto no GitHub/Vercel antes de corrigir os quatro achados P1.** Há 26 achados: 4 P1, 20 P2 e 2 P3. P1 significa prioridade alta de correção antes de release; não equivale automaticamente à classificação CVSS crítica.

## 1. Escopo e método

Foram inventariadas todas as 43 rotas de página, 151 rotas de API e 269 métodos HTTP. A leitura incluiu regras e permissões do backend, handlers de maior risco, estrutura de componentes, stylesheets, scripts de testes, migrations, webhooks, uploads, autenticação, Expo e Electron. O catálogo do banco foi consultado diretamente: 118 tabelas públicas, 47 policies incluindo Storage, 53 funções SECURITY DEFINER, 14 views e 7 buckets.

A navegação foi exercitada no build de produção local com Chromium/Playwright:

- 86 aberturas: 43 rotas em 1440×900 e 390×844.
- 111 estados de abas autenticadas: produtora, equipe, jogador, manager e administrador em 1440, 390 e 320 px.
- 24 verificações adicionais de home, campeonatos, equipes, rank, campeonato público e login em 320, 768, 1024 e 1920 px.
- Quatro abas públicas de um campeonato real e seis estados de filtros/categoria.
- 30 verificações GET de acesso: 24 respostas de bloqueio de autenticação/permissão e 6 respostas 405 por método indisponível. Nenhum desses casos devolveu dados protegidos. O 405 não conta como prova de autorização do método realmente implementado.
- Oito testes de fluxo por token com respostas controladas R205.
- Provas isoladas de validação de URL e preço PayPal, com dependências simuladas.

Não executei migrations, SQL de escrita, pagamentos, saques, aceite/consumo de convites, cadastro, push, commit ou deploy. Os navegadores da auditoria bloquearam requisições locais de API com métodos de gravação. Há uma limitação importante: a aplicação possui GETs com efeitos de inicialização, como getOrCreateWallet e vínculo legado de perfil por e-mail verificado. Logo, visitar painéis autenticados não é uma garantia absoluta de imutabilidade interna do produto. Usei as sessões de teste existentes; não criei usuários para esta análise.

Todas as consultas SQL desta auditoria foram de catálogo, contagem ou SELECT. O teste de privacidade executou SET LOCAL ROLE anon numa transação seguida de ROLLBACK e retornou somente quantidades, sem e-mails ou senhas.

## 2. O que está funcionando

- Build de produção Next.js aprovado, incluindo compilação TypeScript e geração de páginas.
- Lint e typecheck da aplicação web aprovados; typecheck do Expo aprovado.
- main, preload e renderer desktop passaram verificação de sintaxe Node.
- Todas as 86 aberturas de rota chegaram a páginas/estados renderizados, sem overflow horizontal nem pageerror nos estados visitados. Página 200 pode ser um gate de login ou mensagem de token inválido: não prova sucesso do negócio.
- Os cinco painéis autenticados e suas abas disponíveis carregaram em três larguras, sem overflow ou erro de JavaScript.
- AppShell, WorkspaceShell, UiInput/UiSelect, componentes de entidades/campeonatos, feedback e composição compartilhada de vários token flows já existem. A home tem um único main; a duplicação remanescente está no handoff de stream.
- Autenticação do servidor usa auth.getUser(token), valida restrições de conta e confere perfil ativo/posse no backend. Administrador depende de vínculo ativo em sistema_administradores.
- Sessão devolvida ao cliente usa projeção permitida de campos. Essa boa prática das APIs não protege o acesso direto ao banco descrito em S01.
- Webhook Asaas exige segredo e confirma o pagamento na API do provedor; PayPal possui verificação de assinatura e captura compara referência, pagador, moeda e valor do pagamento registrado. S02 é uma falha na origem desse valor, anterior à captura.
- Carteira/crédito/saques têm RPCs de atomicidade/idempotência. A ingestão de resultado DPZ possui contratos de transação, autorização e idempotência versionados.
- Uploads têm autorização de recurso, bucket permitido, nomes aleatórios e validação de assinatura de formatos de imagem. Vídeo/quota/limites de leitura ainda merecem endurecimento.
- Electron configura nodeIntegration=false, contextIsolation=true e sandbox=true, com saída local vinculada a 127.0.0.1 e proteção de armazenamento de sessão. O app usa SecureStore no contexto nativo.

## 3. Quatro correções de segurança prioritárias

### S01 · P1 · Contatos privados legíveis pela Data API anônima

**Verificado:** Com SET LOCAL ROLE anon foi possível contar contatos não vazios em equipes (1), jogadores (1), managers (2) e produtoras (1). As policies publicam linhas ativas e os grants permitem email_contato. Nenhum endereço foi extraído.

**Impacto:** A filtragem feita pelas APIs da aplicação pode ser contornada pela consulta direta ao Supabase. RLS ativo não restringe colunas.

**Correção proposta:** Separar dados privados de perfis públicos; revogar SELECT amplo e expor projeções públicas seguras. Manter leitura privada por proprietário e backend autorizado.

**Critério de aceite:** Anon não consegue ler email_contato ou campos operacionais; catálogo público permanece funcional; testar anon, dono, outra conta e admin.

**Evidências:** [supabase/migrations/20260908205236_otimizar_policies_rls.sql:126](E:/dropzone-cadastros/supabase/migrations/20260908205236_otimizar_policies_rls.sql:126), [relatorios-testes/auditoria-2026-10-10/anon-contacts-proof.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/anon-contacts-proof.json).

### S02 · P1 · Ordem PayPal aceita preço e moeda do cliente

**Verificado:** POST /api/paypal/orders consulta a reserva do usuário, mas repassa body.amountMinor e body.currency. createLiliPayPalOrder apenas exige inteiro positivo; a captura compara com o pagamento criado, não com a cotação original. Em execução isolada uma reserva com quote de 10000 BRL aceitou 1 USD cent e respondeu 200.

**Impacto:** Permite criar cobrança divergente do preço autorizado. A prova usa mocks e não demonstra uma compra fraudulenta consumada em produção.

**Correção proposta:** Derivar valor, moeda e descrição de reserva/cotação validada no servidor; validar estado, prazo e cotação; retirar campos comerciais do contrato público ou rejeitar divergência.

**Critério de aceite:** Valor/moeda adulterados são recusados antes de qualquer chamada PayPal; reserva vencida é recusada; captura confere referência, cotação e pagador.

**Evidências:** [web/app/api/paypal/orders/route.ts:12](E:/dropzone-cadastros/web/app/api/paypal/orders/route.ts:12), [backend/src/billing/paypal.ts:80](E:/dropzone-cadastros/backend/src/billing/paypal.ts:80), [relatorios-testes/auditoria-2026-10-10/security-isolated-proof.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/security-isolated-proof.json).

### S03 · P1 · Proxy de imagens permite acesso a redes privadas

**Verificado:** O validador de /api/stream/image aceita 10.0.0.1, 192.168.1.1, 169.254.169.254 e [::1]. O fetch segue redirects automaticamente, sem validar DNS ou cada destino. Requer usuário autenticado. Prova executou somente o validador, sem requests a esses hosts.

**Impacto:** Superfície de SSRF, acesso a serviços internos e consumo de recursos por qualquer conta autenticada.

**Correção proposta:** Preferir allowlist de origem de assets; validar IP resolvido, IPv4/IPv6 e redirects; limitar bytes durante leitura, tempo e taxa.

**Critério de aceite:** Hosts privados e redirects privados são bloqueados; DNS rebinding é tratado; imagem sem Content-Length não ultrapassa limite de streaming.

**Evidências:** [web/app/api/stream/image/route.ts:6](E:/dropzone-cadastros/web/app/api/stream/image/route.ts:6), [web/app/api/stream/image/route.ts:23](E:/dropzone-cadastros/web/app/api/stream/image/route.ts:23), [relatorios-testes/auditoria-2026-10-10/security-isolated-proof.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/security-isolated-proof.json).

### S04 · P1 · Next.js instalado está em faixa com advisories críticos

**Verificado:** Next 16.3.0. npm audit de produção aponta 4 pacotes vulneráveis: next crítico, sharp e source-map-js altos, dompurify baixo. Advisory de RCE Windows afeta Next <16.3.3; outras correções da série alcançam 16.3.8.

**Impacto:** Risco depende do ambiente e do recurso usado. O host local é Windows; não extrapolar o advisory Windows para Vercel/Linux. Não encontrei uso de next/og ou next/image no fonte.

**Correção proposta:** Atualizar para versão corrigida compatível, pelo menos fora de todas as faixas reportadas; revisar dependências transitivas e executar build/regressão. Não usar audit fix --force cegamente.

**Critério de aceite:** Lockfile usa versões corrigidas; auditoria de produção sem crítico/alto aplicável; login, build, renderização e redirects aprovados.

**Evidências:** [web/package.json:18](E:/dropzone-cadastros/web/package.json:18), [relatorios-testes/auditoria-2026-10-10/npm-audit-production.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/npm-audit-production.json).

A documentação do Supabase esclarece que RLS opera sobre linhas e precisa ser combinada com privilégios apropriados para proteger o acesso. [RLS — Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security). O publisher do Next.js confirma que o advisory Windows afeta App/Pages Router em filesystem Windows e foi corrigido em 16.3.3; esse cenário não deve ser atribuído indistintamente à Vercel/Linux. [Advisory oficial Windows](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36). As demais faixas e dependências constam no npm audit capturado; a versão corrigida deve ser reavaliada na rodada de atualização. [Advisory oficial next/og](https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j).

No banco, também existem grants de SELECT para campos operacionais como equipes.senha_dono e campeonato_links.token para determinados papéis. A contagem de senhas preenchidas e links ativos observada era zero; não houve prova de extração de senha/token. A correção S01 deve revisar esses campos preventivamente junto aos contatos, preservando os fluxos autorizados.

## 4. Layout: a migração está completa?

**Não.** A vitrine/catálogo já apresenta a nova direção visual, e os workspaces possuem navegação compartilhada. Isso não significa que todas as subpáginas, estados, formulários e componentes usem a mesma arquitetura. O catálogo padrão mantém clone próprio; vários token flows mantêm composição manual; login tem controles com acabamento incompleto; a saída OBS recebe elementos globais indevidos. Os painéis ainda dependem fortemente da cascata anterior.

O documento REFERENCIA_LAYOUT_V1_BASE.md se apresenta como proposta técnica para aprovação. Seus tamanhos são metas do projeto, não medições nem aprovação automaticamente assumida. Usei os princípios de consistência, contexto, legibilidade, reutilização e saída limpa para orientar a revisão, e registrei divergências mensuráveis em vez de declarar conformidade por imports.

AppShell usa AppHeader/StorefrontHeader conforme contexto; não há um GlobalHeader único plenamente adotado por todas as famílias. Exceções de autenticação, conversa, controle operacional e OBS fazem sentido, desde que explicitadas. A ausência de sidebar numa saída OBS não é uma falha de migração. A presença de launcher e fundo de catálogo nessa saída é uma falha concreta.

### L01 · P2 · Catálogo padrão não usa a linha canônica

**Verificado:** DirectoryListClient monta ChampionshipListRow apenas com openVacancies=true. Sem esse filtro renderiza article.dz-champ-table-row próprio. Browser: catálogo padrão 3 linhas próprias/0 canônicas; ?vagas=1 0 próprias/3 canônicas.

**Impacto:** Correções do componente compartilhado não chegam ao estado padrão; aumentam divergências visuais e falsos positivos de auditoria.

**Correção proposta:** Usar componente canônico com variante explícita para os dois estados; auditar cada branch renderizado.

**Critério de aceite:** Lista padrão e filtrada usam a mesma família de componente com métricas, ações e labels equivalentes.

**Evidências:** [web/features/directory/components/DirectoryListClient.tsx:353](E:/dropzone-cadastros/web/features/directory/components/DirectoryListClient.tsx:353), [web/features/directory/components/DirectoryListClient.tsx:484](E:/dropzone-cadastros/web/features/directory/components/DirectoryListClient.tsx:484), [relatorios-testes/auditoria-2026-10-10/targeted-ui.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/targeted-ui.json).

### L02 · P2 · Métricas do catálogo ficam sem legenda no celular

**Verificado:** O cabeçalho da tabela desaparece no mobile; as células próprias mostram vagas, inscrição, premiação e data sem label, aria-label ou data-label.

**Impacto:** Números como 86/96, R$ 30 e R$ 1.000 não ficam associados de forma clara à sua finalidade.

**Correção proposta:** Adicionar rótulos visíveis no mobile e estrutura semântica acessível em cada métrica.

**Critério de aceite:** Cada valor mantém nome compreensível em 320/390 px e na árvore de acessibilidade.

**Evidências:** [web/features/directory/components/DirectoryListClient.tsx:499](E:/dropzone-cadastros/web/features/directory/components/DirectoryListClient.tsx:499), [relatorios-testes/auditoria-2026-10-10/targeted-ui.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/targeted-ui.json).

### L03 · P2 · Microtipografia e ações pequenas permanecem

**Verificado:** Foram encontrados textos visíveis entre aproximadamente 7 e 11 px e ações do catálogo com 32 px. A proposta V1 recomenda texto essencial >=12 px e alvo de 44 px; essas medidas são alvos propostos, não aprovação presumida.

**Impacto:** Leitura e toque ficam difíceis; ausência de overflow não prova boa usabilidade.

**Correção proposta:** Ajustar tokens e densidade com conteúdo real; preservar a identidade visual, aumentar texto essencial e área clicável.

**Critério de aceite:** Valores e labels legíveis em 320 px; ações principais têm área de toque adequada; validar teclado, zoom e contraste.

**Evidências:** [docs/design-system/REFERENCIA_LAYOUT_V1_BASE.md:90](E:/dropzone-cadastros/docs/design-system/REFERENCIA_LAYOUT_V1_BASE.md:90), [relatorios-testes/auditoria-2026-10-10/browser-pages.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/browser-pages.json), [relatorios-testes/auditoria-2026-10-10/targeted-ui.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/targeted-ui.json).

### L04 · P2 · Preço desconhecido vira GRÁTIS na home

**Verificado:** priceLabel usa Number(valor_inscricao || 0) e retorna GRÁTIS para null/ausente. A mesma competição aparece como Sob consulta no catálogo.

**Impacto:** Mensagem comercial incorreta; usuário pode iniciar jornada esperando gratuidade.

**Correção proposta:** Unificar formatação monetária e distinguir desconhecido, zero e preço positivo.

**Critério de aceite:** null/undefined/vazio exibem Sob consulta; zero exibe Grátis; positivo mantém o mesmo valor em todas as superfícies.

**Evidências:** [web/features/home/AuthenticatedHomeFeed.tsx:29](E:/dropzone-cadastros/web/features/home/AuthenticatedHomeFeed.tsx:29).

### L05 · P2 · Categorias da home não filtram o catálogo

**Verificado:** Links usam ?tipo=copa/liga/sala/x1; DirectoryListClient não lê tipo e ChampFilters não possui este campo. Os quatro links renderizaram os mesmos três IDs. sala e x1 também não correspondem diretamente à enum atual do campeonato.

**Impacto:** A navegação promete um recorte que não é aplicado.

**Correção proposta:** Definir categorias oficiais, mapear valores válidos e aplicar filtro de tipo no carregamento/estado do catálogo.

**Critério de aceite:** Cada categoria mostra somente seu recorte; filtro ativo é visível; URL, voltar e recarregar preservam a seleção.

**Evidências:** [web/features/home/home-config.ts:83](E:/dropzone-cadastros/web/features/home/home-config.ts:83), [web/features/directory/components/DirectoryListClient.tsx:234](E:/dropzone-cadastros/web/features/directory/components/DirectoryListClient.tsx:234), [relatorios-testes/auditoria-2026-10-10/targeted-ui.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/targeted-ui.json).

### L06 · P2 · Newsletter tem CTA sem operação

**Verificado:** O formulário CADASTRAR apenas chama preventDefault, sem persistência, envio ou confirmação.

**Impacto:** Usuário acredita concluir cadastro que não acontece.

**Correção proposta:** Implementar a inscrição e os estados de sucesso/erro ou remover a chamada até o recurso existir.

**Critério de aceite:** A ação conclui uma inscrição verificável ou deixa de ser apresentada como funcional.

**Evidências:** [web/features/home/AuthenticatedHomeFeed.tsx:229](E:/dropzone-cadastros/web/features/home/AuthenticatedHomeFeed.tsx:229).

### L07 · P2 · Saída OBS herda Lili e fundo global

**Verificado:** Em token inválido e em resposta de espera controlada a saída mostra Lili. O main OBS é transparente, mas body herda textura e fundo opaco global. RootLayout injeta launcher/providers em todas as rotas.

**Impacto:** A composição capturada pode incluir elementos do site e perder transparência.

**Correção proposta:** Criar layout de saída isolado sem chrome, launcher ou fundo global; manter somente componentes necessários à transmissão.

**Critério de aceite:** OBS em espera, erro e overlay ativo não mostra controles do site; transparência e dimensão de transmissão corretas.

**Evidências:** [web/app/layout.tsx:48](E:/dropzone-cadastros/web/app/layout.tsx:48), [web/components/lili/LiliGlobalLauncher.tsx](E:/dropzone-cadastros/web/components/lili/LiliGlobalLauncher.tsx), [relatorios-testes/auditoria-2026-10-10/obs-controlled.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/obs-controlled.json).

### L08 · P2 · Migração de fluxos por token é parcial

**Verificado:** Convite equipe, convite grupo, escala e venda ainda compõem páginas e estados manualmente. Referenciar tokenFlowPath/registro não equivale a adotar TokenFlowPage. Algumas rotas novas já usam a base compartilhada.

**Impacto:** Erros, espera, login e acompanhamento podem divergir por fluxo; a matriz anterior superestima migração ao procurar imports.

**Correção proposta:** Migrar composição e estados para a família compartilhada respeitando a regra de cada token; testar sucesso, expirado, consumido e visitante.

**Critério de aceite:** Todas as dez rotas do registro usam composição e feedback consistentes, incluindo estados alternativos.

**Evidências:** [web/app/convite/equipe/[token]/page.tsx:330](E:/dropzone-cadastros/web/app/convite/equipe/[token]/page.tsx:330), [web/app/convite/grupo/[token]/page.tsx:862](E:/dropzone-cadastros/web/app/convite/grupo/[token]/page.tsx:862), [web/app/escala/[token]/page.tsx:382](E:/dropzone-cadastros/web/app/escala/[token]/page.tsx:382), [web/app/vendas/[token]/page.tsx:69](E:/dropzone-cadastros/web/app/vendas/[token]/page.tsx:69).

### L09 · P2 · Controles do login ainda ficam com estilo nativo

**Verificado:** Screenshot mobile mostra Mostrar senha abaixo do campo e Criar conta com botão nativo. CSS do password-control fornece borda/tamanho, mas falta composição que posicione o botão junto ao input.

**Impacto:** Acabamento e leitura visual inconsistentes em uma jornada essencial.

**Correção proposta:** Adotar campo composto e variantes de Button/IconButton; conferir login, cadastro e recuperação em mobile/desktop.

**Critério de aceite:** Mostrar senha fica integrado ao campo, sem bordas duplicadas; todas as ações usam variantes visuais coerentes.

**Evidências:** [web/app/login/page.tsx:859](E:/dropzone-cadastros/web/app/login/page.tsx:859), [web/app/login/page.tsx:942](E:/dropzone-cadastros/web/app/login/page.tsx:942), [web/styles/auth-invites-density-r08.css:52](E:/dropzone-cadastros/web/styles/auth-invites-density-r08.css:52), [relatorios-testes/auditoria-2026-10-10/screenshots/390-_login.png](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/screenshots/390-_login.png).

### L10 · P3 · Página de stream possui main aninhado

**Verificado:** AppShell renderiza main e LocalStudioHandoff renderiza outro main. Confirmado nas duas larguras.

**Impacto:** Landmarks redundantes e regra visual de composição violada.

**Correção proposta:** Deixar main no shell e usar section/div no conteúdo.

**Critério de aceite:** Exatamente um main na página, preservando título e conteúdo.

**Evidências:** [web/components/local-studio/LocalStudioHandoff.tsx:6](E:/dropzone-cadastros/web/components/local-studio/LocalStudioHandoff.tsx:6), [web/app/campeonatos/[id]/stream/page.tsx](E:/dropzone-cadastros/web/app/campeonatos/[id]/stream/page.tsx), [relatorios-testes/auditoria-2026-10-10/browser-pages.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/browser-pages.json).

### L11 · P3 · Busca da home escapou da migração de inputs

**Verificado:** Input de busca da home é nativo e audit-form-migration falha no trecho. Screenshot desktop mostra campo branco destoante do contexto.

**Impacto:** Adoção incompleta dos controles compartilhados.

**Correção proposta:** Migrar para UiInput e validar o formulário de busca sem alterar o contrato da URL.

**Critério de aceite:** Auditoria de controles passa e busca mantém teclado, submit e filtro q.

**Evidências:** [web/features/home/AuthenticatedHomeFeed.tsx:142](E:/dropzone-cadastros/web/features/home/AuthenticatedHomeFeed.tsx:142), [relatorios-testes/auditoria-2026-10-10/r207-static.log](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/r207-static.log).

## 5. Arquitetura e desempenho

A separação web/backend já é útil, mas não atende integralmente aos princípios do PROJECT_CONTEXT. Muitas páginas de entrada são pequenas; seus componentes descendentes concentram milhares de linhas e handlers acumulam casos de uso, acesso a banco e regras. O objetivo deve ser reduzir acoplamento por domínio, mantendo contratos existentes e fazendo migração incremental.

O inventário de CSS soma aproximadamente 1,71 MiB em fonte, incluindo folhas duplicadas e não necessariamente carregadas. Isso não é tamanho de transferência. Para a home do build local, medi os nove links CSS efetivamente presentes: 1156951 bytes crus, aproximadamente 1,10 MiB, e 178196 bytes gzip estimados por zlib, aproximadamente 174 KiB. Gzip estimado não é medição de transferência da Vercel. A arquitetura de imports globais e os painéis importados na entrada contribuem para o custo.

### A01 · P2 · Regras e apresentação continuam em módulos muito grandes

**Verificado:** ProdutoraPanel 3546 linhas; EquipePanel 2960; CampeonatoForm 2711; convite de grupo 2039; Lili chat API 3314; API genérica dropzone 1902. Há domínio/permissão/séries de consultas dentro de route handlers.

**Impacto:** Mudanças de layout ou regra têm alto raio de regressão e revisão difícil.

**Correção proposta:** Extrair casos de uso por domínio para backend e seções de UI pequenas; manter handlers como adaptação HTTP; evitar reescrita total.

**Critério de aceite:** Domínios têm serviços/contratos explícitos e componentes focados; permissões são testadas independentemente da UI.

**Evidências:** [PROJECT_CONTEXT.md:15](E:/dropzone-cadastros/PROJECT_CONTEXT.md:15), [relatorios-testes/auditoria-2026-10-10/source-inventory.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/source-inventory.json).

### A02 · P2 · Cascata CSS continua cumulativa e global

**Verificado:** globals.css 747682 bytes; inventário registra 5433 !important e 1610 declarações de fonte entre 6 e 11 px. RootLayout importa 27 folhas CSS; home do build liga 9 chunks, 1156951 bytes crus e ~178196 bytes gzip estimado.

**Impacto:** Estilo de uma área pode alterar outra; uma correção vira mais um override; custo de CSS alto na entrada.

**Correção proposta:** Consolidar tokens por contexto, remover regras comprovadamente substituídas, isolar estilos de feature e reduzir carregamento global.

**Critério de aceite:** Redução mensurada do CSS por rota e da especificidade; regressão visual aprovada em todas as famílias.

**Evidências:** [web/app/layout.tsx:2](E:/dropzone-cadastros/web/app/layout.tsx:2), [web/app/globals.css](E:/dropzone-cadastros/web/app/globals.css), [relatorios-testes/auditoria-2026-10-10/home-css-payload.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/home-css-payload.json).

### A03 · P2 · Consultas amplas e truncamento silencioso

**Verificado:** Directory server pagina internamente até 10000 linhas e usa select(*); filtros são aplicados no cliente. A API genérica usa select(*) e limite padrão 300, podendo filtrar depois.

**Impacto:** Custo cresce com o banco; resultados podem ficar incompletos sem paginação visível. Isso não é prova de IDOR.

**Correção proposta:** Projeções por caso de uso, filtros/autorização antes da consulta e paginação/cursor com contagem explícita; índices só com plano e métricas.

**Critério de aceite:** Página retorna somente campos e recorte necessário; itens além de 300/10000 não desaparecem silenciosamente.

**Evidências:** [web/features/directory/server.ts:38](E:/dropzone-cadastros/web/features/directory/server.ts:38), [web/features/directory/server.ts:252](E:/dropzone-cadastros/web/features/directory/server.ts:252), [web/app/api/dropzone/route.ts:129](E:/dropzone-cadastros/web/app/api/dropzone/route.ts:129).

### A04 · P2 · Cópias órfãs fora da aplicação oficial

**Verificado:** Há 8 arquivos em components/ e features/ na raiz duplicando web; DirectoryListClient difere. app/comunidade/page.tsx e app/rank/page.tsx também estão fora do Next e do include de TypeScript do Expo.

**Impacto:** É possível editar cópia que não é executada, ou publicar lixo/confusão no próximo git add .

**Correção proposta:** Confirmar origem, consolidar alterações úteis na árvore oficial e remover cópias órfãs na rodada de correção.

**Critério de aceite:** Uma fonte oficial por componente; buscas, build e typecheck incluem todos os arquivos relevantes.

**Evidências:** [features/directory/components/DirectoryListClient.tsx](E:/dropzone-cadastros/features/directory/components/DirectoryListClient.tsx), [web/tsconfig.json](E:/dropzone-cadastros/web/tsconfig.json), [app/tsconfig.json](E:/dropzone-cadastros/app/tsconfig.json).

### A05 · P2 · Documento central não descreve o estado atual

**Verificado:** PROJECT_CONTEXT ainda diz que app contém somente documentação, cita tarefas já executadas e painéis /painel/... que não existem como rotas. A proposta visual V1 continua marcada para aprovação.

**Impacto:** Próxima manutenção pode seguir arquitetura e tarefas obsoletas.

**Correção proposta:** Atualizar contexto, arquitetura e matriz das 43 rotas; distinguir decisão aprovada, proposta e implementação atual.

**Critério de aceite:** Documentação corresponde às árvores web/backend/Expo/Electron e registra pendências reais.

**Evidências:** [PROJECT_CONTEXT.md:35](E:/dropzone-cadastros/PROJECT_CONTEXT.md:35), [docs/design-system/REFERENCIA_LAYOUT_V1_BASE.md:3](E:/dropzone-cadastros/docs/design-system/REFERENCIA_LAYOUT_V1_BASE.md:3).

## 6. Regras de negócio e banco

As regras devem permanecer no backend e em operações transacionais do banco, com autorização do usuário e perfil ativo. A UI pode orientar o usuário, mas não deve decidir preço, permissão, crédito, consumo de token ou pontuação oficial.

Regras analisadas e nível de evidência:

- **Permissões:** getBearerUser valida JWT no provedor; escolha de perfil cruza propriedade; requireSystemAdmin exige vínculo ativo. Chamadas de leitura sem sessão foram bloqueadas. Não foi feito um pentest de todos os pares usuário A/recurso de B nas 269 operações.
- **Estatísticas/baseline:** teste R03 com módulos reais e dados simulados passou: Q1 não inclui queda anterior; Q4 inclui somente Q1–Q3 finalizadas; identidade competitiva não mistura jogadores com o mesmo ID externo; somas e máximo de distância seguem contrato.
- **Resultado DPZ/engine:** teste R11 estático passou para Bearer, idempotência, transaction/rollback, unicidade e próxima queda. Não executei ingestão real concorrente no banco de produção.
- **Financeiro:** créditos, débitos, estornos e saque usam RPCs/estados; revisão de origem de vendedor no pagamento de inscrição mostrou atribuição derivada no servidor. Não fiz captura, split, saque ou reembolso real. S02 deve ser tratado antes de considerar o domínio financeiro validado para release.
- **Convites:** registro de rotas é centralizado, mas composição e casos de uso continuam distintos. Há proteção por auth/owner/token e consumo atômico em partes do fluxo; não foi provada atomicidade ponta a ponta de todas as combinações slot/participação/histórico/uso.
- **Conta/OTP:** código usa HMAC com segredo de pelo menos 32 caracteres, expiração de 15 minutos, limite de envio e consumo/verificação por RPC. Reenvio de mensagens e recuperação reais não foram executados.
- **Privacidade pública:** projeções de frontend/backend reduzem exposição nas APIs, mas S01 confirma acesso direto a contatos por grants/policies. Segurança em profundidade ainda precisa ser concluída.

Resultados do catálogo conectado:

- 118/118 tabelas públicas com RLS habilitado.
- 84 dessas tabelas não possuem policies. Nesse modelo, isso normalmente nega acesso direto a anon/authenticated e concentra acesso no backend com service_role; não é justificativa para liberar tudo. [RLS e comportamento de negação](https://supabase.com/docs/guides/database/postgres/row-level-security).
- 53 funções SECURITY DEFINER analisadas: nenhuma executável por anon/authenticated; todas com search_path explícito. Isso é positivo. [Segurança de funções — Supabase](https://supabase.com/docs/guides/database/functions).
- 13 views com security_invoker=true; a view restante não concede SELECT a anon/authenticated no catálogo observado.
- Sete buckets públicos de mídia; limites e tipos configurados. Bucket público é adequado para asset público, mas qualquer dado privado deve ter política separada. Não foi feito crawl do conteúdo dos buckets.
- Advisors de segurança: zero ERROR, 84 INFO de RLS sem policy, um WARN de proteção de senha vazada. Zero ERROR do linter não implica ausência de falha de privacidade/negócio.
- Advisors de desempenho: 191 avisos informativos de FKs sem índice, 34 índices sem uso observado e uma recomendação de configuração de pool Auth. Avaliar com EXPLAIN, volume e carga; não criar 191 índices nem remover 34 automaticamente. [Linter de FK sem índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys), [índices sem uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

### S05 · P2 · Proteção contra senhas vazadas está desativada

**Verificado:** Advisor de segurança do Supabase retorna Leaked Password Protection Disabled. Não há ERROR no advisor, mas esta verificação não cobre privacidade de colunas.

**Impacto:** Senhas já comprometidas podem ser aceitas pela configuração de Auth.

**Correção proposta:** Habilitar a proteção quando disponível no plano e revisar os requisitos de senha entre UI e servidor.

**Critério de aceite:** Cadastro e recuperação rejeitam senha comprometida, preservando o fluxo legítimo.

**Evidências:** [relatorios-testes/auditoria-2026-10-10/security-advisors.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/security-advisors.json).

## 7. Resultado real das verificações

- npm run build: **passou** no build final.
- npm run lint: **passou**.
- npm run typecheck: **passou**.
- TypeScript do app Expo: **passou**.
- node --check nos três arquivos centrais Electron: **passou**.
- Auditoria geral --full --skip-quality: **107 OK, 7 avisos, 0 erros**. Cinco avisos são inventário local de schema desatualizado, dois são cascata CSS. Os checks de qualidade foram executados separadamente.
- Scripts de layout individuais: **13/17 passaram**. audit-championship-card e audit-championship-catalog esperam breakpoint literal antigo; audit-discovery-layout-r01-r02 espera import substituído; audit-form-migration aponta input real não migrado.
- R207 cumulativo: **13/15 passaram**; falham R197 e R201 pelas causas anteriores.
- R205 Playwright: **8/8 passaram**, respostas controladas de quatro fluxos em duas larguras.
- R207 Playwright original: **24/36 passaram**, 12 falharam. Dez usam sessões salvas no origin localhost:3000 contra base localhost:3210; duas verificam /vagas antes da conclusão do redirect. A auditoria independente remapeou origin e validou os cinco painéis/111 estados; o redirect foi confirmado em navegação real. Esses 12 resultados não foram convertidos em 12 defeitos do produto, e a suíte original permanece necessitando correção do harness.
- Teste de ranking: saída validou 40 jogadores, 11 equipes e 2 campeonatos; o processo permaneceu em limpeza do servidor no ambiente restrito. Classificado como asserções aprovadas, runner com problema de encerramento.
- Baseline R03: **passou** com módulos/dados simulados.
- Engine R11: **passou** por verificação de contrato estático.
- validate-code-flows: **45 OK, 0 avisos, 0 falhas**, verificação estática.
- Auditoria de pacotes web completa: **15 pacotes** (1 crítico, 11 altos, 2 moderados, 1 baixo). Apenas produção: **4 pacotes** (1 crítico, 2 altos, 1 baixo). São contagens de pacotes, não de vulnerabilidades distintas.
- Expo: **41 pacotes** (1 crítico, 30 altos, 10 moderados), com distinção necessária de toolchain/runtime.
- Desktop: **15 pacotes** (7 altos, 8 moderados), incluindo risco do Electron empacotado.

Houve tentativas iniciais com EPERM ao iniciar subprocessos de build/teste na sandbox. As operações de verificação apropriadas foram repetidas com aprovação automática, e os resultados finais acima refletem as execuções concluídas. EPERM de sandbox não foi tratado como bug do projeto.

### T01 · P2 · Auditorias estáticas não garantem a migração completa

**Verificado:** 17 scripts individuais: 13 passaram e 4 falharam. Três falhas esperam padrões antigos; uma revela input não migrado. R207 cumulativo: 13/15. Teste de componente canônico aceita zero linhas, deixando passar o catálogo próprio.

**Impacto:** Selo de rodada concluída pode coexistir com falha visual ou branch não auditado.

**Correção proposta:** Trocar presença de string por contrato de renderização; atualizar seletores/breakpoints; testar states de listas e sessões por origin correto.

**Critério de aceite:** Auditorias atualizadas passam sem tolerar zero componentes esperados; failures de ambiente são separados de bugs.

**Evidências:** [relatorios-testes/auditoria-2026-10-10/r207-static.log](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/r207-static.log), [relatorios-testes/auditoria-2026-10-10/r207-summary.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/r207-summary.json).

## 8. Matriz completa das 43 rotas

Esta lista confirma inventário e cenário visitado, não certificação funcional completa. Todas têm duas aberturas sem overflow/pageerror; exemplos de entidade usam registros públicos reais, tokens são inválidos/controlados e o jogo do pontuador é inexistente. “Base integrada; revisão global” significa presença de fundação no contexto observado, com pendências comuns de CSS/legibilidade, sem validar mutações. Redirecionamentos são alias e não subpáginas independentes.

- **/** — Migração parcial. Cenário: público. Vitrine nova e quatro workspaces. Preço desconhecido, categorias, newsletter e input de busca pendentes.
- **/admin** — Migração parcial. Cenário: público. Nove abas autenticadas abriram em três larguras. Estrutura própria, botões nativos e CSS legado ainda presentes.
- **/afiliados** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/agenda** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/atualizar-senha** — Redirecionamento. Cenário: público. Redirect cliente para login?recovery=1; recuperação real não enviada.
- **/auth/mobile-callback** — Contexto específico. Cenário: público. Callback mínimo dedicado; retorno ao aplicativo nativo não foi testado em dispositivo.
- **/broadcast/control/[token]** — Contexto específico. Cenário: token inválido. Estado de token inválido abre sem chrome de catálogo. Controle autorizado com token real não foi acionado.
- **/broadcast/obs/[token]** — Migração parcial. Cenário: token inválido. Erro e espera controlada mostram Lili/fundo do body. Overlay real ativo permanece pendente.
- **/campeonatos** — Migração parcial. Cenário: público. Estado padrão usa clone de tabela; ?vagas=1 usa linha canônica. Mobile sem legenda nas métricas.
- **/campeonatos/[id]** — Migração parcial. Cenário: público. Perfil público e quatro abas visitados. Tipografia/CTA mobile a revisar; workspace de gestão não foi exercitado com campeonato pertencente à fixture.
- **/campeonatos/[id]/pontuador/[jogoId]** — Contexto específico. Cenário: jogo inexistente. Visitante foi enviado ao login. Fluxo autorizado de pontuação com jogo real permanece pendente; contratos estáticos/engine analisados.
- **/campeonatos/[id]/regulamento** — Base integrada; revisão global. Cenário: público. Página pública abriu com ID real. Edição/publicação não executadas.
- **/campeonatos/[id]/stream** — Migração parcial. Cenário: público. Handoff para Studio local; dois main. Pacote desktop e live ativa não foram executados.
- **/carrinho** — Base integrada; revisão global. Cenário: público. Estado visitante/vazio abriu; provider autenticado consultado. Checkout não acionado.
- **/carteira** — Base integrada; revisão global. Cenário: público. Visitante cai no login; consultas de carteira dos painéis autenticados funcionam. Saque/PIX/captura não acionados.
- **/central-campeonato** — Base integrada; revisão global. Cenário: público. Visitante cai no login; fluxo autorizado completo por competição exige fixture de gestão.
- **/comunidade** — Redirecionamento. Cenário: público. Redirect para /equipes: não existe subpágina independente de comunidade neste build.
- **/convite/equipe/[token]** — Migração parcial. Cenário: token inválido. Estado indisponível manual; composição compartilhada ainda não aplicada à página inteira.
- **/convite/grupo/[token]** — Migração parcial. Cenário: token inválido. Página de 2039 linhas e estado indisponível manual. Consumo real de slot/token não executado.
- **/convite/produtora/[token]** — Base integrada; revisão global. Cenário: token inválido. TokenFlowPage no estado visitado; fluxo de login validado também por mock R205.
- **/equipe/entrar/[token]** — Base integrada; revisão global. Cenário: token inválido. TokenFlowPage no estado visitado e fixture controlada R205. Aceite real não executado.
- **/equipe/reivindicar/[token]** — Base integrada; revisão global. Cenário: token inválido. TokenFlowPage no estado de link indisponível; reivindicação real não executada.
- **/equipes** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/equipes/[id]** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/escala/[token]** — Migração parcial. Cenário: token inválido. Fluxo manual de escalação; registro de rota centralizado não unifica composição.
- **/exclusao-de-dados** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/i/[token]** — Base integrada; revisão global. Cenário: token inválido. TokenFlowPage no estado inválido e estado visitante controlado R205.
- **/jogadores** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/jogadores/[id]** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/lili** — Contexto específico. Cenário: público. Contexto próprio de conversa; API de 3314 linhas. Ferramentas de escrita e intents financeiros não executados.
- **/login** — Migração parcial. Cenário: público. Input migrado, composição de senha e ação Criar conta com acabamento incompleto. OTP/OAuth reais não reenviados.
- **/managers** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/managers/[id]** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/politica-de-privacidade** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/produtoras** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/produtoras/[id]** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/rank** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/termos-de-servico** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.
- **/vagas** — Redirecionamento. Cenário: público. Redirect para /campeonatos?vagas=1 preserva parâmetros; não existe catálogo separado.
- **/vagas/compra/[token]** — Base integrada; revisão global. Cenário: token inválido. Gate de login compartilhado. Compra, captura e consumo do token não executados.
- **/vendas/[token]** — Migração parcial. Cenário: token inválido. Loading/erro manual e conteúdo próprio em AppShell; checkout não executado.
- **/vendedor/[token]** — Base integrada; revisão global. Cenário: token inválido. TokenFlowPage e gate de acesso controlado R205. Aceite real não executado.
- **/vendedores/[managerId]** — Base integrada; revisão global. Cenário: público. Base de layout/primitivas presente e abertura verificada. Revisar microtipografia/cascata comum; mutações não executadas.

Versão para consulta/filtro: [matriz CSV](E:/dropzone-cadastros/docs/AUDITORIA_ROTAS_2026-10-10.csv) e [dados estruturados sanitizados](E:/dropzone-cadastros/docs/AUDITORIA_COMPLETA_2026-10-10.json).

## 9. Abas autenticadas efetivamente visitadas

- **produtora**: 27 estados em três larguras; abas Visão geral, Campeonatos, Financeiro, Equipe, Configurações. Subabas: Financeiro > Resumo gerencial; Financeiro > Vendedores; Equipe > Equipe interna; Equipe > Cadastros provisórios.
- **equipe**: 30 estados em três larguras; abas Início, Elenco, Competições, Desempenho, Mais. Subabas: Elenco > Jogadores; Elenco > Lines; Elenco > Convites; Mais > Staff; Mais > Configurações.
- **jogador**: 15 estados em três larguras; abas Início, Competições, Equipe, Desempenho, Perfil.
- **manager**: 12 estados em três larguras; abas Campeonatos 0, Equipes 0, Jogadores 0, Perfil.
- **admin**: 27 estados em três larguras; abas VISÃO GERAL, PÁGINA INICIAL, PRODUTORAS, PUBLICAÇÕES, PREÇOS, SAQUES, CONTAS, DENÚNCIAS0, AUDITORIA.

Os contextos do manager na fixture estavam vazios; portanto as abas abriram, mas vínculos de gestão com dados reais não foram exercitados. As ações de formulários/modais, operações financeiras e mudanças de estado foram preservadas para testes em staging com fixtures específicas.

## 10. GitHub, Vercel, migrations e plataformas

Origin aponta para https://github.com/ranylson10/dropzone-cadastros. O checkout já tinha 138 arquivos modificados e 160 não rastreados antes da criação destes artefatos. Não há commit/push desta auditoria. As cópias de raiz exigem revisão antes de qualquer staging abrangente.

Há vínculo local .vercel com projeto dropzone-cadastros e configuração web/vercel.json para Next. Isso não verifica os ajustes remotos de Root Directory, envs, previews, domínio, runtime ou último deployment. Não declarei a Vercel pronta porque não consultei configuração remota/deploy de produção. O próximo release deve confirmar que o projeto usa web/ e instala dependências/lockfile do monorepo de forma reproduzível, incluindo imports de backend/src.

Variáveis de servidor como service_role, Auth/Resend, Asaas e PayPal precisam estar presentes no ambiente correto, sem prefixo NEXT_PUBLIC_. As envs reais não foram incluídas nos artefatos. Os exemplos estão ignorados/segregados adequadamente; verificação de ausência de segredo óbvio no estado atual não equivale a varredura completa de todo o histórico Git. O debug.keystore do Android é a chave padrão de desenvolvimento, não uma chave de assinatura release.

### D01 · P2 · Deploy em lote não possui travas de qualidade

**Verificado:** deploy.bat faz git add ., commit e push main; não roda checks e imprime sucesso sem verificar o exit code do push. Não há workflow versionado em .github. Estado inicial contém 138 arquivos modificados e 160 novos.

**Impacto:** Pode incluir cópias/dados indevidos e publicar um pacote amplo sem revisão ou indicar sucesso falso.

**Correção proposta:** Revisar diff, separar commits/PRs, usar git add por escopo e gate de lint/typecheck/build/testes/audit; conferir resultado real do push e preview.

**Critério de aceite:** Publicação só avança após checks; falha de push interrompe; preview é aprovado antes da promoção.

**Evidências:** [deploy.bat:21](E:/dropzone-cadastros/deploy.bat:21), [deploy.bat:45](E:/dropzone-cadastros/deploy.bat:45).

### D02 · P2 · Snapshot e histórico de migrations divergem

**Verificado:** Auditoria local avisa cinco tabelas ausentes; as cinco existem no banco conectado. Live tem 27 migrations e site_home_config aparece como 20261004051145, enquanto local é 20261004020000. DDL desta migration é equivalente na consulta realizada.

**Impacto:** Reaplicar por nome de arquivo pode duplicar histórico; snapshot antigo gera alertas falsos e mascara drift real.

**Correção proposta:** Atualizar snapshot sanitizado e reconciliar versões/histórico com diff do schema; não executar migration repetida cegamente.

**Critério de aceite:** Schema esperado coincide com live; migrations locais e aplicadas têm correspondência documentada.

**Evidências:** [supabase/migrations/20261004020000_site_home_config.sql](E:/dropzone-cadastros/supabase/migrations/20261004020000_site_home_config.sql), [relatorios-testes/auditoria-2026-10-10/migrations-live.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/migrations-live.json), [relatorios-testes/auditoria-2026-10-10/general-audit.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/general-audit.json).

### D03 · P2 · App móvel precisa de revisão própria de dependências

**Verificado:** npm audit do app retorna 41 pacotes: 1 crítico, 30 altos, 10 moderados. O crítico é shell-quote no ferramental; contagem não prova vulnerabilidade no binário final. Typecheck passa.

**Impacto:** Toolchain comprometida ou falhas aplicáveis podem afetar builds; o site não valida o app nativo.

**Correção proposta:** Atualizar dentro da matriz compatível de Expo/RN e separar dependência empacotada de ferramenta; rodar build Android/iOS e regressão em dispositivo.

**Critério de aceite:** Audit contextual revisado, builds assinados e fluxos de auth/competições validados no dispositivo.

**Evidências:** [app/package.json](E:/dropzone-cadastros/app/package.json), [relatorios-testes/auditoria-2026-10-10/npm-audit-mobile.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/npm-audit-mobile.json).

### D04 · P2 · Desktop tem Electron com advisory alto

**Verificado:** Auditoria desktop: 15 pacotes, 7 altos e 8 moderados. Electron 43.4.0 é runtime empacotado apesar de estar em devDependencies. Main/preload/renderer passam node --check.

**Impacto:** Excluir devDependencies da auditoria perderia risco do runtime do executável.

**Correção proposta:** Atualizar Electron e ferramentas compatíveis; validar pacote, IPC, sessão, cache e saída OBS local.

**Critério de aceite:** Electron fora da faixa vulnerável e pacote real validado; IPC aceita somente operações/destinos previstos.

**Evidências:** [desktop/package.json](E:/dropzone-cadastros/desktop/package.json), [relatorios-testes/auditoria-2026-10-10/npm-audit-desktop.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/npm-audit-desktop.json).

## 11. Ordem recomendada para a próxima atualização

1. **Segurança e integridade:** corrigir S01–S04. Produzir migration revisável para privilégios/projeções e testes de papel; validar cotação PayPal no backend e blindar download remoto; atualizar Next/lockfile de forma compatível.
2. **Regressão das regras:** fixtures de duas contas com propriedade distinta; editar/ler recurso próprio vs alheio; reserva/preço/moeda/prazo; duplicação de webhook; concorrência de slot/saque/ingestão em staging. Não usar produção para ensaios mutáveis.
3. **Layout por família:** catálogo canônico e legendas mobile; home e login; token flows; stream/OBS isolado; revisar texto/toque/contraste nas páginas e workspaces já cobertos. Atualizar auditorias junto aos contratos reais.
4. **Arquitetura e carga:** extrair handlers/monólitos por domínio, reduzir CSS global, paginação/projeções, remover cópias órfãs e atualizar documentação. Não precisa bloquear toda melhoria estrutural de longo prazo para um hotfix de segurança; delimitar a release.
5. **Repositório:** revisar o diff amplo, separar mudanças em commits/PRs de escopo claro e registrar migrations aplicadas. Não incluir .auth, envs, relatórios sensíveis, builds ou cópias de raiz por acidente.
6. **Preview Vercel:** validar configuração remota, build limpo com lockfile, migrações reconciliadas e testes de regressão nas rotas/abas necessárias. Somente promover depois das correções P1 e aceite dos fluxos afetados.
7. **Expo/Electron:** releases separados do site, com dependências corrigidas e validação dos artefatos nativos/desktop. Build web não certifica essas plataformas.

Critérios mínimos de liberação:

- Nenhum P1 aberto para o escopo publicado; dependência crítica/alta aplicável corrigida ou removida com prova.
- Contatos/segredos privados inacessíveis por Data API anônima e por outra conta; projeções públicas continuam atendendo os catálogos.
- Preço/moeda derivados no servidor e captura contra cotação confiável; redirects/downloads remotos não alcançam hosts proibidos.
- Lint, typecheck, build e suítes com origem/sessão corretas aprovados; testes de operações sensíveis executados em staging.
- Matriz de rota/estado atualizada, sem “migração concluída” baseada somente em import de componente.
- Preview validado e diff/release revisado; nenhuma publicação por git add . sem inspeção.

## 12. Limites e evidências

Foi uma revisão ampla com testes de leitura e provas isoladas, não uma certificação de segurança nem uma execução exaustiva de todas as combinações de 269 métodos. Não houve teste de carga, pentest externo, verificação jurídica, screen reader completo, build nativo assinado, execução do instalador Electron, live OBS real, pagamento real, recuperação real ou validação de cada modal preenchido. Gestão autorizada de um campeonato com todas as fases/grupos/jogos, token válido/expirado/consumido e concorrência devem ser testadas com fixture apropriada na próxima rodada.

A captura de screenshots e dados de fixture fica em relatorios-testes, ignorado pelo Git. As cinco cópias temporárias de sessão da auditoria foram descartadas ao concluir; as sessões originais de tests-e2e/.auth foram preservadas e não devem ser anexadas/compartilhadas. Os servidores locais iniciados pela auditoria foram encerrados. Os artefatos em docs contêm somente síntese sanitizada. Fontes principais:

- Inventário: [source-inventory.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/source-inventory.json).
- Auditoria geral: [general-audit.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/general-audit.json).
- Build: [build.log](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/build.log).
- Rotas e screenshots: [browser-pages.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/browser-pages.json).
- Abas autenticadas: [auth-internal.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/auth-internal.json).
- Filtros/responsividade: [targeted-ui.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/targeted-ui.json).
- Provas isoladas de segurança: [security-isolated-proof.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/security-isolated-proof.json).
- Privacidade por role anon: [anon-contacts-proof.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/anon-contacts-proof.json).
- Acesso GET: [api-read-access.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/api-read-access.json).
- OBS controlado: [obs-controlled.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/obs-controlled.json).
- Dependências: [npm-audit-production.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/npm-audit-production.json), [npm-audit-mobile.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/npm-audit-mobile.json), [npm-audit-desktop.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/npm-audit-desktop.json).
- Banco: [database-live.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/database-live.json), [security-advisors.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/security-advisors.json), [performance-advisors.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/performance-advisors.json), [migrations-live.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/migrations-live.json).
- Suítes: [r205-playwright.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/r205-playwright.json), [r207-summary.json](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/r207-summary.json), [r207-static.log](E:/dropzone-cadastros/relatorios-testes/auditoria-2026-10-10/r207-static.log).

Advisor de senha e orientações oficiais: [proteção contra senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), [RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
