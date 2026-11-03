# Análise geral do DropZone — 03/11/2026

## Parecer

> Atualização: as correções posteriores a este diagnóstico estão registradas em [UX_AJUSTES_20261103.md](E:/dropzone-cadastros/docs/UX_AJUSTES_20261103.md). O texto abaixo preserva a análise da versão `179f712c` como referência anterior às mudanças.

O projeto tem uma base funcional boa, mas **ainda não está 100% revisado ou com a experiência completamente resolvida**. A navegação pública, o seletor de painéis e as permissões de vice-líder funcionaram nos cenários exercitados. Os principais problemas restantes são o carregamento em rede mobile, textos pouco legíveis, semântica de algumas abas e a quantidade de conteúdo secundário antes das tarefas principais.

No PC, home, catálogo, ranking e login tiveram carregamento inicial rápido nesta amostra. A página de um campeonato apresentou LCP tardio também no PC. No celular, a adaptação de largura está boa; a experiência ainda perde qualidade com conexão mais lenta, fontes pequenas e informação importante abaixo da primeira tela.

Esta rodada produziu diagnóstico e evidências. Não modificou a aplicação publicada nem gravou dados de negócio no banco.

## Escopo e método

- Código/produção: commit `179f712c1b6af3aff8ec53f57a0cfa769bcb6102`; [site publicado](https://www.dpzone.site).
- 62 estados de navegador em 22 rotas: páginas públicas, menu, seletor de painéis, cadastro, subabas de campeonato, perfis e uma rota inexistente de propósito.
- Varredura principal em 390 e 1440 px, com casos adicionais em 320 e 768 px. Conferência complementar da home em 1024 e 1920 px.
- Chromium, preferência por movimento reduzido na inspeção visual, axe-core 4.14.0 e verificação adicional de cores computadas. Capturas de imagens abaixo da dobra foram repetidas após rolar e aguardar o carregamento.
- Operações autenticadas com respostas controladas: conta, edição, logout, delegação, revogação, troca de painéis, carrinho guest e convites. As rotas públicas foram consultadas no ambiente publicado.
- Laboratório de desempenho com cache frio. PC sem limitação artificial; mobile com 1,6 Mbit/s de download, latência adicional de 150 ms e CPU 4× mais lenta. Uma amostra por rota/modo; home, catálogo e detalhe de campeonato repetidos até três amostras mobile. Detalhe de campeonato também repetido três vezes no PC.
- Leitura dos avisos de segurança/desempenho e estado do projeto Supabase. Sem alterações de schema, permissões ou índices.

## O que funcionou

- Nenhum erro fatal JavaScript, transbordamento horizontal ou resposta HTTP inesperada de erro nos 62 estados inspecionados. O 404 provocado foi tratado separadamente.
- Seletor de painéis: abre equipes, produtoras e jogadores; distingue vice-líder; busca e rolagem funcionam em tela curta; preserva foco e fechamento por Escape.
- Concessões de edição e revogação passaram nos testes de contextos controlados. As permissões continuam verificadas no servidor.
- Listas compactas/alternadas e separação entre o menu superior e o seletor inferior estão consistentes nos fluxos testados.
- 50 cenários controlados de conta/identidade/navegação e 12 de carrinho/convites passaram nesta rodada.
- Links públicos passaram na rechecagem com prazo adequado. As três imagens de campeonatos na home carregaram após rolar, em 390, 1024 e 1920 px; os blocos vazios de uma captura longa inicial eram imagens lazy ainda fora da área visível.
- Contrato de identidade e contratos locais R06–R12 passaram. O [workflow Quality do commit](https://github.com/ranylson10/dropzone-cadastros/actions/runs/41642066906) está aprovado; o build completo local do mesmo código também havia sido aprovado na publicação.

## P1 — carregamento mobile precisa de otimização

Medianas de LCP nas três navegações mobile: **home 4,65 s**, **catálogo 4,88 s** e **detalhe do campeonato 4,78 s**. As amostras ficaram, respectivamente, em 4,59–5,48 s, 4,83–5,01 s e 4,73–4,85 s. Login e ranking, com uma amostra cada, ficaram em 3,76 s e 4,08 s.

No PC, as amostras únicas de home, catálogo, ranking e login ficaram em 1,09 s, 1,02 s, 0,71 s e 0,54 s. O detalhe de campeonato teve mediana de LCP de **3,98 s**, embora a primeira pintura de conteúdo aparecesse em aproximadamente 0,7 s. Nessa rota o elemento LCP é um contêiner com fundo; a investigação deve distinguir o conteúdo útil da textura decorativa que participa da métrica.

As páginas transferiram aproximadamente **206–232 KiB de CSS** e **238–396 KiB de JavaScript** na primeira coleta. Home e catálogo chegaram a aproximadamente 1,3 MiB de transferência total. O layout raiz importa **32 folhas globais**, somando aproximadamente 1.310 KiB de CSS-fonte, incluindo várias gerações de estilos. Os arquivos locais de fonte também são TTF. São alvos concretos de otimização; os números não provam isoladamente a contribuição de cada recurso.

**Ação recomendada:** separar o CSS necessário por área, remover regras legadas substituídas, manter a identidade no contrato comum, servir fontes menores e dimensionar as imagens para a largura de exibição. Medir novamente com o mesmo cenário antes/depois. Revisar o fundo decorativo do campeonato para que não adie a pintura final.

O objetivo de referência do [Web Vitals](https://web.dev/articles/vitals) é LCP até 2,5 s. Estas coletas são de laboratório, não o p75 de usuários reais; INP real não foi certificado. Os CLS observados ficaram abaixo de 0,1 nesta amostra.

## P1 — há textos com contraste insuficiente

Exemplos reproduzidos e conferidos visualmente:

- Carrinho mobile: “Revise as vagas antes de pagar.” ficou quase invisível, com contraste nominal de aproximadamente **1,27:1**. O fundo foi clareado, mas a cor clara do `span` permaneceu.
- Perfil de equipe: letra do tier “D” sobre o badge claro, aproximadamente **1,10:1**.
- Ranking mobile: a descrição recebe opacidade no elemento e apresentou aproximadamente **3,51:1** no axe. A verificação simples de cor computada não considera toda a opacidade dos ancestrais.
- Recuperação de senha: “Voltar para entrar”, aproximadamente **3,16:1**.
- Iniciais de avatares sem imagem e seleção ativa do menu também tiveram combinações abaixo do contraste esperado.

**Ação recomendada:** corrigir os estados claro/escuro dos componentes compartilhados e testar texto, hover, seleção, fallback e erro. O mínimo de referência para texto comum é [4,5:1 segundo a WCAG](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Marcas e elementos puramente decorativos não foram tratados como bloqueios funcionais; por exemplo, a marca d’água “DZ” não entra nesta prioridade.

Referências de código: [carrinho](E:/dropzone-cadastros/web/app/carrinho/page.tsx:126), [cor legada do subtítulo](E:/dropzone-cadastros/web/features/commerce/commerce-page-refresh.css:42), [tier](E:/dropzone-cadastros/web/features/directory/components/competitive-profile.css:221), [opacidade no ranking](E:/dropzone-cadastros/web/components/lili/rank-list-r18.css:17).

## P2 — semântica das abas e estrutura acessível

O axe sinalizou sete tipos de regra ao longo de 28 estados. Isso é contagem de estados sinalizados, não de bugs únicos nem declaração de que todos têm a mesma gravidade.

- Estatísticas do campeonato: `tablist` contém botões sem o papel de `tab` e sem o conjunto completo de relações/estados de abas.
- Perfil de equipe: as abas principais já possuem papéis e navegação por setas, mas o link “Agenda” fica dentro do `tablist` sem representar uma aba. Isso dispara `aria-required-children`.
- Agenda e Lili não apresentam um H1 de página.
- A primeira seção de informações do campeonato salta níveis de título.
- O menu mobile acrescenta uma busca sem nome que a diferencie das outras buscas.

**Ação recomendada:** padronizar o componente de abas com `tab`, `tabpanel`, seleção, relações e teclado; deixar o link de navegação externa ao grupo de abas. Ajustar os títulos no contexto público e nomear os landmarks de busca. O [padrão de abas do W3C](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) orienta a implementação.

Código: [estatísticas](E:/dropzone-cadastros/web/features/directory/components/ChampionshipPublicView.tsx:704), [abas do perfil](E:/dropzone-cadastros/web/features/directory/components/DirectoryProfileTabs.tsx:184), [menu](E:/dropzone-cadastros/web/components/layout/StorefrontHeader.tsx:185).

## P2 — as tarefas principais aparecem tarde

Na home com 390 px de largura, o primeiro campeonato começa por volta do pixel **752** na vertical. Em uma tela de 844 px com a navegação fixa, sobra muito pouco da competição na primeira tela. Em 1920×900, a primeira competição começa em aproximadamente **944 px**, abaixo da área inicial visível. Há espaço para dar prioridade ao conteúdo procurado sem abandonar a identidade atual.

No perfil público de equipe, uma longa sequência de métricas zero/“Sem dados” antecede as lines e os campeonatos. Isso aumenta bastante a rolagem no celular e mistura ausência de telemetria com desempenho igual a zero.

**Ação recomendada:** encurtar o destaque e os espaçamentos iniciais; aproximar as primeiras competições da busca; recolher a telemetria indisponível em “Mais estatísticas”. Mostrar “Sem informação” quando não há amostra, reservando zero para um resultado realmente medido. Esta é uma recomendação de hierarquia, não um erro de execução.

## P2 — leitura e toque no celular

Os campos de entrada/cadastro estão com **13 px**; ordenação e alguns filtros estão com **12 px**. Links como “Ver todos” têm aproximadamente 17–18 px de altura de área clicável. Há boa largura de página, mas esses controles ainda exigem precisão e esforço de leitura.

**Ação recomendada:** adotar tamanho confortável nos campos mobile, próximo de 16 px, e ampliar a área clicável das ações frequentes mantendo o texto compacto. A [WCAG 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) admite exceções de espaçamento para alvos menores que 24×24 px; portanto, altura pequena sozinha não foi classificada como reprovação automática. Áreas de 44 px são uma meta de conforto para os controles principais do projeto. Comportamento de teclado/zoom no Safari precisa de verificação própria.

## P2 — recuperação de erro e conteúdo publicado

- A rota inexistente mostra o 404 padrão do Next, em inglês, sem a navegação compartilhada ou uma ação clara de retorno. Criar uma página em português com acesso ao início/campeonatos evita um beco sem saída.
- Os diretórios públicos mostram os perfis **“E2E equipe”** e **“E2E jogador”**, inclusive um perfil usado como exemplo público. Esses nomes aparentam ser resíduos de teste e reduzem a confiança no catálogo. Confirmar origem e propriedade antes de ocultar ou remover; esta análise não excluiu registros.

Evidências: [equipe publicada](https://www.dpzone.site/equipes/44d1e322-96df-4feb-b599-1ccc1185a08b), [jogador publicado](https://www.dpzone.site/jogadores/c189a4e8-cfc9-489d-9f7a-5e5c7730b3ae).

## P2 — testes públicos e CI não acompanham todo o redesign

A suíte pública teve 37 aprovações e cinco falhas na primeira execução. Uma falha foi timeout na checagem de links com o prazo reduzido de 25 s; a rechecagem com limite de 90 s passou em aproximadamente 24 s. As outras quatro falhas são dois testes, repetidos em PC/mobile, com expectativas antigas:

- `home-layout-r15`: ainda exige tema azul, largura de até 962 px e hero oculto no mobile.
- `login-flow-smoke`: ainda procura textos e links que foram substituídos na home atual.

Essas quatro falhas não demonstram que a interface atual está quebrada; demonstram que a suíte não representa mais o produto desejado. O workflow Quality executa contratos, tipos, lint e compilação, mas não executa os cenários Playwright de experiência.

**Ação recomendada:** atualizar os testes antigos para o contrato aprovado e incluir uma suíte pequena de navegação/conta/abas/contraste no CI. Usar um orçamento próprio para checagens de links, sem aumentar indiscriminadamente o prazo de todos os testes.

Código: [teste R15](E:/dropzone-cadastros/tests-e2e/public/home-layout-r15.spec.ts:14), [smoke antigo](E:/dropzone-cadastros/tests-e2e/public/login-flow-smoke.spec.ts:4), [pipeline](E:/dropzone-cadastros/.github/workflows/quality.yml:1).

## Banco e segurança: sinais atuais e limites

O projeto Supabase estava `ACTIVE_HEALTHY`. Os advisors retornaram avisos **INFO**, sem avisos WARN/ERROR nessa consulta:

- 84 tabelas com RLS habilitado e sem políticas. Isso não comprova exposição: sem uma política permissiva, o acesso direto fica restrito. O backend deste projeto usa cliente de servidor e valida usuário/vínculo. Revisar o desenho de acesso de cada tabela antes de criar políticas; não liberar o navegador automaticamente. [Orientação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
- 191 chaves estrangeiras sem índice de cobertura. São candidatas a investigação de consultas conforme o volume crescer; o aviso não prova lentidão atual de todas elas. [Orientação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys).
- 32 índices não utilizados nas estatísticas observadas. Não foram removidos; é necessário avaliar retenção das estatísticas e consultas esperadas. [Orientação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
- Auth com limite absoluto de dez conexões; considerar estratégia proporcional ao dimensionar a instância. [Orientação de produção](https://supabase.com/docs/guides/deployment/going-into-prod).

Os contratos de delegação e segurança exercitados passaram. Isso não constitui auditoria integral de segurança ou certificação de todos os caminhos privados.

## Ordem proposta para a próxima rodada

1. Corrigir contraste e semântica de abas, com testes dos estados afetados.
2. Reduzir o carregamento inicial e repetir as medições nas mesmas condições.
3. Ajustar primeira tela, métricas sem amostra, campos e alvos de toque.
4. Criar recuperação 404, verificar os perfis de teste e atualizar testes/CI.
5. Homologar cenários reais em ambiente seguro: login/OAuth em Safari, convites, inscrição, upload, compra/pagamento/retorno e conciliação; incluir testes concorrentes de PostgreSQL e usuários com diferentes permissões.

Não foram certificados nesta rodada: dispositivos físicos, Safari/WebKit, leitores de tela reais, pagamentos reais, todos os cenários de integração, INP/p75 de tráfego real e concorrência real de banco. A auditoria online de dependências da raiz permaneceu fora do escopo, conforme a decisão anterior do proprietário. Esses limites impedem uma afirmação honesta de “100%”.

## Evidências reproduzíveis

Diretório local: [geral-20261103](E:/dropzone-cadastros/relatorios-testes/geral-20261103).

- `browser-report.json`: 62 estados, axe, contraste, controles, erros e capturas.
- `performance.json`, `performance-repeat.json`, `performance-desktop-repeat.json`: recursos, condições e amostras de desempenho.
- `public-tests.json`, `links-recheck.json`: suíte pública e rechecagem.
- `controlled-tests.json`, `commerce-token-tests.json`: 62 cenários controlados aprovados.
- `ux-probes.json`: posição das competições, carregamento das imagens e perfis de teste publicados.
- `database-advisors.json`: resumo dos avisos consultados.

Os scripts de inspeção bloqueiam operações de escrita nas APIs públicas. Relatórios de trabalho ficam ignorados pelo Git; este documento registra a conclusão para revisão.
