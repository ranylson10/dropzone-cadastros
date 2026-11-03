# Correções da análise geral — 03/11/2026

## Experiência e acessibilidade

- Contraste compartilhado ajustado para texto de ação e texto secundário. Corrigidos subtítulo do carrinho, tier de perfil, iniciais sem foto, descrição do ranking, recuperação de senha e estados do menu.
- Abas de estatísticas agora expõem seleção/painel e aceitam setas, Home e End. O link Agenda fica fora do grupo de abas do perfil. Títulos públicos e grupos do filtro têm hierarquia semântica correta.
- Linhas de estatísticas mobile usam elementos compatíveis com o papel de item de lista. O componente compartilhado não aceita mais a combinação inválida `article`/`listitem`.
- Campos mobile usam 16 px; links frequentes possuem área de toque ampliada. O nome acessível da marca inclui o rótulo visível.
- A home foi compactada em PC/mobile para aproximar as competições da primeira tela. Estatísticas detalhadas ficam em uma seção expansível. Sem amostra publicada, o painel mostra ausência de informação; zero permanece um resultado válido quando há amostra.
- A página 404 agora está em português, com navegação e ações de retorno.

## Carregamento

- Fontes convertidas para WOFF2 com comparação de mapa de caracteres e métricas dos glifos. Os arquivos TTF originais e a licença foram preservados.
- Artes do componente de campeonato passam pelo otimizador de imagens do Next quando a origem é mídia pública do projeto. Fontes externas continuam funcionando sem a otimização; nenhuma origem arbitrária foi adicionada ao otimizador.
- Os tamanhos de imagem são declarados conforme o espaço de exibição. Imagens decorativas do destaque usam carregamento sob demanda, inclusive quando o grupo é escondido no mobile.
- Imagens com falha mantêm um fallback neutro e o acesso ao campeonato. A textura decorativa do contêiner público deixou de participar da pintura tardia da página.

O CSS global legado continua sendo candidato a uma migração por área. Esta entrega não removeu estilos operacionais indiscriminadamente. As medições posteriores à publicação devem ser comparadas com as condições registradas no diagnóstico original; não se deve tratar uma coleta local como melhora comprovada de produção.

## Qualidade

Os testes públicos foram atualizados para a identidade atual. A checagem de links tem prazo próprio. O CI ganhou um job independente de experiência com build completo e Playwright/axe em PC e mobile, sem credenciais reais ou banco de teste compartilhado. Os dados usados pelo navegador desse job são controlados.

Validação local: build completo, tipos, lint, contratos de identidade/dados e suíte de segurança aprovados. Foram aprovados **104 cenários de regressão** e **8 cenários da suíte de experiência**. A inspeção ampliada registrou **62 estados**, sem alertas nas regras axe verificadas, erros fatais, respostas HTTP inesperadas ou transbordamento. Decoração sem informação, como a marca d’água, não foi tratada como texto funcional.

## Catálogo e banco

Dois perfis de teste foram retirados da descoberta pública pelo estado `suspenso`, preservando conta, registro e vínculos. Antes da atualização, foram confirmados os nomes/usuários esperados, uma identidade de autenticação identificada como E2E e ausência de inscrições em campeonatos. A atualização foi condicionada a essas verificações e conferida em seguida.

- Equipe: `44d1e322-96df-4feb-b599-1ccc1185a08b`.
- Jogador: `c189a4e8-cfc9-489d-9f7a-5e5c7730b3ae`.
- Estado anterior dos dois: `ativo`. Nenhuma conta de autenticação foi removida.

Não houve alteração de schema, políticas RLS, índices, inscrições, pagamentos ou funções concedidas a usuários. Os avisos informativos de índices seguem como planejamento de capacidade, condicionado a consultas e volume reais.

## Alcance

Esta validação não substitui testes em aparelhos físicos/Safari, leitores de tela reais, pagamentos reais e concorrência real de PostgreSQL. O audit online das dependências da raiz permanece fora do escopo, conforme a decisão anterior do proprietário.

Evidências em `relatorios-testes/ux-after`, `ux-regression-final.log`, `ux-ci-experience-final.log`, `ux-final-build.log`, `ux-final-lint.log` e `ux-security.log`.
