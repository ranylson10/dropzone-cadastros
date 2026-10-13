import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const directory = process.env.E2E_GROUP_INVITE_OUTPUT_DIR || 'relatorios-testes/convite-grupo-2026-10-11'
const user = { id: '00000000-0000-4000-8000-000000000401', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
type Options = { readonly?: boolean; scalar?: boolean; noLines?: boolean; failRead?: boolean; failSubmit?: boolean; loseResponseAfterCommit?: boolean; policy?: 'closed' | 'expired' }

async function fixture(page: Page, options: Options = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.')
  const lines = options.noLines ? [] : [{ id: 'line-fixture', nome: 'Line existente', tag: 'DZ', logo_url: null }]
  const payload = { autenticado: true, modo: 'inscricao', inscricao_aberta: true, campeonato: { id: 'champ-fixture', nome: 'Copa de teste', logo_url: null }, grupo: { id: 'group-fixture', nome: 'Grupo de teste' }, vagas: [{ index: 0, slot_id: 'slot-fixture', slot_letra: 'A', slot_numero: 1, ocupada: false, nome: 'Slot A', jogadores: [] }], resumo_grupo: { total: 1, ocupadas: 0, livres: 1 }, resumo_link: { usos: 0, limite_vagas: 1, restantes: 1 }, equipe: { id: 'team-fixture', nome: 'Equipe de teste', tag: 'DZ', logo_url: null, pode_inscrever: !options.readonly, pode_criar_line: !options.readonly && !options.scalar, pode_gerar_token: !options.readonly }, equipes_disponiveis: [{ id: 'team-fixture', nome: 'Equipe de teste', inscrita_no_grupo: false }], lines, lines_disponiveis: lines, minhas_participacoes: [] }
  if (options.policy) Object.assign(payload, { modo: 'acompanhamento', inscricao_aberta: false,
    status_link: options.policy === 'closed' ? 'inscricoes_fechadas' : 'prazo_encerrado',
    status_mensagem: options.policy === 'closed' ? 'As inscrições de equipes deste campeonato estão fechadas. Você ainda pode acompanhar o grupo.' : 'O prazo de inscrição deste campeonato terminou. Você ainda pode acompanhar o grupo.' })
  let reads = 0
  const submissions: Array<Record<string, unknown>> = [], errors: string[] = [], blocked: string[] = []
  const keys: string[] = [], receipts = new Set<string>()
  let releaseSubmit: (() => void) | undefined
  const gate = new Promise<void>(resolve => { releaseSubmit = resolve })
  await page.addInitScript(({ jwt, exp, user }) => {
    localStorage.clear()
    if (!sessionStorage.getItem('dz_fixture_initialized')) { sessionStorage.clear(); sessionStorage.setItem('dz_fixture_initialized', '1') }
    localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }))
    sessionStorage.setItem('dz_invite_mode:FIXTURE', 'normal')
    sessionStorage.setItem('dz_invite_was_logged:FIXTURE', '1')
  }, { jwt, exp, user })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user })
    if (url.pathname === '/api/convites/grupo/FIXTURE') {
      if (method === 'GET') {
        reads++
        if (options.failRead && reads === 1) return route.abort('failed')
        return route.fulfill({ json: payload, headers: { 'Cache-Control': 'no-store' } })
      }
      if (method === 'POST') {
        expect(request.headers().authorization).toMatch(/^Bearer /)
        const key = request.headers()['idempotency-key']; expect(key).toMatch(/^[\da-f-]{36}$/i); keys.push(key)
        submissions.push(request.postDataJSON())
        if (options.loseResponseAfterCommit && submissions.length === 1) { receipts.add(key); return route.abort('failed') }
        if (options.failSubmit && submissions.length === 1) return route.abort('failed')
        await gate
        const repeated = receipts.has(key); receipts.add(key)
        return route.fulfill({ json: { ok: true, repetida: repeated, campeonato_equipe_id: 'part-fixture', line: { nome: 'Line confirmada' }, slot_letra: 'A' } })
      }
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) { blocked.push(`${method} ${url.pathname}`); return route.abort('blockedbyclient') }
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ json: [] })
    if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { account: null, accounts: [], rows: [], items: [] } })
    return route.continue()
  })
  return { submissions, keys, errors, blocked, release: () => releaseSubmit?.(), reads: () => reads, commits: () => receipts.size }
}

async function lineStep(page: Page) {
  await page.goto('/convite/grupo/FIXTURE')
  await page.getByRole('button', { name: 'Quero inscrever minha equipe', exact: true }).click()
  await page.getByRole('button', { name: 'Sim, inscrever Equipe de teste', exact: true }).click()
  await page.getByRole('button', { name: 'A Slot A Disponível', exact: true }).click()
}

for (const policy of ['closed', 'expired'] as const) test(`campeonato ${policy} mantém acompanhamento sem aceite`, async ({ page }) => {
  const state = await fixture(page, { policy })
  await page.goto('/convite/grupo/FIXTURE')
  await expect(page.getByText(policy === 'closed' ? /inscrições de equipes deste campeonato estão fechadas/ : /prazo de inscrição deste campeonato terminou/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Quero inscrever minha equipe', exact: true })).toHaveCount(0)
  expect(state.submissions).toEqual([]); expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('staff de leitura acompanha sem inscrição', async ({ page }) => {
  const state = await fixture(page, { readonly: true })
  await page.goto('/convite/grupo/FIXTURE')
  await expect(page.getByRole('status').filter({ hasText: 'Sua permissão permite acompanhar' })).toBeVisible()
  await expect(page.getByRole('button', { name: /inscrever minha equipe/i })).toHaveCount(0)
  expect(state.submissions).toEqual([]); expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('staff de escalação usa line existente', async ({ page }) => {
  const state = await fixture(page, { scalar: true })
  await lineStep(page)
  await expect(page.locator('option').filter({ hasText: 'Criar nova line' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Nome da nova line' })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'Line livre' }).selectOption('line-fixture')
  state.release()
  await page.getByRole('button', { name: 'Confirmar inscrição', exact: true }).click()
  await expect(page.getByText('Pronto, inscrição confirmada')).toBeVisible()
  expect(state.submissions).toEqual([{ equipe_id: 'team-fixture', line_id: 'line-fixture', slot_id: 'slot-fixture' }])
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('staff sem lines disponíveis recebe orientação', async ({ page }) => {
  const state = await fixture(page, { scalar: true, noLines: true })
  await lineStep(page)
  await expect(page.getByText('Peça ao responsável para criar ou disponibilizar uma line para inscrição.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Confirmar inscrição', exact: true })).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'Nome da nova line' })).toHaveCount(0)
  expect(state.submissions).toEqual([]); expect(state.errors).toEqual([])
})

test('falha de leitura termina o carregamento e permite nova consulta', async ({ page }) => {
  const state = await fixture(page, { failRead: true })
  await page.goto('/convite/grupo/FIXTURE')
  await expect(page.getByRole('heading', { name: 'Link indisponível' })).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('button', { name: 'Quero inscrever minha equipe', exact: true })).toBeVisible()
  expect(state.reads()).toBe(2); expect(state.submissions).toEqual([]); expect(state.errors).toEqual([])
})

test('proprietário cria line, falha de rede libera a interface e clique duplo envia uma vez', async ({ page }, testInfo) => {
  const state = await fixture(page, { noLines: true, failSubmit: true })
  await lineStep(page)
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Nova line de teste')
  const confirm = page.getByRole('button', { name: 'Confirmar inscrição', exact: true })
  await confirm.click()
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível confirmar a inscrição' })).toBeVisible()
  await expect(confirm).toBeEnabled()
  fs.mkdirSync(directory, { recursive: true })
  const measurements = []
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport)
    await confirm.scrollIntoViewIfNeeded()
    const row = await page.evaluate(() => {
      const title = document.querySelector('[data-dz-group-invite] h1') as HTMLElement
      const rect = title.getBoundingClientRect(), style = getComputedStyle(title)
      const button = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Confirmar inscrição')!
      const action = button.getBoundingClientRect()
      const launcher = document.querySelector('button[aria-label*="Lili"]')?.getBoundingClientRect()
      const tiny = [...document.querySelectorAll('main *')].filter(element => {
        const box = element.getBoundingClientRect(), css = getComputedStyle(element)
        return box.width > 0 && box.height > 0 && css.visibility !== 'hidden' && element.childElementCount === 0 && Boolean(element.textContent?.trim()) && parseFloat(css.fontSize) < 12
      }).map(element => ({ text: element.textContent?.trim().slice(0, 50), size: getComputedStyle(element).fontSize }))
      return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, titleVisible: rect.width > 0 && rect.height > 0 && style.display !== 'none', titleColor: style.color, titleBackground: getComputedStyle(title.closest('.invite-card')!).backgroundColor, tiny, nestedMain: Boolean(document.querySelector('main main')), launcherOverlap: Boolean(launcher && action.left < launcher.right && action.right > launcher.left && action.top < launcher.bottom && action.bottom > launcher.top) }
    })
    expect(row.overflow).toBe(false); expect(row.titleVisible).toBe(true); expect(row.launcherOverlap).toBe(false)
    expect(row.tiny).toEqual([]); expect(row.nestedMain).toBe(false)
    measurements.push(row)
    await page.screenshot({ path: `${directory}/group-${testInfo.project.name}-${viewport.width}.png`, fullPage: true })
  }
  fs.writeFileSync(`${directory}/layout-${testInfo.project.name}.json`, JSON.stringify(measurements, null, 2))
  await confirm.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
  await expect(page.getByRole('button', { name: 'Confirmando...' })).toBeDisabled()
  expect(state.submissions).toHaveLength(2)
  expect(state.keys[0]).toBe(state.keys[1])
  state.release()
  await expect(page.getByText('Pronto, inscrição confirmada')).toBeVisible()
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('resposta perdida após commit mantém chave na recarga e recupera o recibo simulado', async ({ page }) => {
  const state = await fixture(page, { noLines: true, loseResponseAfterCommit: true })
  await lineStep(page)
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Line persistida')
  await page.getByRole('button', { name: 'Confirmar inscrição', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível confirmar a inscrição' })).toBeVisible()
  expect(state.commits()).toBe(1)
  await lineStep(page)
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Line persistida')
  state.release()
  await page.getByRole('button', { name: 'Confirmar inscrição', exact: true }).click()
  await expect(page.getByText('Pronto, inscrição confirmada')).toBeVisible()
  expect(state.keys).toHaveLength(2); expect(state.keys[0]).toBe(state.keys[1]); expect(state.commits()).toBe(1)
  expect(await page.evaluate(() => Object.keys(sessionStorage).filter(key => key.startsWith('dz_enrollment_attempt_v1:')))).toEqual([])
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('armazenamento bloqueado impede envio sem uma chave persistida', async ({ page }) => {
  const state = await fixture(page, { noLines: true })
  await page.addInitScript(() => { const original = Storage.prototype.setItem; Storage.prototype.setItem = function (key, value) {
    if (key.startsWith('dz_enrollment_attempt_v1:')) throw new DOMException('Fixture quota', 'QuotaExceededError')
    return original.call(this, key, value)
  } })
  await lineStep(page)
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Line sem storage')
  await page.getByRole('button', { name: 'Confirmar inscrição', exact: true }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Seu navegador não conseguiu guardar esta tentativa' })).toBeVisible()
  expect(state.submissions).toEqual([]); expect(state.keys).toEqual([]); expect(state.errors).toEqual([])
})
