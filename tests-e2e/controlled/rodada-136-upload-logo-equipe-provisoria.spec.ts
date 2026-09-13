import { expect, test } from '@playwright/test'
import { activeAuthToken } from '../support/auth-session'

const STORAGE_STATE = 'tests-e2e/.auth/produtora.json'
const TEST_LOGO_PATH = 'C:/Users/Administrator/Pictures/dropzone-test/logo-teste-dz.png'

async function createTemporaryTeam(request: any, token: string, suffix: string) {
  const headers = { Authorization: `Bearer ${token}` }
  const nome = `Teste Upload UI ${suffix}`
  const tag = `TUI${suffix.slice(-2)}`
  const createRes = await request.post('/api/produtora/equipes-provisorias', {
    headers,
    data: { equipes: [{ nome, tag }] },
  })
  expect(createRes.ok(), await createRes.text()).toBeTruthy()

  const listRes = await request.get('/api/produtora/equipes-provisorias', { headers })
  expect(listRes.ok(), await listRes.text()).toBeTruthy()
  const listJson = await listRes.json()
  const team = (listJson.equipes || []).find((item: any) => item.nome === nome)
  expect(team, 'equipe provisória temporária precisa existir').toBeTruthy()
  return { team, headers }
}

test.use({ storageState: STORAGE_STATE })

test('UI salva logo de equipe provisoria e line herda a logo', async ({ browser, page, request }) => {
  const token = await activeAuthToken(browser, STORAGE_STATE, '/?painel=1')
  const suffix = Date.now().toString().slice(-6)
  const { team, headers } = await createTemporaryTeam(request, token, suffix)
  const uploadRequests: Array<{ postData: string }> = []

  page.on('request', (req) => {
    if (req.url().includes('/api/upload')) uploadRequests.push({ postData: req.postData() || '' })
  })

  try {
    await page.goto('/?painel=1', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /EQUIPES PROVISÓRIAS/i }).click()
    await expect(page.getByText(team.nome)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: new RegExp(team.nome, 'i') }).click()
    await expect(page.getByText('LOGO · WEBP OTIMIZADO')).toBeVisible({ timeout: 10_000 })

    await page.locator('input[type=file]').setInputFiles(TEST_LOGO_PATH)
    await expect(page.locator('.cropper-modal')).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /Usar imagem/i }).click()
    await expect(page.locator('.cropper-modal')).toBeHidden({ timeout: 10_000 })

    const saveResponsePromise = page.waitForResponse(
      (res) => res.url().includes('/api/produtora/equipes-provisorias') && res.request().method() === 'PATCH',
    )
    await page.getByRole('button', { name: /Salvar informações/i }).click()
    const saveResponse = await saveResponsePromise
    expect(saveResponse.ok(), await saveResponse.text()).toBeTruthy()
    await expect(page.getByText('Este usuário não pode enviar arquivos para esse perfil.')).toHaveCount(0)

    expect(uploadRequests.length, 'o fluxo visual deve chamar a API de upload').toBeGreaterThan(0)

    const listAfterSave = await request.get('/api/produtora/equipes-provisorias', { headers })
    expect(listAfterSave.ok(), await listAfterSave.text()).toBeTruthy()
    const listJson = await listAfterSave.json()
    const updated = (listJson.equipes || []).find((item: any) => item.id === team.id)
    expect(updated?.logo_url || '').toContain('/storage/v1/object/public/equipe/')
    expect(updated?.lines?.[0]?.logo_url).toBe(updated.logo_url)
  } finally {
    await request
      .delete(`/api/produtora/equipes-provisorias?equipe_id=${encodeURIComponent(team.id)}`, { headers })
      .catch(() => undefined)
  }
})
