# DropZone R23 — Visual premium, movimento e celular estilo aplicativo

## Implementado

- Área autenticada: menu do painel agora também aparece como *bottom sheet*; rotas avançadas, perfil e submenus são preservados.
- Catálogo: menu mobile transformado em *bottom sheet* escura, com backdrop, título, botão fechar, busca e itens existentes. Foco inicial no menu e retorno de foco no fechamento explícito.
- Navegação pública: realce da aba ativa no rodapé, preservando as rotas.
- Navegação interna: estados ativos com `aria-current="page"` nas quatro entradas principais.
- Workspace: ação principal em largura total; as duas secundárias ficam lado a lado até 350 px. Abaixo disso, lista vertical, sem truncamento forçado.
- Motion: entrada rápida dos atalhos e do painel, microinteração em botões, sem bibliotecas novas. Suporte a `prefers-reduced-motion`.
- Transição cliente: links da área prioritária agora usam `next/link` para evitar recarregamento integral ao navegar.
- Foco: contornos visíveis de teclado nos principais controles.

## Escopo intencional

Somente `web/` (interface), testes, documentação e atalhos de execução. Nenhuma alteração em API, banco, migrations, permissões, pagamentos, reservas ou Supabase de produção.

## Como validar no Windows

1. Extraia o ZIP completo R23 numa pasta nova, ou aplique o patch sobre a R22 exata.
2. `npm ci` (se ainda não instalou dependências na pasta).
3. `TESTAR_RODADA_23.bat` — testes estruturais, regressões, typecheck e lint.
4. `HOMOLOGAR_WEB_R19.bat` — build integral do Next.js com as configurações protegidas do projeto.
5. Conferência manual: use 320, 360, 390, 430 e 768 px, com catálogo e contas de produtora, equipe, jogador e manager. Abra/feche menu, navegue com teclado, teste busca, safe-area em celular e modo de movimento reduzido.

Limitação: verificações estruturais não substituem teste visual autenticado nem execução real do aplicativo. R24 fará a revisão e homologação final do redesign.
