import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const refreshCss = read('web/app/dropzone-refresh.css')
const homeCss = read('web/features/home/authenticated-home.css')
const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const header = read('web/components/layout/StorefrontHeader.tsx')
const headerCss = read('web/components/layout/storefront-header.css')
const teamPanel = read('web/features/dropzone/panels/equipe/EquipePanel.tsx')
const playerPanel = read('web/features/dropzone/panels/jogador/JogadorPanel.tsx')
const managerPanel = read('web/features/dropzone/panels/manager/ManagerPanel.tsx')
const producerPanel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')

const publicRoutes = ['/', '/campeonatos', '/vagas', '/equipes', '/jogadores', '/rank', '/comunidade']

test.describe('Rodada 160 — layout completo e marketplace', () => {
  test('tema principal evita fundo preto chapado e usa grafite, papel e amarelo', () => {
    expect(refreshCss).toContain('--dz-paper:#f1f3f5')
    expect(refreshCss).toContain('--dz-ink:#171a1f')
    expect(refreshCss).toContain('--dz-yellow:#f2c900')
    expect(homeCss).toContain('--store-paper:#eef1f4')
  })

  test('texturas locais fazem parte da composição sem imagem gerada', () => {
    expect(refreshCss).toContain("url('/ui/texture-halftone.svg')")
    expect(refreshCss).toContain("url('/ui/texture-speedlines.svg')")
    expect(refreshCss).toContain("url('/ui/texture-brush.svg')")
    expect(fs.existsSync(path.join(root, 'web/public/ui/texture-halftone.svg'))).toBeTruthy()
    expect(fs.existsSync(path.join(root, 'web/public/ui/texture-speedlines.svg'))).toBeTruthy()
    expect(fs.existsSync(path.join(root, 'web/public/ui/texture-brush.svg'))).toBeTruthy()
  })

  test('home trata slide sem imagem sem criar vazio escuro gigante', () => {
    expect(home).toContain("hero.image_url ? 'has-media' : 'no-media'")
    expect(refreshCss).toContain('.store-home-hero.no-media')
    expect(refreshCss).toContain('height:410px')
  })

  test('header público destaca venda de vagas e mantém busca', () => {
    expect(header).toContain("{ label: 'VAGAS', href: '/vagas' }")
    expect(header).toContain('CAMPEONATOS COM VAGAS ABERTAS')
    expect(header).toContain('store-home-header-search')
    expect(headerCss).toContain('--store-accent:#f2c900')
  })

  test('home continua sendo vitrine de dados reais', () => {
    expect(home).toContain("fetch('/api/vagas'")
    expect(home).toContain('store-home-categories')
    expect(home).toContain('store-home-products')
    expect(home).toContain('store-home-promos')
  })

  test('painéis de equipe, jogador, produtora e manager possuem hierarquia por tarefa', () => {
    expect(teamPanel).toContain('Elenco, campeonatos, agenda e desempenho organizados por tarefa.')
    expect(playerPanel).toContain('Acompanhe equipe, competições, agenda e sua evolução competitiva.')
    expect(producerPanel).toContain('Fluxo operacional')
    expect(producerPanel).toContain('Do cadastro ao resultado')
    expect(managerPanel).toContain('manager-guide-grid')
  })

  test('camadas operacionais cobrem administração, carteira, agenda e central', () => {
    expect(refreshCss).toContain('.system-admin-page')
    expect(refreshCss).toContain('.bank-wallet-hero')
    expect(refreshCss).toContain('.agenda-toolbar')
    expect(refreshCss).toContain('.championship-central-header')
  })

  test('rotas públicas comerciais e de descoberta não estouram horizontalmente', async ({ page }) => {
    for (const route of publicRoutes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('body')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, `overflow horizontal em ${route}`).toBeLessThanOrEqual(2)
    }
  })

  test('header público aparece nas rotas principais após a home', async ({ page }) => {
    for (const route of ['/campeonatos', '/vagas', '/equipes', '/jogadores', '/rank', '/comunidade']) {
      await page.goto(route, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('.store-home-header')).toBeVisible()
    }
  })

  test('home exibe categorias compactas e conteúdo sobre superfície clara', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.store-home-categories')).toBeVisible()
    const values = await page.locator('.store-home').evaluate((node) => {
      const style = getComputedStyle(node)
      const cards = Array.from(node.querySelectorAll<HTMLElement>('.store-home-categories>a'))
      return { background: style.backgroundColor, heights: cards.map((card) => card.getBoundingClientRect().height) }
    })
    expect(values.heights.length).toBeGreaterThanOrEqual(6)
    expect(Math.max(...values.heights)).toBeLessThanOrEqual(170)
    expect(values.background).not.toBe('rgb(0, 0, 0)')
  })
})
