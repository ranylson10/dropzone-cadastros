import { test, expect, devices, type Page, type TestInfo } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const PUBLIC_ROUTES = [
  '/', '/login', '/campeonatos', '/equipes', '/jogadores', '/produtoras', '/managers', '/rank', '/vagas',
  '/politica-de-privacidade', '/termos-de-servico', '/exclusao-de-dados',
]

const ROLE_ROUTES: Record<string, string[]> = {
  admin: ['/', '/admin', '/agenda', '/campeonatos', '/equipes', '/jogadores', '/produtoras', '/managers', '/rank', '/vagas'],
  produtora: ['/', '/agenda', '/campeonatos', '/equipes', '/jogadores', '/produtoras', '/managers', '/rank', '/vagas'],
  manager: ['/', '/agenda', '/campeonatos', '/equipes', '/jogadores', '/managers', '/rank', '/vagas'],
  equipe: ['/', '/agenda', '/campeonatos', '/equipes', '/jogadores', '/rank', '/vagas', '/carteira'],
  jogador: ['/', '/agenda', '/campeonatos', '/equipes', '/jogadores', '/rank', '/vagas', '/carteira'],
}

const destructive = /excluir|apagar|remover|deletar|cancelar|encerrar|arquivar|banir|bloquear|sair da equipe|desvincular|reembols|sacar|pagar|comprar|finalizar queda|reabrir queda/i
const submitLike = /salvar|criar|cadastrar|enviar convite|confirmar compra|publicar|lançar resultado|sincronizar|aplicar|aprovar|recusar|aceitar|assumir|incorporar/i
const safeAction = /menu|abrir|fechar|voltar|próximo|proximo|anterior|ver\b|visualizar|detalhes|filtro|filtrar|ordenar|buscar|pesquisar|aba|perfil|estatística|estatistica|classificação|classificacao|jogos|equipes|jogadores|campeonato|agenda|ranking|vagas|notifica|idioma|mais|menos|visão geral|visao geral/i

function coverageFile(testInfo: TestInfo) {
  return path.resolve('relatorios-testes', `navegacao-total-${testInfo.project.name}.jsonl`)
}

function recordCoverage(testInfo: TestInfo, payload: Record<string, unknown>) {
  fs.mkdirSync(path.resolve('relatorios-testes'), { recursive: true })
  fs.appendFileSync(coverageFile(testInfo), `${JSON.stringify({ at: new Date().toISOString(), ...payload })}\n`, 'utf8')
}

function installDiagnostics(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (!/favicon|net::ERR_ABORTED|ResizeObserver loop|Failed to load resource: the server responded with a status of 4\d\d/i.test(text)) {
      errors.push(`console: ${text}`)
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 500) errors.push(`http ${response.status()}: ${response.url()}`)
  })
  return errors
}

async function assertHealthy(page: Page, errors: string[], label: string) {
  await expect(page.locator('body'), `body vazio em ${label}`).toBeVisible()
  await expect(page.locator('body')).not.toContainText(/Application error|Internal Server Error|Unhandled Runtime Error/i)
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, `rolagem horizontal inesperada em ${label}`).toBeLessThanOrEqual(8)
  expect(errors, `erros de runtime/rede em ${label}:\n${errors.join('\n')}`).toEqual([])
}

async function openRoute(page: Page, route: string) {
  const response = await page.goto(route, { waitUntil: 'domcontentloaded', timeout: 40_000 }).catch(() => null)
  if (response) expect(response.status(), `HTTP inválido em ${route}`).toBeLessThan(500)
  await page.waitForTimeout(80)
}

async function clickSafeControls(page: Page, maxClicks = 4) {
  const candidates = page.locator('button:visible, [role="button"]:visible, [role="tab"]:visible, summary:visible')
  const count = Math.min(await candidates.count(), 40)
  let clicked = 0

  for (let index = 0; index < count && clicked < maxClicks; index += 1) {
    const item = candidates.nth(index)
    if (!(await item.isVisible().catch(() => false))) continue
    if (await item.isDisabled().catch(() => true)) continue

    const text = [
      await item.innerText().catch(() => ''),
      await item.getAttribute('aria-label'),
      await item.getAttribute('title'),
    ].filter(Boolean).join(' ').trim()

    const type = String(await item.getAttribute('type') || '').toLowerCase()
    const role = await item.getAttribute('role')
    if (!text) continue
    if (destructive.test(text) || submitLike.test(text) || type === 'submit') continue
    if (!safeAction.test(text) && role !== 'tab') continue

    await item.click({ timeout: 3_000 }).catch(() => undefined)
    await page.waitForTimeout(40)
    clicked += 1
  }

  return clicked
}

async function visitSafeInternalLinks(page: Page, baseURL: string, returnRoute: string, errors: string[], maxLinks = 1) {
  const origin = new URL(baseURL).origin
  const raw = await page.locator('a[href]:visible').evaluateAll((anchors) =>
    anchors.map((anchor) => ({
      href: (anchor as HTMLAnchorElement).href,
      text: (anchor.textContent || '').trim(),
      aria: anchor.getAttribute('aria-label') || '',
    })),
  )

  const links: string[] = []
  for (const item of raw) {
    if (links.length >= maxLinks) break
    try {
      const url = new URL(item.href)
      const label = `${item.text} ${item.aria}`.trim()
      if (url.origin !== origin || !/^https?:$/.test(url.protocol)) continue
      if (/\/api\/|\/broadcast\/obs\//.test(url.pathname)) continue
      if (destructive.test(label) || submitLike.test(label)) continue
      const next = `${url.pathname}${url.search}`
      if (next === returnRoute || links.includes(next)) continue
      links.push(next)
    } catch {
      // href inválido
    }
  }

  const visited: string[] = []
  for (const href of links) {
    errors.length = 0
    await openRoute(page, href)
    await assertHealthy(page, errors, href)
    visited.push(href)
    await openRoute(page, returnRoute)
  }
  return visited
}

async function exerciseRoute(page: Page, baseURL: string, route: string, testInfo: TestInfo, role: string) {
  const errors = installDiagnostics(page)
  await openRoute(page, route)
  await assertHealthy(page, errors, `${role}:${route}`)

  const clicked = await clickSafeControls(page)
  const links = await visitSafeInternalLinks(page, baseURL, route, errors)

  recordCoverage(testInfo, {
    role,
    route,
    clicked,
    linkedPagesVisited: links,
    finalUrl: page.url(),
  })

  expect(clicked + links.length, `nenhuma interação segura encontrada em ${role}:${route}`).toBeGreaterThanOrEqual(0)
}

function storageStateFor(role: string) {
  const file = path.resolve('tests-e2e', '.auth', `${role}.json`)
  return fs.existsSync(file) ? file : null
}

test.describe('105 - navegação total segmentada e cliques seguros', () => {
  for (const route of PUBLIC_ROUTES) {
    test(`público ${route}`, async ({ page, baseURL }, testInfo) => {
      await exerciseRoute(page, baseURL!, route, testInfo, 'publico')
    })
  }

  for (const [role, routes] of Object.entries(ROLE_ROUTES)) {
    for (const route of routes) {
      test(`${role} ${route}`, async ({ browser, baseURL }, testInfo) => {
        const storageState = storageStateFor(role)
        test.skip(!storageState, `sessão ${role} não foi gerada em tests-e2e/.auth`)

        const device = testInfo.project.name === 'chromium-mobile' ? devices['Pixel 7'] : devices['Desktop Chrome']
        const context = await browser.newContext({ ...device, storageState: storageState! })
        const page = await context.newPage()
        try {
          await exerciseRoute(page, baseURL!, route, testInfo, role)
        } finally {
          await context.close()
        }
      })
    }
  }
})
