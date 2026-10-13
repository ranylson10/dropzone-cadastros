import fs from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

const directory = process.env.E2E_TEAM_INVITE_OUTPUT_DIR || 'relatorios-testes/inscricoes-2026-10-11'
const user = { id: '00000000-0000-4000-8000-000000000401', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
type Options = { readonly?: boolean; scalar?: boolean; noLines?: boolean; failRead?: boolean; failSubmit?: boolean; loseResponseAfterCommit?: boolean; anonymous?: boolean; policy?: 'closed' | 'expired' }

async function fixture(page: Page, options: Options = {}) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp, role: 'authenticated' })).toString('base64url'), 'fixture-signature'].join('.')
  const lines = options.noLines ? [] : [{ id: 'line-fixture', nome: 'Line existente', tag: 'DZ', logo_url: null }]
  const payload = { valido: true, autenticado: !options.anonymous, modo: 'inscricao', inscricao_aberta: true, campeonato: { id: 'champ-fixture', nome: 'Copa de teste', logo_url: null }, slot: { id: 'slot-fixture', letra: 'A', numero: 1 }, grupo: { id: 'group-fixture', nome: 'Grupo de teste' }, vagas: [], equipe: options.anonymous ? null : { id: 'team-fixture', nome: 'Equipe de teste', tag: 'DZ', logo_url: null, pode_inscrever: !options.readonly, pode_criar_line: !options.readonly && !options.scalar }, lines, lines_disponiveis: lines }
  if (options.policy) Object.assign(payload, { modo: 'acompanhamento', inscricao_aberta: false,
    status_mensagem: options.policy === 'closed' ? 'As inscrições de equipes deste campeonato estão fechadas. Você ainda pode acompanhar o grupo.' : 'O prazo de inscrição deste campeonato terminou. Você ainda pode acompanhar o grupo.' })
  let reads = 0
  const submissions: Array<Record<string, unknown>> = [], errors: string[] = [], blocked: string[] = []
  const keys: string[] = [], receipts = new Set<string>()
  let releaseSubmit: (() => void) | undefined
  const submitGate = new Promise<void>(resolve => { releaseSubmit = resolve })
  await page.addInitScript(({ jwt, exp, user, anonymous }) => {
    localStorage.clear()
    if (!sessionStorage.getItem('dz_fixture_initialized')) { sessionStorage.clear(); sessionStorage.setItem('dz_fixture_initialized', '1') }
    if (!anonymous) localStorage.setItem('sb-uukivzxabiydnrvjvabt-auth-token', JSON.stringify({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_at: exp, expires_in: 3600, user }))
  }, { jwt, exp, user, anonymous: options.anonymous })
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method()
    if (url.pathname.startsWith('/auth/v1/')) return route.fulfill({ json: user })
    if (url.pathname === '/api/convites/equipe/FIXTURE') {
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
        await submitGate
        const repeated = receipts.has(key); receipts.add(key)
        return route.fulfill({ json: { ok: true, repetida: repeated, line: { nome: 'Line confirmada' }, slot: { letra: 'A' } } })
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
  await page.goto('/convite/equipe/FIXTURE')
  await page.getByRole('button', { name: 'Usar Equipe de teste', exact: true }).click()
}

for (const policy of ['closed', 'expired'] as const) test(`campeonato ${policy} mantém acompanhamento sem aceite`, async ({ page }) => {
  const state = await fixture(page, { policy })
  await page.goto('/convite/equipe/FIXTURE')
  await expect(page.getByText(policy === 'closed' ? /inscrições de equipes deste campeonato estão fechadas/ : /prazo de inscrição deste campeonato terminou/).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Usar Equipe de teste', exact: true })).toHaveCount(0)
  const enroll = page.getByRole('button', { name: 'Escalar minha equipe', exact: true })
  if (await enroll.count()) await expect(enroll).toBeDisabled()
  expect(state.submissions).toEqual([]); expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('staff de leitura acompanha e não recebe uma ação de inscrição', async ({ page }) => {
  const state = await fixture(page, { readonly: true })
  await page.goto('/convite/equipe/FIXTURE')
  await expect(page.getByRole('status').filter({ hasText: 'Sua permissão permite acompanhar' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Escalar minha equipe' })).toBeDisabled()
  expect(state.submissions).toEqual([]); expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('staff de escalação usa line existente e não oferece criação', async ({ page }) => {
  const state = await fixture(page, { scalar: true })
  await lineStep(page)
  await expect(page.getByRole('combobox')).toHaveValue('line-fixture')
  await expect(page.locator('option').filter({ hasText: 'Criar nova line' })).toHaveCount(0)
  await expect(page.getByRole('textbox', { name: 'Nome da nova line' })).toHaveCount(0)
  state.release()
  await page.getByRole('button', { name: 'Confirmar inscrição', exact: true }).click()
  await expect(page.getByText('Comprovante de inscrição')).toBeVisible()
  expect(state.submissions).toEqual([{ equipe_id: 'team-fixture', line_id: 'line-fixture', nome_line: null, slot_id: 'slot-fixture' }])
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
})

test('staff sem lines disponíveis recebe orientação e confirmação desabilitada', async ({ page }) => {
  const state = await fixture(page, { scalar: true, noLines: true })
  await lineStep(page)
  await expect(page.getByText('Peça ao responsável para criar ou disponibilizar uma line para inscrição.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Selecione uma line existente' })).toBeDisabled()
  await expect(page.getByRole('textbox', { name: 'Nome da nova line' })).toHaveCount(0)
  expect(state.submissions).toEqual([]); expect(state.errors).toEqual([])
})

test('falha de leitura termina o carregamento e permite uma nova consulta', async ({ page }) => {
  const state = await fixture(page, { failRead: true })
  await page.goto('/convite/equipe/FIXTURE')
  await expect(page.getByRole('heading', { name: 'Convite indisponível' })).toBeVisible()
  await page.getByRole('button', { name: 'Tentar novamente' }).click()
  await expect(page.getByRole('button', { name: 'Usar Equipe de teste', exact: true })).toBeVisible()
  expect(state.reads()).toBe(2); expect(state.submissions).toEqual([]); expect(state.errors).toEqual([])
})

test('proprietário cria line, falha de rede libera a interface e clique duplo envia uma vez', async ({ page }, testInfo) => {
  const state = await fixture(page, { noLines: true, failSubmit: true })
  await lineStep(page)
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Nova line de teste')
  const confirm = page.getByRole('button', { name: 'Criar line e confirmar inscrição' })
  await confirm.click()
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível confirmar a inscrição' })).toBeVisible()
  await expect(confirm).toBeEnabled()
  await confirm.evaluate(element => { (element as HTMLButtonElement).click(); (element as HTMLButtonElement).click() })
  await expect(page.getByRole('button', { name: 'Confirmando...' })).toBeDisabled()
  await expect.poll(() => state.submissions.length).toBe(2)
  state.release()
  await expect(page.getByText('Comprovante de inscrição')).toBeVisible()
  await expect(page.getByRole('heading',{name:'Copa de teste',exact:true})).toBeVisible()
  expect(state.submissions).toEqual(Array(2).fill({ equipe_id: 'team-fixture', line_id: null, nome_line: 'Nova line de teste', slot_id: 'slot-fixture' }))
  expect(state.keys[0]).toBe(state.keys[1])
  const observations = []
  fs.mkdirSync(directory, { recursive: true })
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 })
    await page.evaluate(() => document.fonts.ready)
    await expect(page.getByRole('heading',{name:'Copa de teste',exact:true})).toBeVisible()
    const observation = await page.evaluate(() => {
      const heading=document.querySelector('main h1')!
      const luminance=(color:string)=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number).map(channel=>channel/255).map(channel=>channel<=.04045?channel/12.92:((channel+.055)/1.055)**2.4).reduce((sum,channel,index)=>sum+channel*[.2126,.7152,.0722][index],0)
      let surface:Element|null=heading
      while(surface&&!/^rgb\(/.test(getComputedStyle(surface).backgroundColor))surface=surface.parentElement
      const text=luminance(getComputedStyle(heading).color),background=luminance(getComputedStyle(surface!).backgroundColor)
      const launcher=document.querySelector('.lili-global-launcher')?.getBoundingClientRect()
      const launcherOverlapsActions=!!launcher&&[...document.querySelectorAll('[data-dz-team-invite] .invite-auth-box .button')].some(element=>{
        const action=element.getBoundingClientRect()
        return action.width>0&&action.height>0&&action.left<launcher.right&&action.right>launcher.left&&action.top<launcher.bottom&&action.bottom>launcher.top
      })
      return { launcherOverlapsActions,titleContrast:(Math.max(text,background)+.05)/(Math.min(text,background)+.05), width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 1, nestedMain: !!document.querySelector('main main'), tiny: [...document.querySelectorAll('main *')].filter(element => { const rect = element.getBoundingClientRect(), style = getComputedStyle(element); return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && element.childElementCount === 0 && !!element.textContent?.trim() && parseFloat(style.fontSize) < 12 }).length }})
    observations.push(observation)
    fs.writeFileSync(`${directory}/invite-layout-${testInfo.project.name}.json`,JSON.stringify(observations,null,2))
    expect(observation.titleContrast).toBeGreaterThanOrEqual(4.5); expect(observation.overflow).toBeFalsy(); expect(observation.nestedMain).toBeFalsy(); expect(observation.tiny).toBe(0)
    expect(observation.launcherOverlapsActions).toBeFalsy()
    if (width === 320) await page.screenshot({ path: `${directory}/team-invite-${testInfo.project.name}-320.png` })
  }
  expect(state.errors).toEqual([]); expect(state.blocked).toEqual([])
  await testInfo.attach('invite-fixture-observations', { body: JSON.stringify({ observations, simulatedSubmissions: state.submissions.length, realWrites: 0 }), contentType: 'application/json' })
})

test('resposta perdida após commit mantém chave na recarga e recupera o recibo simulado', async ({ page }) => {
  const state = await fixture(page, { noLines: true, loseResponseAfterCommit: true })
  await lineStep(page)
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Line persistida')
  await page.getByRole('button', { name: 'Criar line e confirmar inscrição' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Não foi possível confirmar a inscrição' })).toBeVisible()
  expect(state.commits()).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'Usar Equipe de teste', exact: true }).click()
  await page.getByRole('textbox', { name: 'Nome da nova line' }).fill('Line persistida')
  state.release()
  await page.getByRole('button', { name: 'Criar line e confirmar inscrição' }).click()
  await expect(page.getByText('Comprovante de inscrição')).toBeVisible()
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
  await page.getByRole('button', { name: 'Criar line e confirmar inscrição' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Seu navegador não conseguiu guardar esta tentativa' })).toBeVisible()
  expect(state.submissions).toEqual([]); expect(state.keys).toEqual([]); expect(state.errors).toEqual([])
})
