import { expect, test } from '@playwright/test'
import { activeAuthToken } from '../support/auth-session'

const STORAGE_STATE = 'tests-e2e/.auth/produtora.json'

const TEST_LOGO_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAWUlEQVR4nO3WMQ0AIAwEwYv9d25gQwJByjOkpN3JXQDf3S0A8G8DkABIAKQAEgApgARAAiABkABIAKQAEgAJgARAAiABkABIAKQAEgAJgARAAiABkABIAKQAEgAJgASwC+8CH7xS9bMAAAAASUVORK5CYII='

test('produtora consegue subir logo em equipe provisoria e line herda a logo', async ({ browser, request }) => {
  const token = await activeAuthToken(browser, STORAGE_STATE, '/?painel=1')
  const headers = { Authorization: `Bearer ${token}` }
  const suffix = Date.now().toString().slice(-6)
  let equipeId = ''

  try {
    const createRes = await request.post('/api/produtora/equipes-provisorias', {
      headers,
      data: {
        equipes: [{ nome: `Teste Upload Provisoria ${suffix}`, tag: `TUP${suffix.slice(-2)}` }],
      },
    })
    expect(createRes.ok(), await createRes.text()).toBeTruthy()

    const listAfterCreate = await request.get('/api/produtora/equipes-provisorias', { headers })
    expect(listAfterCreate.ok(), await listAfterCreate.text()).toBeTruthy()
    const createListJson = await listAfterCreate.json()
    const created = (createListJson.equipes || []).find((team: any) => team.nome === `Teste Upload Provisoria ${suffix}`)
    expect(created, 'equipe provisoria criada precisa aparecer na lista da produtora').toBeTruthy()
    equipeId = created.id

    const uploadRes = await request.post('/api/upload', {
      headers,
      data: {
        bucket: 'equipe',
        file_name: `teste-logo-${suffix}.png`,
        content_type: 'image/png',
        data_url: TEST_LOGO_DATA_URL,
        entity_id: equipeId,
        upload_intent: 'create_profile',
      },
    })
    expect(uploadRes.ok(), await uploadRes.text()).toBeTruthy()
    const uploadJson = await uploadRes.json()
    expect(uploadJson.url).toContain('/storage/v1/object/public/equipe/')

    const patchRes = await request.patch('/api/produtora/equipes-provisorias', {
      headers,
      data: {
        equipe_id: equipeId,
        nome: created.nome,
        tag: created.tag,
        logo_url: uploadJson.url,
      },
    })
    expect(patchRes.ok(), await patchRes.text()).toBeTruthy()

    const listAfterPatch = await request.get('/api/produtora/equipes-provisorias', { headers })
    expect(listAfterPatch.ok(), await listAfterPatch.text()).toBeTruthy()
    const patchListJson = await listAfterPatch.json()
    const updated = (patchListJson.equipes || []).find((team: any) => team.id === equipeId)
    expect(updated?.logo_url).toBe(uploadJson.url)
    expect(updated?.lines?.length || 0).toBeGreaterThan(0)
    expect(updated.lines[0].logo_url).toBe(uploadJson.url)
  } finally {
    if (equipeId) {
      await request.delete(`/api/produtora/equipes-provisorias?equipe_id=${encodeURIComponent(equipeId)}`, { headers }).catch(() => undefined)
    }
  }
})
