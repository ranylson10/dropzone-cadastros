import { expect, test } from '@playwright/test'
import { mountLifecycle } from '../helpers/lifecycle-harness'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const champ = id(20), actor = id(1)
test.describe('Lifecycle: consulta isolada e ações indisponíveis', () => {
 let methods: string[], state: string, sourceActor: string, foreign: boolean, reads: number
 test.beforeEach(async ({ page }) => {
  methods = []; state = 'ativa'; sourceActor = actor; foreign = false; reads = 0
  await page.route('**/api/campeonatos/*/estrutura-avancada', async route => {
   methods.push(route.request().method()); reads++
   const championshipId = route.request().url().split('/').at(-2)!
   await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    lifecycle_write_mode: 'atomic', edition_actor_id: sourceActor,
    edition: state === 'none' ? null : { campeonato_id: foreign ? id(999) : championshipId, status: state, data_fim: state === 'encerrada' ? '2026-10-12' : null },
   }) })
  })
 })
 for (const status of ['ativa', 'encerrada']) test('botão desativado: ' + status, async ({ page }) => {
  state = status; await mountLifecycle(page, champ)
  const button = page.getByRole('button', { name: status === 'encerrada' ? 'Reabrir season' : 'Encerrar campeonato' })
  await expect(button).toBeDisabled(); await expect(page.getByText('Encerramento e reabertura temporariamente indisponíveis.')).toBeVisible()
  await page.evaluate(() => (document.querySelector('button') as HTMLButtonElement).click())
  expect(methods).toEqual(['GET']) // An older server advertising atomic cannot enable this client.
 })
 test('edição ausente não inventa estado ou ação', async ({ page }) => {
  state = 'none'; await mountLifecycle(page, champ); await expect(page.getByText('Esta edição ainda não possui vínculo de season.')).toBeVisible(); await expect(page.getByRole('button')).toHaveCount(0)
 })
 test('DTO estrangeiro não aparece como estado da edição', async ({ page }) => {
  foreign = true; await mountLifecycle(page, champ); await expect(page.getByRole('alert')).toHaveText('Não foi possível consultar o estado da edição.'); await expect(page.getByRole('button')).toHaveCount(0)
 })
 test('resposta tardia de outro recurso não substitui a edição atual', async ({ page }) => {
  await mountLifecycle(page, champ); await expect(page.getByText('Edição ativa.')).toBeVisible()
  state = 'encerrada'; await page.evaluate(champ => { (window as any).pauseNextLifecycle = true; (window as any).renderLifecycle(champ) }, id(21))
  await expect.poll(() => page.evaluate(() => Boolean((window as any).lifecyclePaused))).toBe(true)
  state = 'ativa'; await page.evaluate(champ => (window as any).renderLifecycle(champ), champ); await expect(page.getByText('Edição ativa.')).toBeVisible()
  await page.evaluate(() => (window as any).releaseLifecycleRead()); await expect(page.getByText('Edição ativa.')).toBeVisible(); await expect(page.getByText('Season encerrada')).toHaveCount(0)
  expect(methods.every(method => method === 'GET')).toBe(true)
 })
 test('troca de conta A-B-A invalida resposta antiga', async ({ page }) => {
  await mountLifecycle(page, champ); await expect(page.getByText('Edição ativa.')).toBeVisible()
  state = 'encerrada'; await page.evaluate(champ => { (window as any).pauseNextLifecycle = true; (window as any).renderLifecycle(champ) }, id(21))
  await expect.poll(() => page.evaluate(() => Boolean((window as any).lifecyclePaused))).toBe(true)
  state = 'ativa'; await page.evaluate(({ a, b }) => { (window as any).changeLifecycleActor(b); (window as any).changeLifecycleActor(a); (window as any).renderLifecycle('00000000-0000-4000-8000-000000000021') }, { a: actor, b: id(2) })
  await expect.poll(() => reads).toBe(3); await expect(page.getByText('Edição ativa.')).toBeVisible()
  await page.evaluate(() => (window as any).releaseLifecycleRead()); await expect(page.getByText('Season encerrada')).toHaveCount(0); expect(methods.every(method => method === 'GET')).toBe(true)
 })
 test('logout oculta estado privado e não grava', async ({ page }) => {
  state = 'encerrada'; await mountLifecycle(page, champ); await expect(page.getByText('Season encerrada')).toBeVisible()
  await page.evaluate(() => (window as any).changeLifecycleActor(null)); await expect(page.getByText('Entre na sua conta para consultar a edição.')).toBeVisible(); await expect(page.getByRole('button')).toHaveCount(0); expect(methods).toEqual(['GET'])
 })
 test('desmontagem antes de resposta impede estado tardio', async ({ page }) => {
  await mountLifecycle(page, champ); await expect(page.getByText('Edição ativa.')).toBeVisible()
  state = 'encerrada'; await page.evaluate(champ => { (window as any).pauseNextLifecycle = true; (window as any).renderLifecycle(champ) }, id(21))
  await expect.poll(() => page.evaluate(() => Boolean((window as any).lifecyclePaused))).toBe(true)
  await page.evaluate(() => { (window as any).unmountLifecycle(); (window as any).releaseLifecycleRead() }); await expect(page.locator('#root')).toBeEmpty(); expect(methods.every(method => method === 'GET')).toBe(true)
 })
})
