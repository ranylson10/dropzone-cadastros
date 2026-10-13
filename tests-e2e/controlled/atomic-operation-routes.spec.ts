import { test, expect } from '@playwright/test'
import { mountParticipation } from '../helpers/participation-harness'
import { mountLiga } from '../helpers/liga-web-harness'
import { mountMobileHarness } from '../helpers/mobile-directory-harness'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const actor = id(1), champ = id(2), version = '2026-10-12T03:10:00.123456+00:00'
const add = { equipe_id: id(5), line_id: id(6), slot_id: id(7) }
const move = { mode: 'move', source_slot_id: id(7), target_slot_id: id(9), source_participation_id: id(8), target_participation_id: null }
const participation = { participation_write_mode: 'atomic', participation_actor_id: actor }
const movement = { slot_movement_mode: 'atomic', slot_movement_actor_id: actor }
function success(family: string, body: any) {
  return family === 'participation' ? { ok: true, operation_confirmed: true, campeonato_id: champ, action: 'add',
    participacao: { id: id(8), campeonato_id: champ, equipe_id: body.equipe_id, line_id: body.line_id, slot_id: body.slot_id, grupo_id: id(20), slot_numero: 1, status: 'ativo', updated_at: version },
    line: { id: body.line_id, nome: 'Line fixture', criada_agora: false } } : { ok: true, campeonato_id: champ, action: 'move', ...body, mensagem: 'Movida.',
    participacoes: [{ id: body.source_participation_id, slot_id: body.target_slot_id, equipe_id: id(5), line_id: id(6), grupo_id: id(20), slot_numero: 2, updated_at: version }] }
}
for (const platform of ['web', 'mobile']) for (const family of ['participation', 'movement']) {
  test(`${platform} ${family}: 503/404/405 conservam tentativa e repetem apenas a URL atômica`, async ({ page }) => {
    const errors: string[] = [], writes: any[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.route('**/api/**', route => route.request().method() === 'GET' ? route.fulfill({ json: { items: [], vagas: [], solicitacoes: [] } }) : route.abort())
    // An old deployment can return HTML for missing routes; JSON parsing must not erase recovery.
    await page.route(/\/equipes\/(?:participacao-atomica|movimentacao-atomica)$/, route => {
      const request = route.request(), body = request.postDataJSON()
      writes.push({ path: new URL(request.url()).pathname, key: request.headers()['idempotency-key'], body })
      const status = [503, 404, 405][writes.length - 1]
      return status ? route.fulfill({ status, contentType: 'text/html', body: '<html>Contrato indisponível</html>' }) : route.fulfill({ json: success(family, body) })
    })
    if (platform === 'mobile') await mountMobileHarness(page, { screen: 'ChampionshipTeamsPanel', championshipId: champ, actorId: actor, token: 'fixture-session' })
    else if (family === 'participation') await mountParticipation(page, { championshipId: champ, contract: participation })
    else await mountLiga(page, { screen: 'lili', accessToken: 'fixture-session', activeAccount: { id: actor, profile_type: 'produtora' } })
    const send = () => page.evaluate(async data => {
      const w = window as any
      try {
        const result = data.family === 'participation'
          ? data.platform === 'web' ? await w.participationApi.writeParticipation(data.champ, data.participation, 'POST', data.add)
            : await w.mobileOperations.participation.writeMobileParticipation(data.champ, data.participation, 'POST', data.add, 'fixture-session', data.actor)
          : data.platform === 'web' ? await w.movementApi.writeSlotMovement(data.champ, data.movement, data.move)
            : await w.mobileOperations.api.moveChampionshipSlot(data.champ, data.move, data.movement, 'fixture-session', data.actor)
        return { ok: result.ok }
      } catch (error: any) { return { error: error.message } }
    }, { platform, family, champ, actor, participation, movement, add, move })
    const pending = () => page.evaluate(async ({ platform, family, actor, champ }) => {
      const w = window as any
      if (family === 'participation') return (platform === 'web' ? w.participationApi : w.mobileOperations.participation).participationAttempts.read(actor, champ)
      return platform === 'web' ? w.movementApi.slotMovementAttempts.read(actor, champ) : w.mobileOperations.movement.readPendingMobileSlotTransfer(actor, champ)
    }, { platform, family, actor, champ })
    for (let n = 1; n <= 3; n++) {
      expect((await send()).error).toBeTruthy(); expect(writes).toHaveLength(n)
      const saved = await pending(); expect(saved.requestId).toBe(writes[0].key); expect(saved.body).toEqual(writes[0].body)
    }
    expect(await send()).toEqual({ ok: true }); expect(await pending()).toBeNull(); expect(writes).toHaveLength(4)
    expect(writes[0].path).toBe(`/api/campeonatos/${champ}/equipes/${family === 'participation' ? 'participacao-atomica' : 'movimentacao-atomica'}`)
    expect(writes[0].key).toMatch(/^[\da-f-]{36}$/i)
    for (const write of writes) expect(write).toEqual(writes[0])
    expect(errors).toEqual([])
  })
}
