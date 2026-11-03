# Correções da análise geral — 03/11/2026

## Experiência e acessibilidade

- Contraste compartilhado ajustado para texto de ação e texto secundário. Corrigidos subtítulo do carrinho, tier de perfil, iniciais sem foto, descrição do ranking, recuperação de senha e estados do menu.
- Abas de estatísticas agora expõem seleção/painel e aceitam setas, Home e End. O link Agenda fica fora do grupo de abas do perfil. Títulos públicos e grupos do filtro têm hierarquia semântica correta.
- Linhas de estatísticas mobile usam elementos compatíveis com o papel de item de lista. O componente compartilhado não aceita mais a combinação inválida `article`/`listitem`.
- Campos mobile usam 16 px; links frequentes possuem área de toque ampliada. O nome acessível da marca inclui o rótulo visível.
- A home foi compactada em PC/mobile para aproximar as competições da primeira tela. Estatísticas detalhadas ficam em uma seção expansível. Sem amostra publicada, o painel mostra ausência de informação; zero permanece um resultado válido quando há amostra.
- A página 404 agora está em português, com navegação e ações de retorno.
- O catálogo mobile tem título curto e linhas alternadas, com miniaturas de 48 px, inscrição, vagas, premiação e data. Os destaques promocionais ficam no PC. A regra pertence à identidade canônica; a folha mobile antiga não voltou a ser importada.
- Favoritos usa o conteúdo nativo do controle como nome acessível. O link da imagem inclui o estado mostrado no selo; a utilidade compartilhada `sr-only` mantém rótulos auxiliares disponíveis sem aparecerem na tela.

## Carregamento

- Fontes convertidas para WOFF2 com comparação de mapa de caracteres e métricas dos glifos. Os arquivos TTF originais e a licença foram preservados.
- Artes do componente de campeonato passam pelo otimizador de imagens do Next quando a origem é mídia pública do projeto. Fontes externas continuam funcionando sem a otimização; nenhuma origem arbitrária foi adicionada ao otimizador.
- Os tamanhos de imagem são declarados conforme o espaço de exibição. Imagens decorativas do destaque usam carregamento sob demanda, inclusive quando o grupo é escondido no mobile.
- Imagens com falha mantêm um fallback neutro e o acesso ao campeonato. A textura decorativa do contêiner público deixou de participar da pintura tardia da página.
- A primeira arte da home recebe carregamento imediato e prioridade alta. As demais continuam sob demanda. Variantes de 360/480 px evitam entregar a arte de 640 px a uma área de 354 px em uma tela DPR 1.
- Miniaturas e destaques do catálogo também usam o otimizador. O tamanho declarado acompanha os 48 px no mobile e a grade no PC; o fallback preserva os nomes e links quando a mídia falha.

O CSS global legado continua sendo candidato a uma migração por área. Esta entrega não removeu estilos operacionais indiscriminadamente.

### Conferência no domínio de produção

Código medido: `4732154f936cd7fcf360dd53bafeaeda80f97a9b`, publicado em `www.dpzone.site`. Medianas de três navegações por rota/modo, com cache do navegador frio. Mobile: Chromium 390 × 844, DPR 1, download de 1,6 Mbit/s, latência adicional de 150 ms e CPU 4×. PC: 1440 × 900 sem limitação. O cache do CDN não foi controlado; isto não certifica INP ou p75 de usuários reais.

- Home mobile: transferência total mediana de **1.255 para 802 KiB**; primeira pintura de **3,86 para 3,66 s**. O LCP passou de **4,65 para 6,16 s**. A primeira competição agora aparece na dobra, e sua imagem substituiu o fundo decorativo do destaque como maior elemento. A prioridade e o tamanho da arte foram corrigidos, mas o carregamento público após a hidratação e o CSS global ainda precisam de trabalho. **Não houve melhora de LCP na home mobile.**
- Catálogo mobile: **1.276 para 745 KiB**, com LCP de **4,88 para 4,11 s**.
- Campeonato mobile: LCP de **4,78 para 4,47 s**.
- Campeonato no PC: LCP de **3,98 para 0,76 s**, após separar a pintura decorativa tardia. Home e catálogo ficaram em **1,04 s** e **0,78 s**; os valores iniciais dessas duas rotas no PC tinham uma única amostra.
- CLS observado: **0** nas amostras finais. Isso não equivale a certificação de todos os estados e dispositivos.

Home e catálogo publicados foram reconferidos em 390/1440 px: imagens entregues, nenhuma violação nas regras axe verificadas, erro de execução, HTTP inesperado ou transbordamento. A indisponibilidade da arte da lista foi simulada com sucesso. Os dois jobs do GitHub Quality, `checks` e `experience`, passaram no commit medido. Evidências: `ux-after/performance-summary.json`, `performance-final.json`, `performance-desktop-final.json` e `images-production.json`.

## Qualidade

Os testes públicos foram atualizados para a identidade atual. A checagem de links tem prazo próprio. O CI ganhou um job independente de experiência com build completo e Playwright/axe em PC e mobile, sem credenciais reais ou banco de teste compartilhado. Os dados usados pelo navegador desse job são controlados.

Validação local: build completo, tipos, lint, contratos de identidade/dados e suíte de segurança aprovados. Foram aprovados **104 cenários de regressão** e **8 cenários da suíte de experiência**. A inspeção ampliada registrou **62 estados**, sem alertas nas regras axe verificadas, erros fatais, respostas HTTP inesperadas ou transbordamento. Decoração sem informação, como a marca d’água, não foi tratada como texto funcional.

Na conferência complementar das imagens e do catálogo, **23 cenários passaram** e um caso exclusivo de mobile foi ignorado no PC. Isso inclui rechecagens de perfil/agenda e atualização das expectativas antigas de navegação/layout de R197/R208. Quatro estados de home/catálogo em PC/mobile passaram no axe, sem erros de execução, HTTP ou transbordamento; a falha de imagens da lista também foi simulada. Evidências: `ux-image-regression-final.log`, `ux-image-build-final.log`, `ux-image-lint-final.log` e `ux-after/images-local.json`.

## Catálogo e banco

Dois perfis de teste foram retirados da descoberta pública pelo estado `suspenso`, preservando conta, registro e vínculos. Antes da atualização, foram confirmados os nomes/usuários esperados, uma identidade de autenticação identificada como E2E e ausência de inscrições em campeonatos. A atualização foi condicionada a essas verificações e conferida em seguida.

- Equipe: `44d1e322-96df-4feb-b599-1ccc1185a08b`.
- Jogador: `c189a4e8-cfc9-489d-9f7a-5e5c7730b3ae`.
- Estado anterior dos dois: `ativo`. Nenhuma conta de autenticação foi removida.

Não houve alteração de schema, políticas RLS, índices, inscrições, pagamentos ou funções concedidas a usuários. Os avisos informativos de índices seguem como planejamento de capacidade, condicionado a consultas e volume reais.

## Alcance

Esta validação não substitui testes em aparelhos físicos/Safari, leitores de tela reais, pagamentos reais e concorrência real de PostgreSQL. O audit online das dependências da raiz permanece fora do escopo, conforme a decisão anterior do proprietário.

Evidências em `relatorios-testes/ux-after`, `ux-regression-final.log`, `ux-ci-experience-final.log`, `ux-final-build.log`, `ux-final-lint.log` e `ux-security.log`.
