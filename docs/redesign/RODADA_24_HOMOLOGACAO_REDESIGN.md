# DropZone R24 — Revisão final do redesign R20–R24

Base: ZIP completo R23. Escopo R24: ajustes finais da experiência mobile e instrumentos de validação. **Não altera tabelas, APIs, migrações, pagamentos, inscrições ou permissões.**

## Alterações concretas

1. A navegação inferior pública agora foca o botão antes de abrir o menu, assim `Escape` pode devolver o foco ao controle correto, inclusive no teclado.
2. Os dois menus inferiores — público e autenticado — receberam contenção opcional de `Tab` e `Shift+Tab`: na última ação o foco volta à primeira, e vice-versa. O comportamento dos popovers de conta e idioma não foi alterado.
3. O clique no fundo escurecido fecha o menu e tenta devolver o foco ao disparador. O texto acessível do botão Menu passa a corresponder ao estado aberto/fechado.
4. Uma camada CSS final protege as etiquetas de cinco destinos em telefones estreitos (320–380 px), garante alvo de toque dos botões de fechar e limita transbordamento de descrições longas.
5. Removidos seis arquivos vazios e desnecessários da raiz do pacote (`eslint`, `next`, `npm`, `tsc` e dois nomes de workspaces); nenhum código ou dado foi alterado por essa limpeza.
6. Teste de algoritmo de foco sem navegador, teste de CSS e estrutura via Node e roteiro Playwright **somente leitura** para o catálogo público.

## Teste rápido no Windows

Abra o CMD na pasta extraída da R24. A rotina de testes inclui as verificações históricas R01–R24, TypeScript e lint:

```cmd
npm ci
TESTAR_RODADA_24.bat
HOMOLOGAR_WEB_R19.bat
```

O segundo `.bat` (R19) é a checagem de build integral já existente. Ele usa ambiente protegido; não publique informações de `.env.local` no relatório.

Para navegar pelo catálogo no Chromium, execute:

```cmd
npx playwright install chromium
HOMOLOGAR_MOBILE_R24.bat
```

O Playwright usa o servidor Next.js local configurado em `playwright.config.ts` e testa apenas acesso GET a páginas públicas. Não executa mutações. Se faltar Supabase de **homologação** ou dependências, o teste deve falhar, não ser marcado como aprovado.

## Checklist visual manual — obrigatório antes do deploy

| Contexto | Tarefa | Critério de aceite |
|---|---|---|
| Público 320/360/390/430/768 px | Abrir Campeonatos, Equipes, Jogadores | Sem rolagem horizontal, navegação inferior com cinco destinos visíveis |
| Público mobile | Menu / busca | Menu pode rolar sem mover o conteúdo atrás; Escape e fechar devolvem o foco |
| Público 1024/1440 px | Navegação desktop | Barra inferior não aparece, menus e sidebar continuam acessíveis |
| Produtora (conta de teste) | Criar campeonato rápido | Dados essenciais e confirmação; botão Configurar campeonato abre o novo cadastro |
| Produtora (conta de teste) | Configurar campeonato | Fases, grupos, jogos e equipes continuam acessíveis |
| Equipe (conta de teste) | Elenco e inscrições | Ações principais e menus avançados funcionam com as permissões corretas |
| Jogador (conta de teste) | Equipes e competições | Não perde convites nem páginas de perfil |
| Manager/vendedor (conta de teste) | Alternar Início/Vendas | Cada painel mostra ações do seu contexto, sem misturar perfis |
| Todos | Teclado / leitor de tela | Escape, Tab, Shift+Tab, rótulos legíveis, foco visível |
| Todos | Movimento reduzido | `prefers-reduced-motion: reduce` não obriga transições/loops |
| Produção | Critérios de liberação | Build completo, smoke E2E, regressões e SQL pendente validados separadamente |

> Não execute o checklist autenticado em produção com operações destrutivas. Use contas e campeonatos fictícios no ambiente de homologação. Os testes R24 automatizados não cobrem esses fluxos autenticados.

## Limitações da entrega

- A execução local em ambiente sem as dependências do Next.js não comprova o build completo; o processo de CI e o `HOMOLOGAR_WEB_R19.bat` precisam ser executados no Windows/CI.
- Os testes Playwright públicos foram acrescentados, mas só podem ser considerados aprovados após execução em navegador real com um servidor local funcional.
- Os cinco perfis precisam de sessão de teste real para avaliação visual e funcional. Nenhuma sessão nem arquivo `.env` foi incluído nos pacotes.
- O redesign R20–R24 está implementado na cópia do projeto, mas isso **não** significa que o banco PostgreSQL e suas migrations candidatas estejam homologados.

## Arquivos-chave

- `web/components/ui/useDisclosureFocus.ts`
- `web/components/ui/sheet-tab-order.ts`
- `web/components/layout/StorefrontHeader.tsx`
- `web/components/layout/AppHeader.tsx`
- `web/styles/redesign-qa-r24.css`
- `scripts/testes/test-round24-redesign-final.mjs`
- `tests-e2e/public/rodada-24-mobile-ux.spec.ts`
- `TESTAR_RODADA_24.bat` e `HOMOLOGAR_MOBILE_R24.bat`

## Hotfix pós-teste Chromium no Windows (03/11/2026)

O primeiro teste Playwright real da R24 terminou com 4 aprovações e 2 falhas:

- **768 px:** o botão flutuante da Lili cobria o botão Menu do dock público, impedindo o clique. A navegação pública já usa o dock até 1023 px; a regra para ocultar o launcher da Lili terminava em 767 px. A regra final em `web/styles/redesign-qa-r24.css` agora cobre `max-width: 1023px`. A Lili continua no Menu público. O E2E passou a verificar explicitamente que o launcher não pode interceptar o clique.
- **320 px:** `page.goto('/campeonatos')` excedeu 30 segundos no Next.js local do Windows; a causa definitiva **não foi comprovada** pelo log. O tempo para navegação foi ajustado para 90 segundos, com orçamento de 120 segundos para o caso E2E, para acomodar compilação inicial sob demanda. A página ainda precisa carregar e todos os asserts continuam obrigatórios.

As 55 verificações offline da R24 e regressões R20–R23 passaram na cópia corrigida. **O E2E real ainda precisa ser repetido no Windows**; o hotfix não é uma aprovação antecipada.

Para reaplicar apenas este hotfix, copie o conteúdo do patch para a raiz do projeto e execute:

```cmd
TESTAR_RODADA_24.bat
HOMOLOGAR_MOBILE_R24.bat
```

Não é necessário reinstalar as dependências se `npm ci` já foi executado com sucesso.
