# Relatório de alteração — R01 + R02

Projeto de origem: `dropzone-cadastros.zip` (09/10/2026).
Data: 09/10/2026.

## Arquivos de aplicação modificados

1. `web/components/layout/StorefrontHeader.tsx` — atualização dos controles visuais, sidebar e menu inferior; lógica de tela descoberta por pathname; preserva `authenticated` e `onAccountClick`.
2. `web/components/layout/storefront-header.css` — CSS substituído pelo shell público responsivo (tokens de layout; sem interferir em shell operacional).
3. `web/styles/dz-layout-tokens.css` — NOVO conjunto de tokens estruturais.
4. `web/app/layout.tsx` — importa tokens estruturais.
5. `web/features/home/AuthenticatedHomeFeed.tsx` — importa CSS de densidade e usa `div.store-home-body` no lugar de `<main>` interno.
6. `web/features/home/home-density-v1.css` — NOVO CSS restrito à home; card oficial intacto.

## Arquivos auxiliares novos

- `scripts/testes/audit-discovery-layout-r01-r02.mjs`
- `docs/design-system/RODADAS_LAYOUT_DROPZONE_V1.md`
- `docs/design-system/RELATORIO_ALTERACOES_R01_R02.md`

## Nenhum destes arquivos foi modificado

- `web/components/championship/ChampionshipCard.tsx`
- `web/components/layout/AppShell.tsx`, `AppHeader.tsx`, `nav.ts`
- `backend/**`, `database/**`, `supabase/**`
- Rotas/API, payloads, contratos de pagamento, autenticação e Engine
- `desktop/**` e `app/**` (mobile nativo)

## Testes executados neste ambiente

- Parser TypeScript (3 arquivos TS/TSX): PASSOU.
- Parser PostCSS (3 novos/alterados CSS): PASSOU.
- Auditoria estática customizada R01/R02 (16 controles): PASSOU.
- `node scripts/testes/audit-layout-pages.mjs`: PASSOU, 43/43 rotas e 16/16 subáreas.
- `node scripts/testes/audit-championship-card.mjs`: PASSOU, 15/15.
- `node scripts/testes/audit-final-r207.mjs`: PASSOU, 15/15 auditorias acumuladas.
- ESLint de `StorefrontHeader.tsx`, `AuthenticatedHomeFeed.tsx`, `layout.tsx`: PASSOU, sem erros.
- Typecheck completo: INCONCLUSIVO — excedeu tempo disponível; não afirmar aprovação.
- Smoke test geométrico via Chromium com HTML representativo (320/390/768/1100/1440px): PASSOU após correção da altura do hero mobile; não substitui E2E do aplicativo.
- Build completo, E2E Playwright no aplicativo e snapshots autenticados: NÃO EXECUTADOS.

## Implantação e rollback

O ZIP de código completo é uma **cópia de desenvolvimento sem node_modules e sem segredos**.
Não sobrescrever diretamente produção. Testar localmente em homologação primeiro.

No ZIP `PATCH_R01_R02.zip`, a pasta `ALTERADOS` contém os arquivos prontos para substituir pelos mesmos caminhos relativos; `BACKUP_ORIGINAL` contém os originais correspondentes para desfazer a rodada. Antes de copiar, fechar o servidor Next e salvar uma cópia do projeto.

## Comandos de validação no Windows (CMD na pasta raiz)

```bat
npm install
npm run typecheck
npm run lint
node scripts/testes/audit-discovery-layout-r01-r02.mjs
node scripts/testes/audit-layout-pages.mjs
node scripts/testes/audit-championship-card.mjs
node scripts/testes/audit-final-r207.mjs
npm run build
```

Só depois de aprovar a homologação, seguir o processo de deploy normal do projeto.
