# DropZone — R04: navegação, acesso ao painel e tabelas

Data: 21/10/2026. **Escopo: alterações locais, nenhuma publicação nem SQL.**

## Correções entregues

1. **Ação rápida "Minha equipe"** (`AppHeader.tsx`): antes enviava `/?painel=1&section=campeonatos`, abrindo Competições. Agora vai para `/?painel=1&section=dashboard`, seção existente no painel da equipe. Os atalhos de campeonato foram preservados.
2. **Destaque da navegação móvel de Equipes** (`AppHeader.tsx`): antes comparava `activeLabel === 'Equipes'`, mas o menu principal agrupava esses caminhos em `Perfis`. Agora usa a rota de Equipes (`/equipes` e `/equipes/:id`).
3. **Acesso à Minha área em páginas públicas internas** (`StorefrontHeader.tsx`): se uma página renderizava o cabeçalho sem `onAccountClick`, a opção desaparecia. Agora, para conta autenticada, o menu mantém o callback existente quando disponível e apresenta um link funcional para `/?painel=1` quando não existe. A página inicial reconhece `painel=1`.
4. **Mesma apresentação para botão e link de conta** (`storefront-header.css`): estilo e hover agora cobrem ambos os elementos.
5. **Célula inicial em tabelas** (`globals.css`): a regra ampla `td:first-child{display:flex}` era capaz de quebrar o alinhamento do layout nativo da tabela, sobretudo na carteira. A célula mantém `display:table-cell`; a apresentação em blocos para `strong/small` é aplicada aos filhos.
6. **Rolagem horizontal pelo teclado em quatro tabelas** (`admin/page.tsx`, `WalletPanel.tsx`): substituição dos wrappers existentes pela fundação `DataTableViewport`, que fornece rolagem horizontal, `tabIndex=0`, `role=region` e rótulos individuais. O CSS original de `.admin-table-wrap` foi preservado.
7. **Busca do administrador:** adicionado nome acessível ao campo "Pesquisar contas".

## Arquivos alterados

- `web/components/layout/AppHeader.tsx`
- `web/components/layout/StorefrontHeader.tsx`
- `web/components/layout/storefront-header.css`
- `web/app/globals.css`
- `web/app/admin/page.tsx`
- `web/features/billing/WalletPanel.tsx`

Arquivos adicionados: `scripts/testes/test-round4-ui.mjs`, `scripts/testes/rodada04-css-fixture.html`, `TESTAR_RODADA_04.bat`, este relatório.

## Validação realizada

- 15 verificações estruturais R04: **aprovadas** (`node scripts/testes/test-round4-ui.mjs`).
- 6 verificações estruturais R02: **aprovadas**.
- 7 verificações estruturais R03: **aprovadas**.
- 4 arquivos TSX alterados: **sem erros de parse** pelo TypeScript.
- `globals.css` e `storefront-header.css`: **sem erros de parse** pelo PostCSS.
- Chromium de linha de comando: **teste visual não concluído** (execução travou/timeout no ambiente). A fixture foi conservada para reprodução local.
- **Não realizado:** typecheck completo, build Next.js, QA autenticado real, captura/revisão visual 320/390/1280px, testes mobile reais, leitor de tela, publicação e teste conectado ao banco. O projeto ainda necessita de dependências instaladas para essas verificações.

## Instruções simples no Windows

1. Faça backup de seu código atual e arquivos `.env`.
2. Extraia o ZIP **fonte completa R01+R02+R03+R04** numa pasta nova (não misture com `node_modules`, `.next`, `.expo` antigos).
3. Execute `TESTAR_RODADA_04.bat` para os testes locais sem rede. Os testes dependentes do Next.js requerem a instalação das dependências do projeto.
4. Após instalar dependências e configurar as variáveis adequadas de **homologação**, execute `npm run typecheck`, `npm run lint` e `npm run build`, um por vez.
5. Teste manualmente: home e `/?painel=1`; cabeçalho de `/agenda` e `/carteira`; menu móvel Equipes; menu Ações > Minha equipe; tabelas do Admin e histórico da Carteira em 320/390/1280px, inclusive Tab e setas horizontais.

## Banco / segurança

Esta rodada **não modifica Supabase**, não realiza migrations, nem altera APIs/contratos de escrita. A tentativa anterior de implantação no Supabase foi bloqueada pelas configurações da ferramenta; o estado remoto não deve ser anunciado como atualizado. SQLs candidatos R02/R03 seguem pendentes de homologação separada.

## Limites do que foi concluído

Esta é a primeira fatia da R04 focada em falhas reproduzíveis pelo código. Não é uma certificação completa da responsividade ou de todas as 42 páginas. As correções de CSS podem ser testadas estática/estruturalmente; a verificação visual verdadeira ainda precisa de navegador funcional e sessões de teste.
