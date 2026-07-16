# Layout centralizado

O chrome visual do DropZone (barra superior + navegação) **não se edita página por página**.

## Fonte de verdade

| O quê | Onde |
|---|---|
| Itens do menu | `web/components/layout/nav.ts` → `APP_NAV` |
| Header visual | `web/components/layout/AppHeader.tsx` + CSS `.app-header` |
| Shell (header + main) | `web/components/layout/AppShell.tsx` |

## Como usar em páginas novas

```tsx
import { AppShell } from '@/components/layout'

export default function MinhaPage() {
  return (
    <AppShell activeLabel="Campeonatos" loadSession mainClassName="directory-page page">
      {/* conteúdo */}
    </AppShell>
  )
}
```

### Painel autenticado (conta já resolvida)

```tsx
<AppShell
  account={account}
  accounts={accounts}
  onSwitchAccount={...}
  onSignOut={...}
  activeLabel="Início"
  mainClassName="page page-authenticated"
>
  ...
</AppShell>
```

## Mudar o layout global

1. **Menu:** edite só `APP_NAV` em `nav.ts`
2. **Aparência do header:** edite `.app-header` / `.app-main-nav` em `globals.css`
3. **Comportamento:** edite `AppHeader.tsx` ou `AppShell.tsx`
4. **Cores / tema do sistema:** edite só o bloco `:root` em `web/app/globals.css`  
   (`--bg`, `--surface`, `--text`, `--brand`, `--bg-texture`, etc.).  
   Páginas e painéis devem usar `var(--*)` — não hardcode `#fff` / `#000` solto.

Não crie outro header (ex.: `PublicDirectoryHeader` custom).  
`PublicDirectoryHeader` é só alias legado.

Tema de **campeonato** (cores escolhidas pelo admin) é escopo local via `.champ-theme` e não substitui o tema global do app.

## Páginas já no shell

- Painel (`DropZoneHome`)
- Diretórios (`/campeonatos`, `/equipes`, …)
- Perfis do diretório
- Vagas / vendedor
- Login central
- Páginas legais
