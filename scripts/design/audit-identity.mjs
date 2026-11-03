import fs from 'node:fs/promises'
import path from 'node:path'
import { chromium } from '@playwright/test'
import { inspectIdentity } from './inspect-identity.mjs'
import { inspectContrast } from './inspect-contrast.mjs'

const options = Object.fromEntries(process.argv.slice(2).filter(arg => arg.startsWith('--')).map(arg => {
  const [key, ...value] = arg.slice(2).split('=')
  return [key, value.join('=') || true]
}))
const baseURL = String(options.url || 'http://localhost:3000')
const destination = path.resolve(String(options.output || 'docs/redesign/identity-audit'))
await fs.mkdir(destination, { recursive: true })
const routes = options.routes ? String(options.routes).split(',') : [
  '/', '/rank', '/agenda', '/campeonatos', '/equipes', '/jogadores', '/produtoras', '/managers',
  '/carrinho', '/carteira', '/afiliados', '/central-campeonato', '/lili', '/login',
  '/atualizar-senha', '/termos-de-servico', '/politica-de-privacidade', '/exclusao-de-dados',
]
const browser = await chromium.launch()
const results = []
const discovered = new Set()

async function inspect(page, route, width, state = 'page') {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.evaluate(() => Promise.race([Promise.allSettled([...document.images].filter(img => { const box = img.getBoundingClientRect(); return box.width && box.height && box.bottom > 0 && box.top < innerHeight }).map(img => img.decode())), new Promise(resolve => setTimeout(resolve, 5000))]))
  await page.evaluate(() => { for (const animation of document.getAnimations()) if (animation.effect?.getTiming().iterations !== Infinity) animation.finish() })
  const data = await page.evaluate(inspectIdentity)
  const lowContrast = await page.evaluate(inspectContrast, '.champ-public-panel *, .dz-champ-simple-header *, .system-modal *')
  const filename = `${route === '/' ? 'home' : route.replace(/[^a-zA-Z0-9-]/g, '_')}-${width}-${state}.png`
  await page.screenshot({ path: path.join(destination, filename), animations: 'disabled' })
  results.push({ route, width, state, ...data, lowContrast })
}

async function visit(route, width) {
  const page = await browser.newPage({ viewport: { width, height: width < 700 ? 844 : 1000 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', request => ['GET', 'HEAD'].includes(request.request().method()) ? request.continue() : request.abort())
  try {
    await page.goto(new URL(route, baseURL).href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
    await page.evaluate(() => document.fonts.ready)
    if (route === '/rank') await page.locator('.dz-ranking-list[aria-busy=false]').waitFor({ timeout: 45_000 })
    await inspect(page, route, width)
    for (const href of await page.locator('a[href]').evaluateAll(links => links.map(link => link.getAttribute('href')).filter(Boolean))) {
      if (/^\/(equipes|jogadores|produtoras|campeonatos)\/[^/?#]+$/.test(href) && ![...discovered].some(item => item.split('/')[1] === href.split('/')[1])) discovered.add(href)
    }
    if (route === '/rank') {
      await page.getByRole('button', { name: 'Como funciona o ranking' }).click()
      await inspect(page, route, width, 'method-dialog')
      await page.keyboard.press('Escape')
      const first = page.locator('.dz-ranking-item').first()
      if (await first.count()) { await first.click(); await inspect(page, route, width, 'detail-dialog') }
    }
    if (/^\/campeonatos\/[^/]+$/.test(route)) {
      for (const tab of ['Equipes', 'Jogadores', 'Estatísticas', 'Informações']) {
        await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click()
        await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => {})
        await inspect(page, route, width, tab)
        if (tab === 'Estatísticas') {
          for (const name of ['MVP', 'Campeão']) {
            const button = page.locator('.champ-stats-tabs button').filter({ hasText: name })
            if (await button.count() && await button.isEnabled()) { await button.click(); await inspect(page, route, width, name) }
          }
          const filters = page.getByRole('button', { name: /filtros/i }).first()
          if (await filters.count() && await filters.isVisible()) { await filters.click(); await inspect(page, route, width, 'statistics-filters'); await page.keyboard.press('Escape') }
        }
      }
    }
    if (route === '/campeonatos') {
      await page.locator('.championship-directory-more summary').click()
      await inspect(page, route, width, 'filters')
    }
    if (errors.length) results.push({ route, width, errors })
  } catch (error) { results.push({ route, width, error: error.message }) }
  finally { await page.close() }
}

for (const width of [1440, 390]) {
  for (let offset = 0; offset < routes.length; offset += 2) await Promise.all(routes.slice(offset, offset + 2).map(route => visit(route, width)))
}
if (!options.routes) for (const route of discovered) for (const width of [1440, 390]) await visit(route, width)
await browser.close()
await fs.writeFile(path.join(destination, 'report.json'), JSON.stringify({ baseURL, createdAt: new Date().toISOString(), results }, null, 2))
for (const result of results) console.log(JSON.stringify({ route: result.route, width: result.width, state: result.state, oldColorGroups: result.findings?.filter(item => !item.semantic).length, overflow: result.overflow, lowContrast: result.lowContrast?.length, error: result.error, errors: result.errors }))
if (options.strict && results.some(result => result.error || result.errors?.length || result.overflow || result.lowContrast?.length || result.findings?.some(item => !item.semantic))) process.exitCode = 1
