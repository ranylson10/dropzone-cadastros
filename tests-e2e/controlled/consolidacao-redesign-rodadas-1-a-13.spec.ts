import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
const root=process.cwd()
const read=(p:string)=>fs.readFileSync(path.join(root,p),'utf8')

test.describe('Consolidação cumulativa — Rodadas 1 a 13',()=>{
  test('fundação, modal e formulário não regressam',()=>{
    const css=read('web/app/globals.css')
    const form=read('web/components/forms/campeonato/CampeonatoForm.tsx')
    expect(css).toContain('--ui-bg: #0c0d0f')
    expect(css).toContain('--ui-accent: #c9b766')
    expect(css).toContain('.system-modal{ --surface: var(--ui-surface)')
    expect(css).toContain('background: var(--ui-surface); color: var(--ui-text); box-shadow: none')
    expect(form).toContain('<span className="championship-step-index">1 de 2</span>')
    expect(form).toContain('<h3>Escolha o formato</h3>')
    expect(form).toContain('<strong>Nova edição</strong>')
    expect(css).not.toContain('backdrop-filter: blur(9px)')
  })

  test('shell e Home permanecem na versão aprovada',()=>{
    const home=read('web/features/home/authenticated-home.css')
    const header=read('web/app/header.css')
    expect(home).toContain('--home-bg:var(--ui-bg,#0c0d0f)')
    expect(home).toContain('--home-accent:var(--ui-accent,#c9b766)')
    expect(home).not.toContain('--home-accent:#ef3340')
    expect(home).not.toContain('--home-card:#fff')
    expect(home).toContain('.authenticated-home-overview{display:none}')
    expect(home).toContain('grid-template-columns:92px minmax(0,1fr)')
    expect(header).toContain('.app-mobile-toggle')
    expect(header).toContain('.app-mobile-profile-switcher')
  })

  test('diretório e central não dependem de CSS legado no globals',()=>{
    const globalCss=read('web/app/globals.css')
    const dir=read('web/features/directory/components/championship-directory.css')
    const central=read('web/components/campeonatos/championship-central.css')
    expect(globalCss).not.toContain('.directory-champ-card-grid{')
    expect(globalCss).not.toContain('.championship-central-header')
    expect(dir).toContain('.directory-champ')
    expect(central).toContain('.championship-central')
  })

  test('equipes, jogos e estatísticas mantêm CSS próprios',()=>{
    expect(read('web/features/campeonatos/equipes/components/CampeonatoEquipesTab.tsx')).toContain("import '../campeonato-equipes.css'")
    expect(read('web/features/campeonatos/jogos/components/CampeonatoJogosTab.tsx')).toContain("import '../campeonato-jogos.css'")
    expect(read('web/features/campeonatos/estatisticas/components/CampeonatoEstatisticasTab.tsx')).toContain("import '../campeonato-estatisticas.css'")
  })

  test('editores, agenda, carteira e calls continuam no dark/gold',()=>{
    expect(read('web/features/campeonatos/artes-postagem/post-artworks.css')).toContain('var(--ui-bg,#0c0d0f)')
    expect(read('web/features/campeonatos/stream/stream.css')).toContain('var(--ui-bg, #0c0d0f)')
    expect(read('web/features/agenda/agenda.css')).toContain('var(--ui-surface, #141518)')
    expect(read('web/features/billing/WalletPanel.tsx')).toContain("import './wallet-panel.css'")
    expect(read('web/features/campeonatos/calls/components/calls.css')).toContain('var(--ui-surface,#141518)')
  })

  test('commerce mantém schema real e checkout sem mensagem mascarada',()=>{
    const cart=read('web/app/api/me/commerce/cart/route.ts')
    const wish=read('web/app/api/me/commerce/wishlist/route.ts')
    const checkout=read('web/app/api/me/commerce/cart/checkout/route.ts')
    expect(cart).toContain('campeonato_configuracoes')
    expect(wish).toContain('campeonato_configuracoes')
    expect(checkout).not.toContain('Rode a migration 20260808_commerce_cart_wishlist.sql.')
  })
})
